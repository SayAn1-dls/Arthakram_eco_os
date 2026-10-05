// One-off: cut the Arthakram logo out of the Founders Day poster with a transparent background.
// usage: node scripts/extract-logo.cjs <poster.jpg>
const sharp = require("sharp");
const src = process.argv[2];
const BG = [253, 243, 238]; // poster cream

async function cut(region, out, { erase = [], square = false, pad = 0 } = {}) {
  const { data, info } = await sharp(src).extract(region).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * channels;
      const o = (y * w + x) * 4;
      const px = [data[i], data[i + 1], data[i + 2]];
      const ax = x + region.left, ay = y + region.top;
      if (erase.some((r) => ax >= r[0] && ax < r[2] && ay >= r[1] && ay < r[3])) continue;
      // Un-mix the cream background: alpha = how far the pixel is pulled away from it.
      let a = Math.max(...px.map((c, k) => (BG[k] - c) / BG[k]));
      a = Math.min(1, Math.max(0, (a - 0.04) / 0.9));
      if (a <= 0) continue;
      for (let k = 0; k < 3; k++) rgba[o + k] = Math.max(0, Math.min(255, Math.round((px[k] - (1 - a) * BG[k]) / a)));
      rgba[o + 3] = Math.round(a * 255);
    }
  let img = sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 });
  const trimmed = await img.png().toBuffer();
  let final = sharp(trimmed);
  if (square) {
    const m = await sharp(trimmed).metadata();
    const s = Math.max(m.width, m.height) + pad * 2;
    final = sharp(trimmed).extend({
      top: Math.floor((s - m.height) / 2), bottom: Math.ceil((s - m.height) / 2),
      left: Math.floor((s - m.width) / 2), right: Math.ceil((s - m.width) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }
  await final.png({ compressionLevel: 9 }).toFile(out);
  const m = await sharp(out).metadata();
  console.log(out, m.width, m.height);
}

(async () => {
  await cut({ left: 118, top: 86, width: 462, height: 318 }, "public/brand/arthakram-lockup.png");
  await cut({ left: 118, top: 86, width: 462, height: 258 }, "public/brand/arthakram-logo.png");
  await cut({ left: 118, top: 86, width: 200, height: 228 }, "public/brand/arthakram-feather.png", { erase: [[166, 280, 330, 320], [186, 258, 330, 320]], square: true, pad: 6 });
})();
