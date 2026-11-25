// Tiny helpers for images stored as data URLs (no DOM needed).
export function dataUrlToBytes(dataUrl) {
  const s = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(s); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
export const imgKind = (dataUrl) => (/^data:image\/png/.test(dataUrl) ? 'png' : 'jpg');
export const isPdfFile = (file) => !!file && ((file.type || '').includes('pdf') || /^data:application\/pdf/.test(file.data || ''));

// Read width/height from JPEG or PNG bytes
export function imgSize(b) {
  try {
    if (b[0] === 0x89 && b[1] === 0x50) return { w: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], h: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23] };
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
  } catch { /* fall through */ }
  return { w: 800, h: 600 };
}
