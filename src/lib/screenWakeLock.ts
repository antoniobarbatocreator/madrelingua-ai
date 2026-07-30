class ScreenWakeLockManager {
  private sentinel: any = null;
  private listeners: Set<(active: boolean, supported: boolean) => void> = new Set();

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  public addListener(cb: (active: boolean, supported: boolean) => void): () => void {
    this.listeners.add(cb);
    cb(this.sentinel !== null, this.isSupported());
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    const active = this.sentinel !== null;
    const supported = this.isSupported();
    for (const cb of this.listeners) {
      cb(active, supported);
    }
  }

  public async requestWakeLock(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      if (!this.sentinel) {
        this.sentinel = await (navigator as any).wakeLock.request('screen');
        this.sentinel.addEventListener('release', () => {
          this.sentinel = null;
          this.notify();
        });
        this.notify();
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  public async releaseWakeLock(): Promise<void> {
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch (e) {}
      this.sentinel = null;
      this.notify();
    }
  }
}

export const screenWakeLockManager = new ScreenWakeLockManager();
