const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RED = [0xd7, 0x19, 0x21, 255];
const PAPER = [0xf0, 0xf0, 0xf0, 255];
const INK = [0x12, 0x12, 0x12, 255];

const STEM_X = 348;
const JOINT_Y = 512;
const STEM = [
  [STEM_X, 236],
  [STEM_X, 788],
];
const UPPER = [
  [STEM_X, JOINT_Y],
  [700, 268],
];
const LOWER = [
  [STEM_X, JOINT_Y],
  [700, 756],
];
const HALF = 54;
const MARK = { cx: STEM_X, cy: JOINT_Y, size: 124 };

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(8 + body.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 4 + body.length);
  return out;
}

function writePng(file, width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
}

function onStroke(px, py, a, b, half) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const t = ((px - a[0]) * dx + (py - a[1]) * dy) / (len * len);
  const pad = half / len;
  if (t < -pad || t > 1 + pad) return false;
  const qx = a[0] + t * dx;
  const qy = a[1] + t * dy;
  return (px - qx) ** 2 + (py - qy) ** 2 <= half * half;
}

function inMark(px, py) {
  return Math.abs(px - MARK.cx) <= MARK.size / 2 && Math.abs(py - MARK.cy) <= MARK.size / 2;
}

function onArm(px, py, end) {
  if (px < MARK.cx + MARK.size / 2 - 6) return false;
  return onStroke(px, py, [MARK.cx, MARK.cy], end, HALF);
}

function onGlyph(px, py) {
  return onStroke(px, py, STEM[0], STEM[1], HALF) || onArm(px, py, UPPER[1]) || onArm(px, py, LOWER[1]);
}

function sample(px, py, mode) {
  const marked = inMark(px, py);
  const glyph = onGlyph(px, py);
  if (mode === 'mono') {
    return glyph || marked ? [255, 255, 255, 255] : [0, 0, 0, 0];
  }
  if (marked) return RED;
  if (glyph) return PAPER;
  return mode === 'plate' ? INK : [0, 0, 0, 0];
}

function render(size, mode) {
  const scale = size >= 256 ? 4 : 8;
  const data = Buffer.alloc(size * size * 4);
  const n = scale * scale;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const px = ((x + (sx + 0.5) / scale) / size) * 1024;
          const py = ((y + (sy + 0.5) / scale) / size) * 1024;
          const c = sample(px, py, mode);
          r += c[0];
          g += c[1];
          b += c[2];
          a += c[3];
        }
      }
      const i = (y * size + x) * 4;
      data[i] = Math.round(r / n);
      data[i + 1] = Math.round(g / n);
      data[i + 2] = Math.round(b / n);
      data[i + 3] = Math.round(a / n);
    }
  }
  return data;
}

const assets = path.join(__dirname, '..', 'assets');
const plate = render(1024, 'plate');
const mark = render(1024, 'mark');
const mono = render(1024, 'mono');
const favicon = render(192, 'plate');

writePng(path.join(assets, 'icon.png'), 1024, 1024, plate);
writePng(path.join(assets, 'logo.png'), 1024, 1024, plate);
writePng(path.join(assets, 'logo-light.png'), 1024, 1024, plate);
writePng(path.join(assets, 'logo-dark.png'), 1024, 1024, plate);
writePng(path.join(assets, 'splash-icon.png'), 1024, 1024, plate);
writePng(path.join(assets, 'android-icon-foreground.png'), 1024, 1024, plate);
writePng(path.join(assets, 'android-icon-monochrome.png'), 1024, 1024, mono);
const bg = Buffer.alloc(1024 * 1024 * 4);
for (let i = 0; i < 1024 * 1024; i++) {
  bg[i * 4] = INK[0];
  bg[i * 4 + 1] = INK[1];
  bg[i * 4 + 2] = INK[2];
  bg[i * 4 + 3] = 255;
}
writePng(path.join(assets, 'android-icon-background.png'), 1024, 1024, bg);
writePng(path.join(assets, 'favicon.png'), 192, 192, favicon);

const preview = path.join(assets, '..', 'logo-preview.png');
writePng(preview, 1024, 1024, plate);
console.log('wrote logos');
