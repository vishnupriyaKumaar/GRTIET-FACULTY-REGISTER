import { extractBlocks } from './extract.js';
import { parseBlocks } from './parse.js';
import { passportPhoto } from '../imageUtils.js';

// file -> { patch, summary, notes, total, photo }
export async function readFacultyFile(file, onStatus) {
  const { blocks, photo } = await extractBlocks(file, onStatus);
  onStatus?.('Finding the details…');
  const res = parseBlocks(blocks);
  if (photo) {
    try { res.photo = await passportPhoto(new File([photo.bytes], 'photo', { type: photo.type })); } catch { /* ignore */ }
  }
  return res;
}
