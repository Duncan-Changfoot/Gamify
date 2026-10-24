// Draws the app icon (a smiling star) at every size the home screens ask for.
import { chromium } from 'playwright';
import fs from 'node:fs';

const SIZES = { 'icons/icon-512.png': 512, 'icons/icon-192.png': 192, 'icons/apple-touch-icon.png': 180 };

function draw(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, '#2563eb');
  sky.addColorStop(1, '#7c3aed');
  g.fillStyle = sky;
  g.fillRect(0, 0, size, size);
  // Everything sits inside the middle 80%, so Android's round and squircle masks don't cut it off.
  const x = size / 2, y = size * 0.52, r = size * 0.34;
  const points = (spin, outer, inner) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = spin - Math.PI / 2 + (i * Math.PI) / 5;
      const d = i % 2 ? inner : outer;
      g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    g.closePath();
  };
  g.lineJoin = 'round';
  g.lineWidth = size * 0.05;
  g.strokeStyle = '#facc15';
  g.fillStyle = '#fde047';
  points(0, r, r * 0.5);
  g.stroke();
  g.fill();
  g.fillStyle = '#1e293b';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.ellipse(x + side * r * 0.2, y - r * 0.05, r * 0.07, r * 0.1, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#1e293b';
  g.lineWidth = size * 0.022;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(x, y + r * 0.08, r * 0.17, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
  g.fillStyle = '#f472b6';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.arc(x + side * r * 0.36, y + r * 0.1, r * 0.07, 0, Math.PI * 2);
    g.fill();
  }
  return c.toDataURL('image/png');
}

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size] of Object.entries(SIZES)) {
  const url = await page.evaluate(draw, size);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(file);
}
await browser.close();
