import { PDFDocument, PDFName } from '../../../src/index';

describe('PDFField JavaScript Actions', () => {
  describe('getJavaScriptActions() method', () => {
    it('returns undefined when field has no JavaScript actions', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test');

      const actions = field.getJavaScriptActions();
      expect(actions).toBeUndefined();
    });

    it('can extract keystroke action', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test');
      const context = pdfDoc.context;

      // Manually add AA dictionary with keystroke action
      const aaDict = context.obj({
        K: context.obj({
          S: 'JavaScript',
          JS: 'event.change = event.change.toUpperCase();',
        }),
      });
      field.acroField.dict.set(PDFName.of('AA'), aaDict);

      const actions = field.getJavaScriptActions();

      expect(actions).toBeDefined();
      expect(actions?.keystroke).toBeDefined();
      expect(actions?.keystroke?.getScript()).toBe(
        'event.change = event.change.toUpperCase();',
      );
    });

    it('can extract format action', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test');
      const context = pdfDoc.context;

      const aaDict = context.obj({
        F: context.obj({
          S: 'JavaScript',
          JS: 'AFNumber_Format(2, 0, 0, 0, "$", true);',
        }),
      });
      field.acroField.dict.set(PDFName.of('AA'), aaDict);

      const actions = field.getJavaScriptActions();

      expect(actions?.format).toBeDefined();
      expect(actions?.format?.getScript()).toBe(
        'AFNumber_Format(2, 0, 0, 0, "$", true);',
      );
    });

    it('can extract validate action', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test');
      const context = pdfDoc.context;

      const aaDict = context.obj({
        V: context.obj({
          S: 'JavaScript',
          JS: 'if (event.value < 0) event.rc = false;',
        }),
      });
      field.acroField.dict.set(PDFName.of('AA'), aaDict);

      const actions = field.getJavaScriptActions();

      expect(actions?.validate).toBeDefined();
      expect(actions?.validate?.getScript()).toBe(
        'if (event.value < 0) event.rc = false;',
      );
    });

    it('can extract calculate action', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('total');
      const context = pdfDoc.context;

      const aaDict = context.obj({
        C: context.obj({
          S: 'JavaScript',
          JS: 'var a = this.getField("price").value; var b = this.getField("quantity").value; event.value = a * b;',
        }),
      });
      field.acroField.dict.set(PDFName.of('AA'), aaDict);

      const actions = field.getJavaScriptActions();

      expect(actions?.calculate).toBeDefined();
      expect(actions?.calculate?.getScript()).toContain('event.value = a * b');
    });

    it('can extract multiple actions from same field', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test');
      const context = pdfDoc.context;

      const aaDict = context.obj({
        K: context.obj({
          S: 'JavaScript',
          JS: 'keystroke script',
        }),
        F: context.obj({
          S: 'JavaScript',
          JS: 'format script',
        }),
        V: context.obj({
          S: 'JavaScript',
          JS: 'validate script',
        }),
        C: context.obj({
          S: 'JavaScript',
          JS: 'calculate script',
        }),
      });
      field.acroField.dict.set(PDFName.of('AA'), aaDict);

      const actions = field.getJavaScriptActions();

      expect(actions?.keystroke?.getScript()).toBe('keystroke script');
      expect(actions?.format?.getScript()).toBe('format script');
      expect(actions?.validate?.getScript()).toBe('validate script');
      expect(actions?.calculate?.getScript()).toBe('calculate script');
    });

    it('can extract mouse actions', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test');
      const context = pdfDoc.context;

      const aaDict = context.obj({
        U: context.obj({ S: 'JavaScript', JS: 'mouseUp' }),
        D: context.obj({ S: 'JavaScript', JS: 'mouseDown' }),
        E: context.obj({ S: 'JavaScript', JS: 'mouseEnter' }),
        X: context.obj({ S: 'JavaScript', JS: 'mouseExit' }),
      });
      field.acroField.dict.set(PDFName.of('AA'), aaDict);

      const actions = field.getJavaScriptActions();

      expect(actions?.mouseUp?.getScript()).toBe('mouseUp');
      expect(actions?.mouseDown?.getScript()).toBe('mouseDown');
      expect(actions?.mouseEnter?.getScript()).toBe('mouseEnter');
      expect(actions?.mouseExit?.getScript()).toBe('mouseExit');
    });

    it('can extract focus actions', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test');
      const context = pdfDoc.context;

      const aaDict = context.obj({
        Fo: context.obj({ S: 'JavaScript', JS: 'focus script' }),
        Bl: context.obj({ S: 'JavaScript', JS: 'blur script' }),
      });
      field.acroField.dict.set(PDFName.of('AA'), aaDict);

      const actions = field.getJavaScriptActions();

      expect(actions?.focus?.getScript()).toBe('focus script');
      expect(actions?.blur?.getScript()).toBe('blur script');
    });
  });

  describe('getAction() method', () => {
    it('returns undefined when field has no default action', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test');

      const action = field.getAction();
      expect(action).toBeUndefined();
    });

    it('can extract default JavaScript action', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test');
      const context = pdfDoc.context;

      const actionDict = context.obj({
        S: 'JavaScript',
        JS: 'console.println("Default action");',
      });
      field.acroField.dict.set(PDFName.of('A'), actionDict);

      const action = field.getAction();

      expect(action).toBeDefined();
      expect(action?.getScript()).toBe('console.println("Default action");');
    });

    it('returns undefined for non-JavaScript actions', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test');
      const context = pdfDoc.context;

      const actionDict = context.obj({
        S: 'SubmitForm',
        F: 'http://example.com/submit',
      });
      field.acroField.dict.set(PDFName.of('A'), actionDict);

      const action = field.getAction();
      expect(action).toBeUndefined();
    });

    it('handles action as indirect reference', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const field = form.createTextField('test');
      const context = pdfDoc.context;

      const actionDict = context.obj({
        S: 'JavaScript',
        JS: 'referenced action',
      });
      const actionRef = context.register(actionDict);
      field.acroField.dict.set(PDFName.of('A'), actionRef);

      const action = field.getAction();

      expect(action?.getScript()).toBe('referenced action');
    });
  });

  describe('Integration test - field with multiple scripts', () => {
    it('can extract all scripts from a complex form field', async () => {
      const pdfDoc = await PDFDocument.create();
      const form = pdfDoc.getForm();
      const taxField = form.createTextField('tax');
      const context = pdfDoc.context;

      // Add AA dictionary with multiple actions
      const aaDict = context.obj({
        K: context.obj({
          S: 'JavaScript',
          JS: 'if (event.willCommit) { event.value = event.value.replace(/[^0-9.]/g, ""); }',
        }),
        F: context.obj({
          S: 'JavaScript',
          JS: 'AFNumber_Format(2, 0, 0, 0, "$", true);',
        }),
        V: context.obj({
          S: 'JavaScript',
          JS: 'if (event.value < 0 || event.value > 100) { app.alert("Invalid tax amount"); event.rc = false; }',
        }),
        C: context.obj({
          S: 'JavaScript',
          JS: 'var subtotal = this.getField("subtotal").value; event.value = subtotal * 0.08;',
        }),
      });
      taxField.acroField.dict.set(PDFName.of('AA'), aaDict);

      // Add default action
      const defaultAction = context.obj({
        S: 'JavaScript',
        JS: 'console.println("Field changed");',
      });
      taxField.acroField.dict.set(PDFName.of('A'), defaultAction);

      const actions = taxField.getJavaScriptActions();
      const action = taxField.getAction();

      // Verify all scripts are extracted
      expect(actions).toBeDefined();
      expect(actions?.keystroke).toBeDefined();
      expect(actions?.format).toBeDefined();
      expect(actions?.validate).toBeDefined();
      expect(actions?.calculate).toBeDefined();
      expect(action).toBeDefined();

      // Verify script content
      expect(actions?.keystroke?.getScript()).toContain('event.value.replace');
      expect(actions?.format?.getScript()).toContain('AFNumber_Format');
      expect(actions?.validate?.getScript()).toContain('app.alert');
      expect(actions?.calculate?.getScript()).toContain('subtotal * 0.08');
      expect(action?.getScript()).toBe('console.println("Field changed");');
    });
  });
});
