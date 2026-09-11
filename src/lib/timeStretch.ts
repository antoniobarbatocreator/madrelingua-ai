/**
 * WSOLA (Waveform Similarity Overlap-Add) time stretching.
 *
 * Slows down speech WITHOUT lowering its pitch. Simply playing audio back
 * slower would drop the pitch like a turntable; instead this rebuilds the
 * waveform from overlapping frames, and for each new frame it searches for the
 * input position whose waveform best continues the previous frame. That
 * similarity search is what keeps the result from sounding metallic.
 *
 * Designed for streaming: audio arrives in small chunks, so the stretcher
 * keeps its own state across calls and emits whatever is complete.
 */
export class TimeStretcher {
  private readonly frameSize: number;
  private readonly hop: number;
  private readonly searchRadius: number;
  private readonly window: Float32Array;

  /** 1 = normal speed, 0.8 = 20% slower. Values >= 1 bypass processing. */
  private speed = 1;

  private pending: Float32Array = new Float32Array(0);
  private readPos = 0;
  private overlap: Float32Array;
  private reference: Float32Array | null = null;

  constructor(frameSize = 1024, searchRadius = 256) {
    // 50% overlap keeps a Hann window summing to a flat 1 across frames
    this.frameSize = frameSize;
    this.hop = frameSize >> 1;
    this.searchRadius = searchRadius;
    this.overlap = new Float32Array(this.hop);

    this.window = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      this.window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameSize - 1));
    }
  }

  setSpeed(speed: number) {
    const clamped = Math.max(0.5, Math.min(1, speed));
    if (clamped === this.speed) return;
    this.speed = clamped;
    this.reset();
  }

  getSpeed(): number {
    return this.speed;
  }

  reset() {
    this.pending = new Float32Array(0);
    this.readPos = 0;
    this.overlap = new Float32Array(this.hop);
    this.reference = null;
  }

  /** Feed one chunk of audio, get back the stretched audio ready so far. */
  process(input: Float32Array): Float32Array {
    if (this.speed >= 1 || input.length === 0) return input;

    this.pending = concat(this.pending, input);

    // Advancing the read head by less than the write head is what stretches time
    const analysisHop = Math.max(1, Math.round(this.hop * this.speed));
    const blocks: Float32Array[] = [];

    while (this.readPos + this.searchRadius + this.frameSize <= this.pending.length) {
      const start = this.readPos + this.findBestOffset();

      const out = new Float32Array(this.hop);
      for (let i = 0; i < this.hop; i++) {
        out[i] = this.overlap[i] + this.pending[start + i] * this.window[i];
      }
      blocks.push(out);

      for (let i = 0; i < this.hop; i++) {
        this.overlap[i] = this.pending[start + this.hop + i] * this.window[this.hop + i];
      }

      // What the input would naturally play next, used to align the next frame.
      // Copied, not a view: the buffer gets compacted below and a view would go stale.
      this.reference = this.pending.slice(start + this.hop, start + this.hop + this.hop);
      this.readPos += analysisHop;
    }

    this.trimConsumed();
    return concat2(blocks);
  }

  /** Emit the final partial frame so the end of a sentence is not clipped. */
  flush(): Float32Array {
    if (this.speed >= 1) return new Float32Array(0);
    const tail = this.overlap;
    this.overlap = new Float32Array(this.hop);
    return tail;
  }

  /**
   * Search nearby input positions for the frame that best continues the
   * previous one, scoring by cross-correlation over the overlap region.
   */
  private findBestOffset(): number {
    if (!this.reference) return 0;

    const lo = Math.max(-this.searchRadius, -this.readPos);
    const hi = Math.min(
      this.searchRadius,
      this.pending.length - this.frameSize - this.readPos
    );
    if (hi < lo) return 0;

    let bestOffset = 0;
    let bestScore = -Infinity;

    for (let d = lo; d <= hi; d++) {
      const base = this.readPos + d;
      let score = 0;
      // Step by 2: half the work, and the peak stays in the same place
      for (let i = 0; i < this.hop; i += 2) {
        score += this.pending[base + i] * this.reference[i];
      }
      if (score > bestScore) {
        bestScore = score;
        bestOffset = d;
      }
    }
    return bestOffset;
  }

  /** Drop input we can no longer reach, keeping memory bounded. */
  private trimConsumed() {
    const keepFrom = Math.max(0, this.readPos - this.searchRadius);
    if (keepFrom <= 0) return;
    this.pending = this.pending.slice(keepFrom);
    this.readPos -= keepFrom;
  }
}

function concat(a: Float32Array, b: Float32Array): Float32Array {
  if (a.length === 0) return b.slice();
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function concat2(blocks: Float32Array[]): Float32Array {
  if (blocks.length === 0) return new Float32Array(0);
  if (blocks.length === 1) return blocks[0];
  let total = 0;
  for (const b of blocks) total += b.length;
  const out = new Float32Array(total);
  let at = 0;
  for (const b of blocks) {
    out.set(b, at);
    at += b.length;
  }
  return out;
}
