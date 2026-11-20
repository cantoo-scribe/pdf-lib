import fs from 'fs';
import {
  PDFDocument,
  TextAlignment,
  AnnotationFlags,
} from '../../../src/index';

const fancyFieldsPdfBytes = fs.readFileSync('assets/pdfs/fancy_fields.pdf');

describe('PDFTextField', () => {
  it('can read its value', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);

    const form = pdfDoc.getForm();

    const prefix = form.getTextField('Prefix ⚽️');
    const firstName = form.getTextField('First Name 🚀');
    const middleInitial = form.getTextField('MiddleInitial 🎳');
    const lastName = form.getTextField('LastName 🛩');

    expect(prefix.getText()).toEqual('Ms.');
    expect(firstName.getText()).toEqual('Cedar');
    expect(middleInitial.getText()).toEqual('M');
    expect(lastName.getText()).toEqual('Lightningtwirls');
  });

  it('can read its alignment', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);

    const form = pdfDoc.getForm();

    const prefix = form.getTextField('Prefix ⚽️');
    const firstName = form.getTextField('First Name 🚀');
    const middleInitial = form.getTextField('MiddleInitial 🎳');
    const lastName = form.getTextField('LastName 🛩');

    expect(prefix.getAlignment()).toEqual(TextAlignment.Center);
    expect(firstName.getAlignment()).toEqual(TextAlignment.Left);
    expect(middleInitial.getAlignment()).toEqual(TextAlignment.Center);
    expect(lastName.getAlignment()).toEqual(TextAlignment.Right);
  });

  it('can write a value', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);

    const form = pdfDoc.getForm();

    const prefix = form.getTextField('Prefix ⚽️');
    const firstName = form.getTextField('First Name 🚀');
    const middleInitial = form.getTextField('MiddleInitial 🎳');
    const lastName = form.getTextField('LastName 🛩');

    prefix.setText('Some boats 🚤');
    firstName.setText('Chili peppers 🌶');
    middleInitial.setText('Pineapplez 🍍');
    lastName.setText('And christmas trees! 🎄');

    expect(prefix.getText()).toEqual('Some boats 🚤');
    expect(firstName.getText()).toEqual('Chili peppers 🌶');
    expect(middleInitial.getText()).toEqual('Pineapplez 🍍');
    expect(lastName.getText()).toEqual('And christmas trees! 🎄');
  });

  it('can read its flag states', async () => {
    const pdfDoc = await PDFDocument.load(fancyFieldsPdfBytes);
    const form = pdfDoc.getForm();
    const prefix = form.getTextField('Prefix ⚽️');

    expect(prefix.isExported()).toBe(true);
    expect(prefix.isReadOnly()).toBe(false);
    expect(prefix.isRequired()).toBe(false);
    expect(prefix.isFileSelector()).toBe(false);
    expect(prefix.isMultiline()).toBe(false);
    expect(prefix.isPassword()).toBe(false);
    expect(prefix.isRichFormatted()).toBe(false);
    expect(prefix.isScrollable()).toBe(true);
    expect(prefix.isSpellChecked()).toBe(true);
    expect(prefix.isCombed()).toBe(false);
  });

  it('throws an error when setting text that exceeds the max length', async () => {
    const pdfDoc = await PDFDocument.create();
    const form = pdfDoc.getForm();
    const textField = form.createTextField('foo.bar');

    textField.setMaxLength(5);
    expect(() => textField.setText('abcde')).not.toThrow();
    expect(() => textField.setText('abcdef')).toThrow();
  });

  it('throws an error when setting a max length less than the text length', async () => {
    const pdfDoc = await PDFDocument.create();
    const form = pdfDoc.getForm();
    const textField = form.createTextField('foo.bar');

    textField.setText('abcdef');
    expect(() => textField.setMaxLength(undefined)).not.toThrow();
    expect(() => textField.setMaxLength(6)).not.toThrow();
    expect(() => textField.setMaxLength(7)).not.toThrow();
    expect(() => textField.setMaxLength(5)).toThrow();
  });

  it('produces printable widgets when added to a page', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const form = pdfDoc.getForm();

    const textField = form.createTextField('a.new.text.field');

    const widgets = () => textField.acroField.getWidgets();
    expect(widgets().length).toBe(0);

    textField.addToPage(page);
    expect(widgets().length).toBe(1);
    expect(widgets()[0].hasFlag(AnnotationFlags.Print)).toBe(true);
  });

  it('writes a default appearance without an empty first line', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const textField = pdfDoc.getForm().createTextField('a.new.text.field');
    textField.addToPage(page);

    const da = textField.acroField.getDefaultAppearance();
    expect(da?.startsWith('0 0 0 rg\n')).toBe(true);
  });

  it('sets page reference when added to a page', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const form = pdfDoc.getForm();

    const textField = form.createTextField('a.new.text.field');

    const widgets = () => textField.acroField.getWidgets();
    expect(widgets().length).toBe(0);

    textField.addToPage(page);
    expect(widgets().length).toBe(1);
    expect(widgets()[0].P()).toBe(page.ref);
  });

  it("sets the 'hidden' flag when passed options.hidden", async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const form = pdfDoc.getForm();

    const textField = form.createTextField('a.hidden.text.field');
    const widgets = () => textField.acroField.getWidgets();

    textField.addToPage(page, { hidden: true });

    expect(widgets().length).toBe(1);
    expect(widgets()[0].hasFlag(AnnotationFlags.Hidden)).toBe(true);
  });
});
