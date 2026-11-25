const readAsDataURL = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); });

// Shrinks a picture to a JPEG so a sheet stays small (and the PDF / Word / Excel files too).
export async function compressImage(file, maxSide = 1600, quality = 0.82) {
  const src = await readAsDataURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read this picture')); i.src = src; });
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/jpeg', quality);
}

// Passport-style photo: cropped to 28:34 (the box on the sheet), max 420 px tall.
export async function passportPhoto(file) {
  const src = await readAsDataURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read this picture')); i.src = src; });
  const ratio = 28 / 34;
  let sw = img.width, sh = img.height;
  if (sw / sh > ratio) sw = sh * ratio; else sh = sw / ratio;
  const sx = (img.width - sw) / 2, sy = Math.max(0, (img.height - sh) / 3);   // keep the face area
  const H = Math.min(320, Math.round(sh)), W = Math.round(H * ratio);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  return c.toDataURL('image/jpeg', 0.82);
}

// Re-compresses a stored passport photo (step 0..5 = smaller and smaller) so the record fits in 50 KB.
export async function shrinkPhoto(dataUrl, step = 0) {
  const H = [260, 220, 190, 160, 130, 110][Math.min(step, 5)], q = [0.7, 0.6, 0.5, 0.45, 0.4, 0.35][Math.min(step, 5)];
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('photo')); i.src = dataUrl; });
  const h = Math.min(H, img.height), w = Math.round(h * img.width / img.height);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/jpeg', q);
}

export async function readCertificate(file) {
  const MAX = 5 * 1024 * 1024;
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > MAX) throw new Error('This PDF is larger than 5 MB. Please upload a smaller PDF or a photo of the certificate.');
    return { name: file.name, type: 'application/pdf', data: await readAsDataURL(file) };
  }
  if (!/^image\//.test(file.type)) throw new Error('Please choose a picture (JPG / PNG) or a PDF file.');
  const data = await compressImage(file, 1600, 0.8);          // phone photos are shrunk automatically
  if (data.length * 0.75 > MAX) throw new Error('This picture is still larger than 5 MB after compression. Please use a smaller picture.');
  return { name: file.name, type: 'image/jpeg', data };
}
