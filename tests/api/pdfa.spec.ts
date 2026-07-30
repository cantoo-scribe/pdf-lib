import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import {
  buildPDFAMetadata,
  extractForeignXmpDescriptions,
  getDefaultSRGBProfile,
  parseConformance,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFString,
  rgb,
} from '../../src/index';

const ttfFont = fs.readFileSync('assets/fonts/nunito/Nunito-Regular.ttf');
const encryptedPdfBytes = fs.readFileSync('assets/pdfs/encrypted_new.pdf');

const buildDocument = async () => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle('The <Egg> & "Ampersand"');
  pdfDoc.setAuthor('Humpty Dumpty');
  pdfDoc.setSubject('A tale');
  pdfDoc.setKeywords(['egg', 'wall']);
  pdfDoc.setCreator('pdf-lib');
  pdfDoc.setCreationDate(new Date('2026-07-28T12:00:00Z'));
  pdfDoc.setModificationDate(new Date('2026-07-28T12:00:00Z'));
  const font = await pdfDoc.embedFont(ttfFont, { subset: true });
  const page = pdfDoc.addPage([300, 200]);
  page.drawText('Hello!', {
    x: 20,
    y: 100,
    size: 24,
    font,
    color: rgb(0, 0, 0),
  });
  return pdfDoc;
};

describe('parseConformance', () => {
  it('parses supported conformance levels', () => {
    expect(parseConformance('1B')).toEqual({ part: 1, level: 'B' });
    expect(parseConformance('2B')).toEqual({ part: 2, level: 'B' });
    expect(parseConformance('2U')).toEqual({ part: 2, level: 'U' });
    expect(parseConformance('3B')).toEqual({ part: 3, level: 'B' });
    expect(parseConformance('3U')).toEqual({ part: 3, level: 'U' });
  });

  it('throws for unsupported conformance levels', () => {
    // Level "A" (tagged) conformance cannot be produced automatically.
    expect(() => parseConformance('1A' as any)).toThrow(/Unsupported/);
    expect(() => parseConformance('4B' as any)).toThrow(/Unsupported/);
    expect(() => parseConformance('1U' as any)).toThrow(/Unsupported/);
  });
});

describe('buildPDFAMetadata', () => {
  it('embeds the pdfaid part and conformance level', () => {
    const xml = buildPDFAMetadata({ conformance: { part: 3, level: 'B' } });
    expect(xml).toContain('<pdfaid:part>3</pdfaid:part>');
    expect(xml).toContain('<pdfaid:conformance>B</pdfaid:conformance>');
  });

  it('escapes XML special characters in metadata values', () => {
    const xml = buildPDFAMetadata({
      conformance: { part: 1, level: 'B' },
      title: 'A <b> & "c"',
    });
    expect(xml).toContain('A &lt;b&gt; &amp; &quot;c&quot;');
    expect(xml).not.toContain('<b>');
  });

  it('omits fields that are not provided', () => {
    const xml = buildPDFAMetadata({ conformance: { part: 2, level: 'U' } });
    expect(xml).not.toContain('dc:title');
    expect(xml).not.toContain('xmp:CreateDate');
    expect(xml).toContain('<pdfaid:part>2</pdfaid:part>');
  });

  it('appends extension rdf:Description fragments', () => {
    const fx =
      '<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">' +
      '<fx:DocumentType>INVOICE</fx:DocumentType>' +
      '</rdf:Description>';
    const xml = buildPDFAMetadata({
      conformance: { part: 3, level: 'B' },
      extensions: [fx],
    });
    expect(xml).toContain('xmlns:fx=');
    expect(xml).toContain('<fx:DocumentType>INVOICE</fx:DocumentType>');
    expect(xml.indexOf('pdfaid:part')).toBeLessThan(xml.indexOf('xmlns:fx='));
  });
});

describe('extractForeignXmpDescriptions', () => {
  const ownedPacket = buildPDFAMetadata({
    conformance: { part: 3, level: 'B' },
    title: 'Hello',
  });

  const fxDescription =
    '<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">' +
    '<fx:DocumentType>INVOICE</fx:DocumentType>' +
    '<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>' +
    '</rdf:Description>';

  const extensionSchemaDescription =
    '<rdf:Description rdf:about="" ' +
    'xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" ' +
    'xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" ' +
    'xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">' +
    '<pdfaExtension:schemas><rdf:Bag/></pdfaExtension:schemas>' +
    '</rdf:Description>';

  it('returns no foreign descriptions for an owned-only packet', () => {
    expect(extractForeignXmpDescriptions(ownedPacket)).toEqual([]);
  });

  it('extracts fx and pdfaExtension descriptions as foreign', () => {
    const xml = buildPDFAMetadata({
      conformance: { part: 3, level: 'B' },
      extensions: [fxDescription, extensionSchemaDescription],
    });
    const foreign = extractForeignXmpDescriptions(xml);
    expect(foreign).toHaveLength(2);
    expect(foreign[0]).toContain('xmlns:fx=');
    expect(foreign[1]).toContain('pdfaExtension');
  });
});

