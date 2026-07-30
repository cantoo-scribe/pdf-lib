import fs from 'fs';
import { PDFDocument } from 'src/index';
import { PDFString, PDFName } from 'src/core';

const toUint8Array = (buf: Buffer) => new Uint8Array(buf);

/**
 * Build a minimal dynamic-XFA PDF whose template contains the provided XML.
 * The XFA array uses a `PDFString` section name ("template"), matching what
 * `getXFATemplateInfo` expects. The document is saved without object streams
 * for deterministic round-trips.
 */
async function buildXFAPdf(templateXml: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage();

  const context = (doc as any).context;
  const templateRef = context.register(context.stream(templateXml));

  const xfaArray = context.obj([]);
  xfaArray.push(PDFString.of('template'));
  xfaArray.push(templateRef);

  const acroForm = context.obj({});
  acroForm.set(PDFName.of('Fields'), context.obj([]));
  acroForm.set(PDFName.of('XFA'), xfaArray);
  acroForm.set(PDFName.of('SigFlags'), context.obj(3));

  const acroRef = context.register(acroForm);
  (doc as any).catalog.set(PDFName.of('AcroForm'), acroRef);

  return doc.save({ useObjectStreams: false });
}

/**
 * XFA template with a single signature field whose `<signature>` references a
 * sibling `<manifest>` (the ANAF "use + manifest id" style).
 */
const XFA_ONE_SIGNATURE = `<template xmlns="http://www.xfa.org/schema/template/3.0/">
  <subform name="form1">
    <manifest name="semnatura1" id="sig1-guid"><ref>form1.fieldA</ref><ref>form1.fieldB</ref></manifest>
    <field name="SignatureField1"><ui><signature type="PDF1.6"><manifest use="#sig1-guid"/></signature></ui><bind match="none"/></field>
  </subform>
</template>`;

/**
 * XFA template with multiple signature fields, each referencing its own
 * manifest, plus a non-signature field to ensure only signatures are returned.
 */
const XFA_MULTIPLE_SIGNATURES = `<template xmlns="http://www.xfa.org/schema/template/3.0/">
  <subform name="form1">
    <manifest name="semnatura1" id="sig1-guid"><ref>form1.fieldA</ref><ref>form1.fieldB</ref></manifest>
    <manifest name="semnatura2" id="sig2-guid"><ref>form1.fieldC</ref></manifest>
    <field name="PlainField"><ui><textEdit/></ui></field>
    <field name="SignatureField1"><ui><signature type="PDF1.6"><manifest use="#sig1-guid"/></signature></ui><bind match="none"/></field>
    <field name="SignatureField2"><ui><signature type="PDF1.6"><manifest use="#sig2-guid"/></signature></ui><bind match="none"/></field>
  </subform>
</template>`;

/**
 * Add an AcroForm signature field (FT /Sig) to a document and its first page.
 * pdf-lib does not expose a helper for creating signature fields, so we build
 * the field dictionary directly. Cryptographic signing is intentionally out of
 * scope (that lives outside pdf-lib).
 */
function addSignatureField(doc: PDFDocument, name: string): void {
  const context = (doc as any).context;
  const page = doc.getPage(0);

  const widget = context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    T: PDFString.of(name),
    Rect: [50, 50, 250, 100],
    F: 4,
  });
  const ref = context.register(widget);

  const form = doc.getForm();
  form.acroForm.addField(ref);
  form.acroForm.dict.set(PDFName.of('SigFlags'), context.obj(3));
  page.node.addAnnot(ref);
}

