import PDFDocument from '../PDFDocument';
import { AttachmentOptions } from '../PDFDocumentOptions';
import { AFRelationship } from '../../core/embedders/FileEmbedder';
import {
  assertIs,
  assertIsOneOfOrUndefined,
  assertOrUndefined,
  toUint8Array,
  BinaryData,
} from '../../utils';

/**
 * Factur-X / ZUGFeRD 2.1+ profile advertised in `fx:ConformanceLevel`.
 * Must match the profile URN embedded in the invoice XML.
 */
export type FacturXConformanceLevel =
  | 'MINIMUM'
  | 'BASIC_WL'
  | 'BASIC'
  | 'EN 16931'
  | 'EXTENDED'
  | 'XRECHNUNG';

const FACTUR_X_CONFORMANCE_LEVELS: FacturXConformanceLevel[] = [
  'MINIMUM',
  'BASIC_WL',
  'BASIC',
  'EN 16931',
  'EXTENDED',
  'XRECHNUNG',
];

/**
 * Options for [[embedFacturX]].
 */
export interface EmbedFacturXOptions {
  /**
   * Filename of the embedded XML invoice. Defaults to `'factur-x.xml'`.
   * Must match `fx:DocumentFileName` (set automatically from this value).
   */
  fileName?: string;

  /**
   * Factur-X XML schema version advertised in XMP. Defaults to `'1.0'`.
   */
  version?: string;

  /**
   * Hybrid document type in capital letters. Defaults to `'INVOICE'`.
   */
  documentType?: string;

  /**
   * Factur-X / ZUGFeRD profile. Defaults to `'EN 16931'`.
   */
  conformanceLevel?: FacturXConformanceLevel;

  /**
   * Human-readable description of the attached file.
   */
  description?: string;

  /**
   * Associated-file relationship. Defaults to [[AFRelationship.Alternative]].
   * Some profiles expect [[AFRelationship.Data]] instead.
   */
  afRelationship?: AFRelationship;

  /**
   * Attachment creation / modification dates (forwarded to [[PDFDocument.attach]]).
   */
  creationDate?: Date;
  modificationDate?: Date;
}

/** Namespace URI for Factur-X / ZUGFeRD 2.1+ XMP properties (prefix `fx`). */
export const FACTUR_X_NAMESPACE_URI =
  'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#';

/**
 * Fixed PDF/A extension schema description for the Factur-X `fx` properties.
 * Required so PDF/A validators accept the custom metadata.
 *
 * Based on the PDFlib / Factur-X sample extension schema.
 */
export const FACTUR_X_EXTENSION_SCHEMA =
  '<rdf:Description rdf:about="" ' +
  'xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" ' +
  'xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" ' +
  'xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">' +
  '<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">' +
  '<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>' +
  `<pdfaSchema:namespaceURI>${FACTUR_X_NAMESPACE_URI}</pdfaSchema:namespaceURI>` +
  '<pdfaSchema:prefix>fx</pdfaSchema:prefix>' +
  '<pdfaSchema:property><rdf:Seq>' +
  '<rdf:li rdf:parseType="Resource">' +
  '<pdfaProperty:name>DocumentFileName</pdfaProperty:name>' +
  '<pdfaProperty:valueType>Text</pdfaProperty:valueType>' +
  '<pdfaProperty:category>external</pdfaProperty:category>' +
  '<pdfaProperty:description>name of the embedded XML invoice file</pdfaProperty:description>' +
  '</rdf:li>' +
  '<rdf:li rdf:parseType="Resource">' +
  '<pdfaProperty:name>DocumentType</pdfaProperty:name>' +
  '<pdfaProperty:valueType>Text</pdfaProperty:valueType>' +
  '<pdfaProperty:category>external</pdfaProperty:category>' +
  '<pdfaProperty:description>INVOICE</pdfaProperty:description>' +
  '</rdf:li>' +
  '<rdf:li rdf:parseType="Resource">' +
  '<pdfaProperty:name>Version</pdfaProperty:name>' +
  '<pdfaProperty:valueType>Text</pdfaProperty:valueType>' +
  '<pdfaProperty:category>external</pdfaProperty:category>' +
  '<pdfaProperty:description>The actual version of the Factur-X XML schema</pdfaProperty:description>' +
  '</rdf:li>' +
  '<rdf:li rdf:parseType="Resource">' +
  '<pdfaProperty:name>ConformanceLevel</pdfaProperty:name>' +
  '<pdfaProperty:valueType>Text</pdfaProperty:valueType>' +
  '<pdfaProperty:category>external</pdfaProperty:category>' +
  '<pdfaProperty:description>The conformance level of the embedded Factur-X data</pdfaProperty:description>' +
  '</rdf:li>' +
  '</rdf:Seq></pdfaSchema:property>' +
  '</rdf:li></rdf:Bag></pdfaExtension:schemas>' +
  '</rdf:Description>';

