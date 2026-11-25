import { fileSafeName } from './spec.js';

const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function saveBytes(bytes, filename, mime) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Each exporter is loaded only when its button is pressed, so the app opens fast.
export async function download(kind, form, term) {
  let bytes;
  if (kind === 'pdf') bytes = await (await import('./exportPdf.js')).buildPdf(form, term);
  else if (kind === 'docx') bytes = await (await import('./exportDocx.js')).buildDocx(form, term);
  else bytes = await (await import('./exportXlsx.js')).buildXlsx(form, term);
  const t = term ? '_' + term.replace(/[^A-Za-z0-9]+/g, '_').replace(/_+$/, '') : '';
  saveBytes(bytes, `${fileSafeName(form)}${t}.${kind}`, MIME[kind]);
}