describe('PDFDocument - XFA JavaScript', () => {
  const xfaPdfPath = 'assets/pdfs/with_xfa_fields.pdf';

  it('can extract XFA JavaScript from template', async () => {
    const pdfBytes = toUint8Array(fs.readFileSync(xfaPdfPath));
    const pdfDoc = await PDFDocument.load(pdfBytes, { preserveXFA: true });

    const xfaScripts = pdfDoc.getXFAJavaScripts();

    expect(xfaScripts).toBeInstanceOf(Array);
    expect(xfaScripts.length).toBeGreaterThan(0);

    // Check structure of returned scripts
    xfaScripts.forEach((script) => {
      expect(script).toHaveProperty('field');
      expect(script).toHaveProperty('event');
      expect(script).toHaveProperty('script');
      expect(typeof script.field).toBe('string');
      expect(typeof script.event).toBe('string');
      expect(typeof script.script).toBe('string');
    });

    // Look for known checkbox fields
    const checkbox = xfaScripts.find((s) => s.field === 'c1_01');

    expect(checkbox).toBeDefined();
    expect(checkbox!.event).toBe('event__mouseUp');
    expect(checkbox!.script).toContain('getField');
  });

  it('returns empty array for non-XFA PDFs', async () => {
    const pdfDoc = await PDFDocument.create();
    const xfaScripts = pdfDoc.getXFAJavaScripts();

    expect(xfaScripts).toBeInstanceOf(Array);
    expect(xfaScripts.length).toBe(0);
    // Must not create an AcroForm as a side effect of the lookup.
    expect((pdfDoc as any).catalog.getAcroForm()).toBeUndefined();
  });

  it('throws for setXFAJavaScript without creating an AcroForm', async () => {
    const pdfDoc = await PDFDocument.create();

    expect(() =>
      pdfDoc.setXFAJavaScript('field', 'event__click', 'test();'),
    ).toThrow(/XFA form not found/);
    expect((pdfDoc as any).catalog.getAcroForm()).toBeUndefined();
  });

  it('can modify XFA JavaScript', async () => {
    const pdfBytes = toUint8Array(fs.readFileSync(xfaPdfPath));
    const pdfDoc = await PDFDocument.load(pdfBytes, { preserveXFA: true });

    const originalScripts = pdfDoc.getXFAJavaScripts();
    const checkbox = originalScripts.find((s) => s.field === 'c1_01');

    expect(checkbox).toBeDefined();

    const newScript = 'console.println("Modified checkbox script");';
    pdfDoc.setXFAJavaScript('c1_01', checkbox!.event, newScript);

    // Verify the modification
    const modifiedScripts = pdfDoc.getXFAJavaScripts();
    const modifiedCheckbox = modifiedScripts.find(
      (s) =>
        s.field === 'c1_01' && s.script.includes('Modified checkbox script'),
    );

    expect(modifiedCheckbox).toBeDefined();
    expect(modifiedCheckbox!.script).toContain(newScript);
  });

  it('throws when modifying non-existent field', async () => {
    const pdfBytes = toUint8Array(fs.readFileSync(xfaPdfPath));
    const pdfDoc = await PDFDocument.load(pdfBytes, { preserveXFA: true });

    expect(() =>
      pdfDoc.setXFAJavaScript('nonexistent', 'event__click', 'test'),
    ).toThrow('Script not found for field "nonexistent"');
  });

  it('preserves XFA structure after modification', async () => {
    const pdfBytes = toUint8Array(fs.readFileSync(xfaPdfPath));
    const pdfDoc = await PDFDocument.load(pdfBytes, { preserveXFA: true });

    const originalCount = pdfDoc.getXFAJavaScripts().length;

    pdfDoc.setXFAJavaScript('c1_01', 'event__mouseUp', 'test();');

    const modifiedCount = pdfDoc.getXFAJavaScripts().length;

    // Script count should remain the same
    expect(modifiedCount).toBe(originalCount);
  });

  it('can save and reload PDF with modified XFA JavaScript', async () => {
    const pdfBytes = toUint8Array(fs.readFileSync(xfaPdfPath));
    const pdfDoc = await PDFDocument.load(pdfBytes, { preserveXFA: true });

    const newScript = 'xfa.host.messageBox("Test modification");';
    pdfDoc.setXFAJavaScript('c1_01', 'event__mouseUp', newScript);

    const savedBytes = await pdfDoc.save();

    // Reload and verify
    const reloadedDoc = await PDFDocument.load(savedBytes, {
      preserveXFA: true,
    });
    const scripts = reloadedDoc.getXFAJavaScripts();
    const checkbox = scripts.find(
      (s) => s.field === 'c1_01' && s.script.includes('Test modification'),
    );

    expect(checkbox).toBeDefined();
    expect(checkbox!.script).toContain(newScript);
  });

  it('extracts scripts from multiple events on same field', async () => {
    const pdfBytes = toUint8Array(fs.readFileSync(xfaPdfPath));
    const pdfDoc = await PDFDocument.load(pdfBytes, { preserveXFA: true });

    const xfaScripts = pdfDoc.getXFAJavaScripts();

    // Group by field name
    const fieldScripts = new Map<string, number>();
    xfaScripts.forEach((script) => {
      const count = fieldScripts.get(script.field) || 0;
      fieldScripts.set(script.field, count + 1);
    });

    // Some fields may have multiple events (c1_01, c2_05, etc. have 2 event__mouseUp events)
    const multiEventFields = Array.from(fieldScripts.entries()).filter(
      ([_, count]) => count > 1,
    );

    expect(multiEventFields.length).toBeGreaterThan(0);
  });
});

