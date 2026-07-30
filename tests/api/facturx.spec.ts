import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import {
  AFRelationship,
  buildFacturXDescription,
  embedFacturX,
  FACTUR_X_EXTENSION_SCHEMA,
  PDFDocument,
  PDFName,
  PDFRawStream,
  rgb,
} from '../../src/index';

const ttfFont = fs.readFileSync('assets/fonts/nunito/Nunito-Regular.ttf');

const minimalInvoiceXml = Buffer.from(
  `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">` +
    `<rsm:ExchangedDocument><ram:ID xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100">TEST-1</ram:ID></rsm:ExchangedDocument>` +
    `</rsm:CrossIndustryInvoice>`,
);

describe('buildFacturXDescription', () => {
  it('builds the fx rdf:Description with escaped values', () => {
    const xml = buildFacturXDescription({
      fileName: 'factur-x.xml',
      version: '1.0',
      documentType: 'INVOICE',
      conformanceLevel: 'EN 16931',
    });
    expect(xml).toContain('xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"');
    expect(xml).toContain('<fx:DocumentType>INVOICE</fx:DocumentType>');
    expect(xml).toContain('<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>');
    expect(xml).toContain('<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>');
  });
});

describe('FACTUR_X_EXTENSION_SCHEMA', () => {
  it('declares the Factur-X PDF/A extension schema', () => {
    expect(FACTUR_X_EXTENSION_SCHEMA).toContain('pdfaExtension:schemas');
    expect(FACTUR_X_EXTENSION_SCHEMA).toContain(
      'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#',
    );
    expect(FACTUR_X_EXTENSION_SCHEMA).toContain(
      '<pdfaProperty:name>DocumentFileName</pdfaProperty:name>',
    );
    expect(FACTUR_X_EXTENSION_SCHEMA).toContain(
      '<pdfaProperty:name>ConformanceLevel</pdfaProperty:name>',
    );
  });
});

describe('embedFacturX', () => {
  it('converts to PDF/A-3B, attaches the XML, and writes fx XMP', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(ttfFont, { subset: true });
    const page = pdfDoc.addPage([300, 200]);
    page.drawText('Invoice', { x: 20, y: 100, size: 24, font, color: rgb(0, 0, 0) });
    pdfDoc.setTitle('Invoice TEST-1');
    pdfDoc.setAuthor('ACME GmbH');

    await embedFacturX(pdfDoc, minimalInvoiceXml, {
      conformanceLevel: 'BASIC',
    });

    const attachments = pdfDoc.getAttachments();
    expect(attachments).toHaveLength(1);
    expect(attachments[0].name).toBe('factur-x.xml');
    expect(attachments[0].mimeType).toBe('text/xml');
    expect(attachments[0].afRelationship).toBe(AFRelationship.Alternative);

    pdfDoc.setSubject('Updated after embed');
    await pdfDoc.save();

    const metadata = pdfDoc.catalog.lookup(
      PDFName.of('Metadata'),
    ) as PDFRawStream;
    const xml = Buffer.from(metadata.asUint8Array()).toString('utf8');
    expect(xml).toContain('<pdfaid:part>3</pdfaid:part>');
    expect(xml).toContain('<pdfaid:conformance>B</pdfaid:conformance>');
    expect(xml).toContain('<fx:DocumentType>INVOICE</fx:DocumentType>');
    expect(xml).toContain('<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>');
    expect(xml).toContain('<fx:ConformanceLevel>BASIC</fx:ConformanceLevel>');
    expect(xml).toContain('pdfaExtension:schemas');
    expect(xml).toContain('Updated after embed');
    expect(xml.match(/xmlns:fx=/g)).toHaveLength(1);
    expect(pdfDoc.context.header.getVersionString()).toBe('1.7');
  });

  it('rejects unsupported conformance levels', async () => {
    const pdfDoc = await PDFDocument.create();
    await expect(
      embedFacturX(pdfDoc, minimalInvoiceXml, {
        conformanceLevel: 'COMFORT' as any,
      }),
    ).rejects.toThrow(/conformanceLevel/);
  });
});
