import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const outDir = path.resolve('test_documents');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. PDF
const samplePdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 6 0 R >> >> >>
endobj
5 0 obj
<< /Length 73 >>
stream
BT
/F1 24 Tf
100 700 Td
(Quarterly Financial Report - Page 1) Tj
ET
endstream
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
7 0 obj
<< /Length 63 >>
stream
BT
/F1 24 Tf
100 700 Td
(Executive Summary - Page 2) Tj
ET
endstream
endobj
xref
0 8
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000123 00000 n 
0000000244 00000 n 
0000000365 00000 n 
0000000488 00000 n 
0000000565 00000 n 
trailer
<< /Size 8 /Root 1 0 R >>
startxref
678
%%EOF`;

fs.writeFileSync(path.join(outDir, 'Quarterly_Report.pdf'), samplePdf, 'utf-8');
console.log('Created Quarterly_Report.pdf');

// 2. Minimal valid DOCX
async function createDocx() {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="56"/>
          <w:color w:val="1E293B"/>
        </w:rPr>
        <w:t>Project Specification 2026</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:sz w:val="28"/>
          <w:color w:val="475569"/>
        </w:rPr>
        <w:t>This is a high-fidelity document converted into an image seamlessly.</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`
  );

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(path.join(outDir, 'Project_Specification.docx'), buffer);
  console.log('Created Project_Specification.docx');
}

createDocx();
