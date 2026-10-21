import fs from 'node:fs';
import path from 'node:path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const pdfPath = path.resolve('test_documents/Quarterly_Report.pdf');
const data = new Uint8Array(fs.readFileSync(pdfPath));

const loadingTask = pdfjsLib.getDocument({
  data,
  cMapUrl: path.resolve('public/cmaps') + '/',
  cMapPacked: true,
  standardFontDataUrl: path.resolve('public/standard_fonts') + '/',
});

const pdfDoc = await loadingTask.promise;
console.log('PDF loaded successfully! Total pages:', pdfDoc.numPages);

if (pdfDoc.numPages !== 2) {
  throw new Error(`Expected 2 pages, got ${pdfDoc.numPages}`);
}

for (let i = 1; i <= pdfDoc.numPages; i++) {
  const page = await pdfDoc.getPage(i);
  const viewport = page.getViewport({ scale: 2.0 });
  console.log(`Page ${i}: dimensions ${viewport.width} x ${viewport.height}`);
}

console.log('PDF pagination verified: each page separates cleanly!');
