import { ParsedConformance } from './PDFAConformance';

export interface XMPMetadataInfo {
  conformance: ParsedConformance;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
}

// The recommended, fixed XMP packet id (see the XMP specification, part 1).
const XPACKET_ID = 'W5M0MpCehiHzreSzNTczkc9d';

const escapeXML = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// XMP dates use ISO 8601. We drop the milliseconds so the value matches the
// (second-precision) date stored in the document information dictionary, which
// PDF/A requires to be equivalent.
const formatDate = (date: Date): string =>
  `${date.toISOString().split('.')[0]}Z`;

/**
 * Build an XMP metadata packet describing a PDF/A document. Every field that is
 * present is mirrored from the document information dictionary so that the two
 * metadata sources stay consistent, as required by the PDF/A standard.
 */
export const buildPDFAMetadata = (info: XMPMetadataInfo): string => {
  const { part, level } = info.conformance;

  const dcEntries: string[] = ['<dc:format>application/pdf</dc:format>'];
  if (info.title !== undefined) {
    dcEntries.push(
      '<dc:title><rdf:Alt><rdf:li xml:lang="x-default">' +
        `${escapeXML(info.title)}</rdf:li></rdf:Alt></dc:title>`,
    );
  }
  if (info.author !== undefined) {
    dcEntries.push(
      '<dc:creator><rdf:Seq><rdf:li>' +
        `${escapeXML(info.author)}</rdf:li></rdf:Seq></dc:creator>`,
    );
  }
  if (info.subject !== undefined) {
    dcEntries.push(
      '<dc:description><rdf:Alt><rdf:li xml:lang="x-default">' +
        `${escapeXML(info.subject)}</rdf:li></rdf:Alt></dc:description>`,
    );
  }

  const xmpEntries: string[] = [];
  if (info.creator !== undefined) {
    xmpEntries.push(
      `<xmp:CreatorTool>${escapeXML(info.creator)}</xmp:CreatorTool>`,
    );
  }
  if (info.creationDate !== undefined) {
    xmpEntries.push(
      `<xmp:CreateDate>${formatDate(info.creationDate)}</xmp:CreateDate>`,
    );
  }
  if (info.modificationDate !== undefined) {
    const modify = formatDate(info.modificationDate);
    xmpEntries.push(`<xmp:ModifyDate>${modify}</xmp:ModifyDate>`);
    xmpEntries.push(`<xmp:MetadataDate>${modify}</xmp:MetadataDate>`);
  }

  const pdfEntries: string[] = [];
  if (info.producer !== undefined) {
    pdfEntries.push(`<pdf:Producer>${escapeXML(info.producer)}</pdf:Producer>`);
  }
  if (info.keywords !== undefined) {
    pdfEntries.push(`<pdf:Keywords>${escapeXML(info.keywords)}</pdf:Keywords>`);
  }

  const descriptions: string[] = [
    '<rdf:Description rdf:about="" ' +
      `xmlns:dc="http://purl.org/dc/elements/1.1/">${dcEntries.join('')}` +
      '</rdf:Description>',
  ];
  if (xmpEntries.length > 0) {
    descriptions.push(
      '<rdf:Description rdf:about="" ' +
        `xmlns:xmp="http://ns.adobe.com/xap/1.0/">${xmpEntries.join('')}` +
        '</rdf:Description>',
    );
  }
  if (pdfEntries.length > 0) {
    descriptions.push(
      '<rdf:Description rdf:about="" ' +
        `xmlns:pdf="http://ns.adobe.com/pdf/1.3/">${pdfEntries.join('')}` +
        '</rdf:Description>',
    );
  }
  descriptions.push(
    '<rdf:Description rdf:about="" ' +
      'xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">' +
      `<pdfaid:part>${part}</pdfaid:part>` +
      `<pdfaid:conformance>${level}</pdfaid:conformance>` +
      '</rdf:Description>',
  );

  return (
    `<?xpacket begin="\uFEFF" id="${XPACKET_ID}"?>\n` +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="pdf-lib">\n' +
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n' +
    descriptions.join('\n') +
    '\n</rdf:RDF>\n' +
    '</x:xmpmeta>\n' +
    '<?xpacket end="w"?>'
  );
};
