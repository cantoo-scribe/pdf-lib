import PDFCatalog from '../../core/structures/PDFCatalog';
import PDFName from '../../core/objects/PDFName';
import PDFRawStream from '../../core/objects/PDFRawStream';
import { decodePDFRawStream } from '../../core/streams/decode';
import { ParsedConformance } from './PDFAConformance';
import { parsePDFAConformanceFromXmp } from './xmp';

/**
 * Decode the catalog `/Metadata` stream as UTF-8 XML, if present and readable.
 */
export const readCatalogMetadataXml = (
  catalog: PDFCatalog,
): string | undefined => {
  try {
    const meta = catalog.lookup(PDFName.of('Metadata'));
    if (!(meta instanceof PDFRawStream)) return undefined;
    const bytes = decodePDFRawStream(meta).decode();
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return undefined;
  }
};

/**
 * Read `pdfaid` part/level from catalog XMP, if declared and supported.
 */
export const readCatalogPDFAConformance = (
  catalog: PDFCatalog,
): ParsedConformance | undefined => {
  const xml = readCatalogMetadataXml(catalog);
  return xml ? parsePDFAConformanceFromXmp(xml) : undefined;
};
