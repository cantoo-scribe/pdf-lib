import { Assets } from '../index.ts';
// @deno-types="../dummy.d.ts"
import {
  PDFArray,
  PDFDocument,
  PDFHexString,
  PDFInvalidObject,
  PDFName,
  PDFNumber,
  PDFString,
  rgb,
  StandardFonts,
} from '../../../dist/pdf-lib.esm.js';

/**
 * This test modifies the pdf adding a page and a placeholder for an electronic signature.
 * It also deletes the first page of the PDF.
 * The file should have an incremental update at the end, and the start of the file be exactly the original file.
 */
export default async (assets: Assets) => {
  const pdfDoc = await PDFDocument.load(assets.pdfs.simple, {
    forIncrementalUpdate: true,
  });
  const page = pdfDoc.addPage([500, 200]);
  pdfDoc.removePage(0);
  const font = pdfDoc.embedStandardFont(StandardFonts.Helvetica);
  const fontBold = pdfDoc.embedStandardFont(StandardFonts.HelveticaBoldOblique);
  const advertencia =
    '-- Esta nota es meramente informativa, no es la firma real del documento --';
  const usarLibreOffice =
    '-- Si su visor de PDF no incluye la función de validar firmas, puede utilizar "LibreOffice Draw" --';
  const tamLetra = 14;
  const tamAdvertencia = 10;
  let tw = font.widthOfTextAtSize('Electronic Signature Test #20', tamLetra);
  let lw = fontBold.widthOfTextAtSize(usarLibreOffice, tamAdvertencia);
  if (lw > tw) tw = lw;
  let th = font.heightAtSize(tamLetra);
  if (fontBold.heightAtSize(tamAdvertencia) > th) {
    th = fontBold.heightAtSize(tamAdvertencia);
  }
  th += 2;
  const stx = Math.trunc((page.getWidth() - tw) / 2);
  let curry = th * 4 + 20;
  page.drawRectangle({
    x: stx - 10,
    y: page.getHeight() - curry - 50,
    width: tw + 20,
    height: curry,
    borderWidth: 2,
    borderColor: rgb(0.45, 0.45, 0.45),
  });
  lw = font.widthOfTextAtSize('Electronic Signature Test #20', tamLetra);
  curry = page.getHeight() - th - 60;
  page.drawText('Electronic Signature Test #20', {
    x: stx + Math.round((tw - lw) / 2),
    y: curry,
    size: tamLetra,
    font,
  });
  const momento = new Date().toISOString();
  lw = font.widthOfTextAtSize(momento, tamLetra);
  curry -= th;
  page.drawText(momento, {
    x: stx + Math.round((tw - lw) / 2),
    y: curry,
    size: tamLetra,
    font,
  });
  lw = fontBold.widthOfTextAtSize(advertencia, tamAdvertencia);
  curry -= th;
  page.drawText(advertencia, {
    x: stx + Math.round((tw - lw) / 2),
    y: curry,
    size: tamAdvertencia,
    font: fontBold,
  });
  lw = fontBold.widthOfTextAtSize(usarLibreOffice, tamAdvertencia);
  curry -= th;
  page.drawText(usarLibreOffice, {
    x: stx + Math.round((tw - lw) / 2),
    y: curry,
    size: tamAdvertencia,
    font: fontBold,
  });

  // Add an AcroForm or update the existing one
  const acroForm = pdfDoc.catalog.getOrCreateAcroForm();

  // Create a placeholder where the the last 3 parameters of the
  // actual range will be replaced when signing is done.
  const byteRange = PDFArray.withContext(pdfDoc.context);
  byteRange.push(PDFNumber.of(0));
  byteRange.push(PDFName.of('*********'));
  byteRange.push(PDFName.of('*********'));
  byteRange.push(PDFName.of('*********'));

  // Fill the contents of the placeholder with 00s.
  const placeholder = PDFHexString.of(String.fromCharCode(0).repeat(8096));

  // Create a signature dictionary to be referenced in the signature widget.
  const appBuild = { App: { Name: 'Test #20' } };
  const signatureDict = pdfDoc.context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: byteRange,
    Contents: placeholder,
    Reason: PDFString.of('Test #20'),
    M: PDFString.fromDate(new Date()),
    ContactInfo: PDFString.of('dabdala@adnsistemas.com.ar'),
    Name: PDFString.of('David Abdala'),
    Location: PDFString.of('Mendoza, Argentina'),
    Prop_Build: {
      Filter: { Name: 'Adobe.PPKLite' },
      ...appBuild,
    },
  });
  // Register signatureDict as a PDFInvalidObject to prevent PDFLib from serializing it
  // in an object stream.
  const signatureBuffer = new Uint8Array(signatureDict.sizeInBytes());
  signatureDict.copyBytesInto(signatureBuffer, 0);
  const signatureObj = PDFInvalidObject.of(signatureBuffer);
  const signatureDictRef = pdfDoc.context.register(signatureObj);

  // Create the signature widget
  const widgetRect = [0, 0, 0, 0];
  const rect = PDFArray.withContext(pdfDoc.context);
  widgetRect.forEach((c) => rect.push(PDFNumber.of(c)));
  const apStream = pdfDoc.context.formXObject([], {
    BBox: widgetRect,
    Resources: {}, // Necessary to avoid Acrobat bug (see https://stackoverflow.com/a/73011571)
  });
  const widgetDict = pdfDoc.context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: rect,
    V: signatureDictRef,
    T: PDFString.of('TestSig'),
    TU: PDFString.of('Electronic Signature Test #20'),
    F: 2,
    P: page.ref,
    AP: { N: pdfDoc.context.register(apStream) }, // Required for PDF/A compliance
  });
  const widgetDictRef = pdfDoc.context.register(widgetDict);

  // Annotate the widget on the given page
  let annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (typeof annotations === 'undefined') {
    annotations = pdfDoc.context.obj([]);
  }
  annotations.push(widgetDictRef);
  page.node.set(PDFName.of('Annots'), annotations);

  let sigFlags: PDFNumber;
  if (acroForm.dict.has(PDFName.of('SigFlags'))) {
    // Already has some flags, will merge
    sigFlags = acroForm.dict.get(PDFName.of('SigFlags')) as PDFNumber;
  } else {
    // Create blank flags
    sigFlags = PDFNumber.of(0);
  }
  const updatedFlags = PDFNumber.of(sigFlags!.asNumber() | 1 | 2);
  acroForm.dict.set(PDFName.of('SigFlags'), updatedFlags);
  let fields = acroForm.dict.get(PDFName.of('Fields'));
  if (!(fields instanceof PDFArray)) {
    fields = pdfDoc.context.obj([]);
    acroForm.dict.set(PDFName.of('Fields'), fields);
  }
  (fields as PDFArray).push(widgetDictRef);
  return await pdfDoc.save({ useObjectStreams: false });
};