describe('getDefaultSRGBProfile', () => {
  it('returns a valid ICC v2 sRGB profile', () => {
    const profile = getDefaultSRGBProfile();
    expect(profile).toBeInstanceOf(Uint8Array);
    expect(profile.length).toBe(3144);
    // 'acsp' signature marks a valid ICC profile.
    expect(String.fromCharCode(...profile.slice(36, 40))).toBe('acsp');
    // Profile major version 2.
    expect(profile[8]).toBe(2);
  });

  it('caches and returns the same instance', () => {
    expect(getDefaultSRGBProfile()).toBe(getDefaultSRGBProfile());
  });
});

describe('PDFDocument.convertToPDFA', () => {
  it('adds an output intent referencing an embedded ICC profile', async () => {
    const pdfDoc = await buildDocument();
    pdfDoc.convertToPDFA({ conformance: '3B' });

    const outputIntents = pdfDoc.catalog.lookup(
      PDFName.of('OutputIntents'),
      PDFArray,
    );
    expect(outputIntents.size()).toBe(1);
    const intent = outputIntents.lookup(0, PDFDict);
    expect(intent.lookup(PDFName.of('S'))).toBe(PDFName.of('GTS_PDFA1'));
    const profile = intent.lookup(
      PDFName.of('DestOutputProfile'),
    ) as PDFRawStream;
    expect(profile.dict.lookup(PDFName.of('N'), PDFNumber).asNumber()).toBe(3);
    expect(profile.asUint8Array().length).toBe(3144);
  });

  it('adds an uncompressed XMP metadata stream to the catalog', async () => {
    const pdfDoc = await buildDocument();
    pdfDoc.convertToPDFA({ conformance: '3B' });

    const metadata = pdfDoc.catalog.lookup(
      PDFName.of('Metadata'),
    ) as PDFRawStream;
    expect(metadata.dict.lookup(PDFName.of('Type'))).toBe(
      PDFName.of('Metadata'),
    );
    expect(metadata.dict.lookup(PDFName.of('Subtype'))).toBe(PDFName.of('XML'));
    // Must be uncompressed so it is readable without parsing the PDF.
    expect(metadata.dict.lookup(PDFName.of('Filter'))).toBeUndefined();
    const xml = Buffer.from(metadata.asUint8Array()).toString('utf8');
    expect(xml).toContain('<pdfaid:part>3</pdfaid:part>');
    // Info dict values are mirrored into the XMP packet.
    expect(xml).toContain('Humpty Dumpty');
    expect(xml).toContain('A tale');
  });

  it('encodes the XMP metadata stream as UTF-8', async () => {
    const pdfDoc = await buildDocument();
    pdfDoc.setTitle('Müller & Cie — Größenänderung');
    pdfDoc.convertToPDFA({ conformance: '3B' });

    const metadata = pdfDoc.catalog.lookup(
      PDFName.of('Metadata'),
    ) as PDFRawStream;
    const bytes = metadata.asUint8Array();

    // The U+FEFF in the xpacket's begin marker is encoded as a UTF-8 byte
    // order mark (EF BB BF), not the raw low byte (0xFF) that a per-char
    // encoding would have produced.
    const bom = bytes.indexOf(0xef);
    expect(bom).toBeGreaterThanOrEqual(0);
    expect(Array.from(bytes.slice(bom, bom + 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes).not.toContain(0xff);

    // Non-ASCII metadata survives the round trip through the stream.
    const xml = Buffer.from(bytes).toString('utf8');
    expect(xml).toContain('Müller &amp; Cie — Größenänderung');
  });

  it('adds a document ID to the trailer', async () => {
    const pdfDoc = await buildDocument();
    expect(
      pdfDoc.context.lookup(pdfDoc.context.trailerInfo.ID),
    ).toBeUndefined();
    pdfDoc.convertToPDFA({ conformance: '3B' });
    const id = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.ID, PDFArray);
    expect(id.size()).toBe(2);
    expect(id.lookup(0)).toBe(id.lookup(1));
  });

  it('preserves an existing document ID', async () => {
    const pdfDoc = await buildDocument();
    const existing = PDFString.of('preexisting-id');
    pdfDoc.context.trailerInfo.ID = pdfDoc.context.obj([existing, existing]);
    pdfDoc.convertToPDFA({ conformance: '3B' });
    const id = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.ID, PDFArray);
    expect(id.lookup(0, PDFString).asString()).toBe('preexisting-id');
  });

  it('sets the PDF version to 1.4 for part 1 and 1.7 for parts 2 and 3', async () => {
    const doc1 = await buildDocument();
    doc1.convertToPDFA({ conformance: '1B' });
    expect(doc1.context.header.getVersionString()).toBe('1.4');

    const doc2 = await buildDocument();
    doc2.convertToPDFA({ conformance: '2B' });
    expect(doc2.context.header.getVersionString()).toBe('1.7');
  });

  it('never uses object streams for PDF/A-1, even when rewriting', async () => {
    const pdfDoc = await buildDocument();
    pdfDoc.convertToPDFA({ conformance: '1B' });
    const bytes = await pdfDoc.save({ rewrite: true });
    const text = Buffer.from(bytes).toString('latin1');
    expect(text).not.toContain('/ObjStm');
    expect(text).toContain('%PDF-1.4');
  });

  it('accepts a custom ICC profile and color component count', async () => {
    const pdfDoc = await buildDocument();
    const custom = getDefaultSRGBProfile();
    pdfDoc.convertToPDFA({
      conformance: '3B',
      iccProfile: custom,
      colorComponents: 3,
      outputConditionIdentifier: 'Custom RGB',
    });
    const outputIntents = pdfDoc.catalog.lookup(
      PDFName.of('OutputIntents'),
      PDFArray,
    );
    const intent = outputIntents.lookup(0, PDFDict);
    expect(
      intent
        .lookup(PDFName.of('OutputConditionIdentifier'), PDFString)
        .asString(),
    ).toBe('Custom RGB');
  });

  it('throws for unsupported conformance levels', async () => {
    const pdfDoc = await buildDocument();
    expect(() => pdfDoc.convertToPDFA({ conformance: '1A' as any })).toThrow(
      /Unsupported/,
    );
  });

  it('throws when the document is encrypted', async () => {
    const pdfDoc = await PDFDocument.load(encryptedPdfBytes, {
      ignoreEncryption: true,
    });
    expect(() => pdfDoc.convertToPDFA({ conformance: '3B' })).toThrow(
      /must not be encrypted/,
    );
  });

  it('throws when encrypting a document after conversion', async () => {
    const pdfDoc = await buildDocument();
    pdfDoc.convertToPDFA({ conformance: '3B' });
    expect(() => pdfDoc.encrypt({ userPassword: 'secret' })).toThrow(
      /Cannot encrypt a PDF\/A document/,
    );
  });

  it('validates the option types', async () => {
    const pdfDoc = await buildDocument();
    expect(() =>
      pdfDoc.convertToPDFA({ iccProfile: 'not-bytes' as any }),
    ).toThrow(/options\.iccProfile/);
    expect(() => pdfDoc.convertToPDFA({ colorComponents: 2 as any })).toThrow(
      /options\.colorComponents/,
    );
    expect(() =>
      pdfDoc.convertToPDFA({ outputConditionIdentifier: 5 as any }),
    ).toThrow(/options\.outputConditionIdentifier/);
  });

  it('generates a 16-byte hexadecimal document ID', async () => {
    const pdfDoc = await buildDocument();
    pdfDoc.convertToPDFA({ conformance: '3B' });
    const id = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.ID, PDFArray);
    const value = (id.lookup(0) as PDFHexString).asBytes();
    expect(value.length).toBe(16);
  });

  it('refreshes XMP metadata on save after Info dict changes', async () => {
    const pdfDoc = await buildDocument();
    pdfDoc.convertToPDFA({ conformance: '3B' });
    pdfDoc.setTitle('Updated Title After Conversion');

    await pdfDoc.save();

    const metadata = pdfDoc.catalog.lookup(
      PDFName.of('Metadata'),
    ) as PDFRawStream;
    const xml = Buffer.from(metadata.asUint8Array()).toString('utf8');
    expect(xml).toContain('Updated Title After Conversion');
    expect(xml).not.toContain('The &lt;Egg&gt;');
  });

  it('accepts one-shot XMP extensions and preserves them across save', async () => {
    const fx =
      '<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">' +
      '<fx:DocumentType>INVOICE</fx:DocumentType>' +
      '<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>' +
      '<fx:Version>1.0</fx:Version>' +
      '<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>' +
      '</rdf:Description>';

    const pdfDoc = await buildDocument();
    pdfDoc.convertToPDFA({ conformance: '3B', extensions: [fx] });

    pdfDoc.setTitle('New Title After fx Inject');
    await pdfDoc.save();

    const metadata = pdfDoc.catalog.lookup(
      PDFName.of('Metadata'),
    ) as PDFRawStream;
    const xml = Buffer.from(metadata.asUint8Array()).toString('utf8');
    expect(xml).toContain('New Title After fx Inject');
    expect(xml).toContain('<fx:DocumentType>INVOICE</fx:DocumentType>');
    expect(xml).toContain(
      '<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>',
    );
    expect(xml).toContain('<pdfaid:part>3</pdfaid:part>');
    // Extensions are preserved once, not duplicated on each save.
    expect(xml.match(/xmlns:fx=/g)).toHaveLength(1);
  });
});
