import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");

const svg = `<svg width="512" height="512" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="120" height="120" rx="30" fill="url(#bg-grad)"/>
  <rect x="22" y="24" width="76" height="54" rx="14" fill="white" fill-opacity="0.95"/>
  <path d="M38 78L30 96L52 78" fill="white" fill-opacity="0.95"/>
  <text x="60" y="60" text-anchor="middle" dominant-baseline="central" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="30" letter-spacing="-1" fill="url(#text-grad)">EN</text>
  <path d="M86 42C89 42 92 45 92 51C92 57 89 60 86 60" stroke="url(#text-grad)" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.7"/>
  <path d="M90 37C95 37 100 43 100 51C100 59 95 65 90 65" stroke="url(#text-grad)" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.4"/>
  <defs>
    <linearGradient id="bg-grad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F59E0B"/>
      <stop offset="0.5" stop-color="#D97706"/>
      <stop offset="1" stop-color="#B45309"/>
    </linearGradient>
    <linearGradient id="text-grad" x1="30" y1="30" x2="95" y2="75" gradientUnits="userSpaceOnUse">
      <stop stop-color="#B45309"/>
      <stop offset="1" stop-color="#92400E"/>
    </linearGradient>
  </defs>
</svg>`;

const svgBuffer = Buffer.from(svg);

async function generate() {
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(publicDir, "pwa-512.png"));
  console.log("pwa-512.png OK");

  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(publicDir, "pwa-192.png"));
  console.log("pwa-192.png OK");

  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(publicDir, "apple-touch-icon.png"));
  console.log("apple-touch-icon.png OK");

  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(publicDir, "apple-touch-icon-precomposed.png"));
  console.log("apple-touch-icon-precomposed.png OK");

  await sharp(svgBuffer).resize(64, 64).png().toFile(path.join(publicDir, "favicon.png"));
  console.log("favicon.png OK");
}

generate().catch(console.error);
