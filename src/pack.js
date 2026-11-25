// Compression of one teacher's record.  JSON -> gzip (built into every modern browser).
// A record = all the details of ONE teacher for ONE semester (text + passport photo).
// Rule: after compression it must stay within RECORD_LIMIT (50 KB).  NPTEL certificate files are kept
// in a separate store (5 MB each) and are NOT counted in this limit.
export const RECORD_LIMIT = 50 * 1024;
export const CERT_LIMIT = 5 * 1024 * 1024;

const canGzip = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
const through = async (u8, Stream) => {
  const s = new Stream('gzip'); const w = s.writable.getWriter(); w.write(u8); w.close();
  return new Uint8Array(await new Response(s.readable).arrayBuffer());
};

export async function pack(form) {
  const json = new TextEncoder().encode(JSON.stringify(form));
  return canGzip ? { enc: 'gz', z: await through(json, CompressionStream) } : { enc: 'raw', z: json };
}
export async function unpack(rec) {
  if (rec.z) {
    const u8 = rec.enc === 'gz' ? await through(rec.z, DecompressionStream) : rec.z;
    return JSON.parse(new TextDecoder().decode(u8));
  }
  return rec.form;                                  // records saved by the older version
}
export const kb = (bytes) => (bytes / 1024).toFixed(1);

// bytes <-> base64 text (records travel to the server as text)
export const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
export const fromB64 = (t) => { const s = atob(t); const u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; };
