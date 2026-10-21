import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

async function createRotatedDocx() {
  const outDir = path.resolve('test_documents');
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

  // Document with table containing bottom-to-top textDirection (btLr)
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="48"/></w:rPr>
        <w:t>Header Logo and Vertical Text Test</w:t>
      </w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc>
          <w:tcPr>
            <w:textDirection w:val="btLr"/>
            <w:tcW w:w="1200" w:type="dxa"/>
          </w:tcPr>
          <w:p>
            <w:r>
              <w:rPr><w:b/><w:color w:val="0056B3"/><w:sz w:val="32"/></w:rPr>
              <w:t>BOTTOM TO TOP TEXT</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="5000" w:type="dxa"/></w:tcPr>
          <w:p>
            <w:r>
              <w:t>Main horizontal content area next to the vertical text margin.</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`
  );

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const targetPath = path.join(outDir, 'Rotated_Test.docx');
  fs.writeFileSync(targetPath, buffer);
  console.log('Created Rotated_Test.docx at:', targetPath);
}

createRotatedDocx();
