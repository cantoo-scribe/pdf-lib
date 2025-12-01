import fs from 'fs';
import { PDFDocument } from 'src/index';

const toUint8Array = (buf: Buffer) => new Uint8Array(buf);

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
  });

  it('can modify XFA JavaScript', async () => {
    const pdfBytes = toUint8Array(fs.readFileSync(xfaPdfPath));
    const pdfDoc = await PDFDocument.load(pdfBytes, { preserveXFA: true });

    const originalScripts = pdfDoc.getXFAJavaScripts();
    const checkbox = originalScripts.find((s) => s.field === 'c1_01');

    expect(checkbox).toBeDefined();

    const newScript = 'console.println("Modified checkbox script");';
    const result = pdfDoc.setXFAJavaScript('c1_01', checkbox!.event, newScript);

    expect(result).toBe(true);

    // Verify the modification
    const modifiedScripts = pdfDoc.getXFAJavaScripts();
    const modifiedCheckbox = modifiedScripts.find(
      (s) =>
        s.field === 'c1_01' && s.script.includes('Modified checkbox script'),
    );

    expect(modifiedCheckbox).toBeDefined();
    expect(modifiedCheckbox!.script).toContain(newScript);
  });

  it('returns false when modifying non-existent field', async () => {
    const pdfBytes = toUint8Array(fs.readFileSync(xfaPdfPath));
    const pdfDoc = await PDFDocument.load(pdfBytes, { preserveXFA: true });

    const result = pdfDoc.setXFAJavaScript(
      'nonexistent',
      'event__click',
      'test',
    );

    expect(result).toBe(false);
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