const escapeXML = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Build the `fx:` `rdf:Description` fragment for Factur-X / ZUGFeRD XMP.
 */
export const buildFacturXDescription = (options: {
  fileName: string;
  version: string;
  documentType: string;
  conformanceLevel: FacturXConformanceLevel;
}): string =>
  `<rdf:Description rdf:about="" xmlns:fx="${FACTUR_X_NAMESPACE_URI}">` +
  `<fx:DocumentType>${escapeXML(options.documentType)}</fx:DocumentType>` +
  `<fx:DocumentFileName>${escapeXML(options.fileName)}</fx:DocumentFileName>` +
  `<fx:Version>${escapeXML(options.version)}</fx:Version>` +
  `<fx:ConformanceLevel>${escapeXML(options.conformanceLevel)}</fx:ConformanceLevel>` +
  '</rdf:Description>';

/**
 * Embed a Factur-X / ZUGFeRD invoice XML into a PDF as a PDF/A-3 attachment
 * with the required XMP metadata.
 *
 * This helper:
 * 1. Converts the document to PDF/A-3B (OutputIntent, `/ID`, `pdfaid` XMP, …).
 * 2. Adds the Factur-X `fx:` properties and PDF/A extension schema to XMP.
 * 3. Attaches the invoice XML with an associated-file relationship.
 *
 * It does **not** generate or validate the Cross Industry Invoice XML — pass
 * a complete `factur-x.xml` (or equivalent) produced by your invoicing stack.
 * Drawn text must still use an **embedded** font for PDF/A compliance.
 *
 * For example:
 * ```js
 * import { PDFDocument, embedFacturX } from '@cantoo/pdf-lib'
 * import fontkit from '@pdf-lib/fontkit'
 *
 * const pdfDoc = await PDFDocument.create()
 * pdfDoc.registerFontkit(fontkit)
 * const font = await pdfDoc.embedFont(fontBytes)
 * // ... draw the human-readable invoice with `font` ...
 *
 * await embedFacturX(pdfDoc, invoiceXmlBytes, {
 *   conformanceLevel: 'EN 16931',
 * })
 *
 * const pdfBytes = await pdfDoc.save()
 * ```
 *
 * @param pdfDoc The document that will carry the hybrid invoice.
 * @param invoiceXml The Factur-X / ZUGFeRD XML bytes to embed.
 * @param options Embedding and XMP options.
 */
export const embedFacturX = async (
  pdfDoc: PDFDocument,
  invoiceXml: BinaryData,
  options: EmbedFacturXOptions = {},
): Promise<void> => {
  assertIs(pdfDoc, 'pdfDoc', [[PDFDocument, 'PDFDocument']]);
  assertIs(invoiceXml, 'invoiceXml', [
    'string',
    ArrayBuffer,
    'ArrayBufferView',
  ]);
  assertOrUndefined(options.fileName, 'options.fileName', ['string']);
  assertOrUndefined(options.version, 'options.version', ['string']);
  assertOrUndefined(options.documentType, 'options.documentType', ['string']);
  assertIsOneOfOrUndefined(
    options.conformanceLevel,
    'options.conformanceLevel',
    FACTUR_X_CONFORMANCE_LEVELS,
  );
  assertOrUndefined(options.description, 'options.description', ['string']);
  assertIsOneOfOrUndefined(
    options.afRelationship,
    'options.afRelationship',
    AFRelationship,
  );
  assertOrUndefined(options.creationDate, 'options.creationDate', [Date]);
  assertOrUndefined(options.modificationDate, 'options.modificationDate', [
    Date,
  ]);

  const {
    fileName = 'factur-x.xml',
    version = '1.0',
    documentType = 'INVOICE',
    conformanceLevel = 'EN 16931',
    description = 'Factur-X invoice data',
    afRelationship = AFRelationship.Alternative,
    creationDate,
    modificationDate,
  } = options;

  pdfDoc.convertToPDFA({
    conformance: '3B',
    extensions: [
      buildFacturXDescription({
        fileName,
        version,
        documentType,
        conformanceLevel,
      }),
      FACTUR_X_EXTENSION_SCHEMA,
    ],
  });

  const attachOptions: AttachmentOptions = {
    mimeType: 'text/xml',
    description,
    afRelationship,
    creationDate,
    modificationDate,
  };

  await pdfDoc.attach(toUint8Array(invoiceXml), fileName, attachOptions);
};
