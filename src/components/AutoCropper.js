/*
  AutoCropper: fast edge-detect + deskew estimate
  - Uses grayscale + Sobel edge magnitude approximation
  - Finds largest contour-like rectangle by sampling
  - Returns crop rectangle and rotation suggestion
*/

export function detectCropAndDeskew(canvas) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  const src = ctx.getImageData(0, 0, w, h);
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < src.data.length; i += 4, p++) {
    const r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
    gray[p] = (r * 0.299 + g * 0.587 + b * 0.114) | 0;
  }
  // Sobel-like gradient magnitude
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] + gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy = -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      mag[i] = Math.hypot(gx, gy);
    }
  }
  // Threshold edges
  const edges = new Uint8Array(w * h);
  const t = percentile(mag, 0.90); // top 10% as edges
  for (let i = 0; i < mag.length; i++) edges[i] = mag[i] >= t ? 1 : 0;

  // Estimate bounding rectangle by scanning row/col hits
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (edges[y * w + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  // crude deskew: check edge orientation by sampling top/bottom rows
  const topSlope = estimateRowSlope(edges, w, minY, minX, maxX);
  const botSlope = estimateRowSlope(edges, w, maxY, minX, maxX);
  const angle = ((topSlope + botSlope) / 2) * (180 / Math.PI);

  // Safety margins
  const pad = Math.floor(Math.max(8, Math.min(w, h) * 0.02));
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);

  return { crop: { x: minX, y: minY, width: (maxX - minX + 1), height: (maxY - minY + 1) }, angle };
}

function percentile(arr, p) {
  const copy = Array.from(arr).filter(n => Number.isFinite(n)).sort((a,b)=>a-b);
  if (copy.length === 0) return 0;
  const idx = Math.floor((copy.length - 1) * p);
  return copy[idx];
}

function estimateRowSlope(edges, w, y, minX, maxX) {
  // find first/last edge x along the row, compute slope vs a reference row
  let first = -1, last = -1;
  for (let x = minX; x <= maxX; x++) { if (edges[y * w + x]) { first = x; break; } }
  for (let x = maxX; x >= minX; x--) { if (edges[y * w + x]) { last = x; break; } }
  if (first < 0 || last < 0) return 0;
  // simple slope proxy: center vs extremes
  const mid = (first + last) / 2;
  return Math.atan2(y, mid) - Math.atan2(y, (minX + maxX) / 2);
}