describe('PDFDocument - XFA signature fields', () => {
  it('detects a single XFA signature field with its manifest refs', async () => {
    const bytes = await buildXFAPdf(XFA_ONE_SIGNATURE);
    const doc = await PDFDocument.load(bytes, { preserveXFA: true });

    const sigFields = doc.getForm().getXFASignatures();

    expect(sigFields).toHaveLength(1);
    expect(sigFields[0].field).toBe('SignatureField1');
    expect(sigFields[0].manifest).toBe('sig1-guid');
    expect(sigFields[0].refs).toEqual(['form1.fieldA', 'form1.fieldB']);
  });

  it('detects multiple XFA signature fields, ignoring non-signature fields', async () => {
    const bytes = await buildXFAPdf(XFA_MULTIPLE_SIGNATURES);
    const doc = await PDFDocument.load(bytes, { preserveXFA: true });

    const sigFields = doc.getForm().getXFASignatures();

    expect(sigFields).toHaveLength(2);
    const names = sigFields.map((s) => s.field).sort();
    expect(names).toEqual(['SignatureField1', 'SignatureField2']);

    const first = sigFields.find((s) => s.field === 'SignatureField1');
    const second = sigFields.find((s) => s.field === 'SignatureField2');
    expect(first!.refs).toEqual(['form1.fieldA', 'form1.fieldB']);
    expect(second!.refs).toEqual(['form1.fieldC']);
  });

  it('returns an empty array for XFA forms without signature fields', async () => {
    const pdfBytes = toUint8Array(
      fs.readFileSync('assets/pdfs/with_xfa_fields.pdf'),
    );
    const doc = await PDFDocument.load(pdfBytes, { preserveXFA: true });

    expect(doc.getForm().getXFASignatures()).toEqual([]);
  });

  it('returns an empty array for non-XFA documents', async () => {
    const doc = await PDFDocument.create();
    expect(doc.getForm().getXFASignatures()).toEqual([]);
  });

  it('surfaces XFA signature fields through PDFForm.getSignatureFields()', async () => {
    const bytes = await buildXFAPdf(XFA_MULTIPLE_SIGNATURES);
    const doc = await PDFDocument.load(bytes, { preserveXFA: true });

    const fields = doc.getForm().getSignatureFields();

    expect(fields).toHaveLength(2);
    fields.forEach((f) => {
      expect(f.source).toBe('xfa');
      expect(f.acroField).toBeUndefined();
      expect(Array.isArray(f.refs)).toBe(true);
    });
    // No AcroForm signature fields exist in a pure XFA document.
    expect(fields.filter((f) => f.source === 'acroform')).toHaveLength(0);
  });

  // Optional validation against a real (unshipped) XFA-with-signatures PDF,
  // e.g. an ANAF smart form. Skipped unless XFA_SIG_SAMPLE_PDF points to a file.
  const samplePath = process.env.XFA_SIG_SAMPLE_PDF;
  const maybeIt = samplePath && fs.existsSync(samplePath) ? it : it.skip;
  maybeIt('detects signature fields in a real XFA sample PDF', async () => {
    const bytes = toUint8Array(fs.readFileSync(samplePath as string));
    const doc = await PDFDocument.load(bytes, {
      preserveXFA: true,
      throwOnInvalidObject: false,
    });

    const sigFields = doc.getForm().getXFASignatures();
    expect(sigFields.length).toBeGreaterThan(0);
    sigFields.forEach((s) => {
      expect(typeof s.field).toBe('string');
      expect(s.field.length).toBeGreaterThan(0);
      expect(Array.isArray(s.refs)).toBe(true);
    });
  });
});

describe('PDFDocument - AcroForm signature detection (normal PDFs)', () => {
  it('detects an existing signature field in a normal PDF', async () => {
    const bytes = toUint8Array(
      fs.readFileSync('assets/pdfs/with_signature.pdf'),
    );
    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();

    const sigFields = form.getSignatureFields();
    expect(sigFields).toHaveLength(1);
    expect(sigFields[0].source).toBe('acroform');
    expect(sigFields[0].name).toBe('Signature1');
    expect(sigFields[0].acroField).toBeDefined();
  });

  it('detects a signature field among many fields in a form PDF', async () => {
    const bytes = toUint8Array(fs.readFileSync('assets/pdfs/sample_form.pdf'));
    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();

    const sigFields = form.getSignatureFields();
    expect(sigFields.length).toBeGreaterThanOrEqual(1);
    expect(sigFields.some((s) => s.name === 'EMPLOYEE SIGNATURE')).toBe(true);
  });

  it('reports no signatures for a normal PDF that has none', async () => {
    const bytes = toUint8Array(fs.readFileSync('assets/pdfs/normal.pdf'));
    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();

    expect(form.getSignatureFields()).toHaveLength(0);
  });

  it('adds a signature field to a normal PDF and detects it after reload', async () => {
    const bytes = toUint8Array(fs.readFileSync('assets/pdfs/normal.pdf'));
    const doc = await PDFDocument.load(bytes);

    expect(doc.getForm().getSignatureFields()).toHaveLength(0);

    addSignatureField(doc, 'Signature1');

    // Detected in-memory.
    const inMemory = doc.getForm().getSignatureFields();
    expect(inMemory).toHaveLength(1);
    expect(inMemory[0].name).toBe('Signature1');

    // Survives a save/reload round-trip.
    const saved = await doc.save();
    const reloaded = await PDFDocument.load(saved);
    const form = reloaded.getForm();

    const sigFields = form.getSignatureFields();
    expect(sigFields).toHaveLength(1);
    expect(sigFields[0].source).toBe('acroform');
    expect(sigFields[0].name).toBe('Signature1');
  });
});
