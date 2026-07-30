import { ParsedConformance } from './PDFAConformance';

const OWNED_XMP_NAMESPACE_URIS: ReadonlySet<string> = new Set([
  'http://purl.org/dc/elements/1.1/',
  'http://ns.adobe.com/xap/1.0/',
  'http://ns.adobe.com/pdf/1.3/',
  'http://www.aiim.org/pdfa/ns/id/',
]);

const STRUCTURAL_XMP_NAMESPACE_URIS: ReadonlySet<string> = new Set([
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  'http://www.w3.org/XML/1998/namespace',
]);

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
  /**
   * Extra `rdf:Description` fragments appended after the owned PDF/A / Info
   * projection. Each entry should be a full
   * `<rdf:Description ...>...</rdf:Description>` element.
   */
  extensions?: string[];
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

const DESCRIPTION_RE =
  /<rdf:Description\b[^>]*\/>|<rdf:Description\b[^>]*>[\s\S]*?<\/rdf:Description>/g;

const XMLNS_RE = /\sxmlns(?::[A-Za-z_][\w.-]*)?=["']([^"']+)["']/g;

const declaredNamespaceUris = (description: string): string[] => {
  const openTagEnd = description.indexOf('>');
  const openTag =
    openTagEnd === -1 ? description : description.slice(0, openTagEnd + 1);
  const uris: string[] = [];
  XMLNS_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = XMLNS_RE.exec(openTag)) !== null) {
    uris.push(match[1]);
  }
  return uris;
};

const isOwnedDescription = (description: string): boolean => {
  const nss = declaredNamespaceUris(description).filter(
    (uri) => !STRUCTURAL_XMP_NAMESPACE_URIS.has(uri),
  );
  if (nss.length === 0) return false;
  return nss.every((uri) => OWNED_XMP_NAMESPACE_URIS.has(uri));
};

/**
 * Extract `rdf:Description` elements from an XMP packet that are *not* owned
 * by pdf-lib (e.g. Factur-X `fx:`, `pdfaExtension` schemas). Owned blocks are
 * omitted so they can be rebuilt from the Info dictionary.
 */
export const extractForeignXmpDescriptions = (xml: string): string[] => {
  const foreign: string[] = [];
  DESCRIPTION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DESCRIPTION_RE.exec(xml)) !== null) {
    if (!isOwnedDescription(match[0])) foreign.push(match[0]);
  }
  return foreign;
};

/**
 * Build an XMP metadata packet describing a PDF/A document. Every Info-mirrored
 * field that is present is written into owned `rdf:Description` blocks so the
 * two metadata sources stay consistent, as required by the PDF/A standard.
 *
 * Additional `extensions` fragments are appended unchanged.
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

  const extensions = info.extensions;
  if (extensions) {
    for (let idx = 0, len = extensions.length; idx < len; idx++) {
      const fragment = extensions[idx].trim();
      if (fragment.length > 0) descriptions.push(fragment);
    }
  }

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
