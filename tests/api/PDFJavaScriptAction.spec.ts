import { PDFHexString, PDFString } from '../../src/core';
import PDFDocument from '../../src/api/PDFDocument';
import PDFJavaScriptAction, {
  extractAdditionalActions,
} from '../../src/api/PDFJavaScriptAction';

describe('PDFJavaScriptAction', () => {
  it('can be created from a JavaScript action dictionary', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const actionDict = context.obj({
      Type: 'Action',
      S: 'JavaScript',
      JS: PDFHexString.fromText('console.println("Hello");'),
    });

    const ref = context.register(actionDict);
    const action = PDFJavaScriptAction.of(actionDict, pdfDoc, ref);

    expect(action).toBeInstanceOf(PDFJavaScriptAction);
    expect(action?.dict).toBe(actionDict);
    expect(action?.doc).toBe(pdfDoc);
    expect(action?.ref).toBe(ref);
  });

  it('returns undefined for non-JavaScript actions', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const actionDict = context.obj({
      Type: 'Action',
      S: 'SubmitForm',
      F: 'http://example.com/submit',
    });

    const action = PDFJavaScriptAction.of(actionDict, pdfDoc);

    expect(action).toBeUndefined();
  });

  it('can get script from PDFString', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const script = 'console.println("Test");';
    const actionDict = context.obj({
      S: 'JavaScript',
      JS: PDFString.of(script),
    });

    const action = PDFJavaScriptAction.of(actionDict, pdfDoc);
    expect(action?.getScript()).toBe(script);
  });

  it('can get script from PDFHexString', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const script = 'console.println("Test");';
    const actionDict = context.obj({
      S: 'JavaScript',
      JS: PDFHexString.fromText(script),
    });

    const action = PDFJavaScriptAction.of(actionDict, pdfDoc);
    expect(action?.getScript()).toBe(script);
  });

  it('can set script', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const actionDict = context.obj({
      S: 'JavaScript',
      JS: PDFString.of('old script'),
    });

    const action = PDFJavaScriptAction.of(actionDict, pdfDoc);
    expect(action?.getScript()).toBe('old script');

    action?.setScript('new script');
    expect(action?.getScript()).toBe('new script');
  });

  it('returns undefined when JS field is missing', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const actionDict = context.obj({
      S: 'JavaScript',
    });

    const action = PDFJavaScriptAction.of(actionDict, pdfDoc);
    expect(action?.getScript()).toBeUndefined();
  });

  it('can get script from a stream /JS value', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;
    const script = 'console.println("stream js");';

    const actionDict = context.obj({
      S: 'JavaScript',
      JS: context.stream(script),
    });

    const action = PDFJavaScriptAction.of(actionDict, pdfDoc);
    expect(action?.getScript()).toBe(script);
  });

  it('can get script from an indirect stream /JS value', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;
    const script = 'console.println("indirect stream js");';

    const streamRef = context.register(context.flateStream(script));
    const actionDict = context.obj({
      S: 'JavaScript',
      JS: streamRef,
    });

    const action = PDFJavaScriptAction.of(actionDict, pdfDoc);
    expect(action?.getScript()).toBe(script);
  });
});

describe('extractAdditionalActions', () => {
  it('can extract keystroke action', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const aaDict = context.obj({
      K: context.obj({
        S: 'JavaScript',
        JS: PDFString.of('keystroke script'),
      }),
    });

    const actions = extractAdditionalActions(aaDict, pdfDoc);

    expect(actions.keystroke).toBeInstanceOf(PDFJavaScriptAction);
    expect(actions.keystroke?.getScript()).toBe('keystroke script');
  });

  it('can extract format action', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const aaDict = context.obj({
      F: context.obj({
        S: 'JavaScript',
        JS: PDFString.of('format script'),
      }),
    });

    const actions = extractAdditionalActions(aaDict, pdfDoc);

    expect(actions.format).toBeInstanceOf(PDFJavaScriptAction);
    expect(actions.format?.getScript()).toBe('format script');
  });

  it('can extract validate action', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const aaDict = context.obj({
      V: context.obj({
        S: 'JavaScript',
        JS: PDFString.of('validate script'),
      }),
    });

    const actions = extractAdditionalActions(aaDict, pdfDoc);

    expect(actions.validate).toBeInstanceOf(PDFJavaScriptAction);
    expect(actions.validate?.getScript()).toBe('validate script');
  });

  it('can extract calculate action', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const aaDict = context.obj({
      C: context.obj({
        S: 'JavaScript',
        JS: PDFString.of('calculate script'),
      }),
    });

    const actions = extractAdditionalActions(aaDict, pdfDoc);

    expect(actions.calculate).toBeInstanceOf(PDFJavaScriptAction);
    expect(actions.calculate?.getScript()).toBe('calculate script');
  });

  it('can extract multiple actions', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const aaDict = context.obj({
      K: context.obj({
        S: 'JavaScript',
        JS: PDFString.of('keystroke'),
      }),
      F: context.obj({
        S: 'JavaScript',
        JS: PDFString.of('format'),
      }),
      V: context.obj({
        S: 'JavaScript',
        JS: PDFString.of('validate'),
      }),
      C: context.obj({
        S: 'JavaScript',
        JS: PDFString.of('calculate'),
      }),
    });

    const actions = extractAdditionalActions(aaDict, pdfDoc);

    expect(actions.keystroke?.getScript()).toBe('keystroke');
    expect(actions.format?.getScript()).toBe('format');
    expect(actions.validate?.getScript()).toBe('validate');
    expect(actions.calculate?.getScript()).toBe('calculate');
  });

  it('can extract actions from indirect references', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const actionDict = context.obj({
      S: 'JavaScript',
      JS: PDFString.of('referenced script'),
    });
    const actionRef = context.register(actionDict);

    const aaDict = context.obj({
      K: actionRef,
    });

    const actions = extractAdditionalActions(aaDict, pdfDoc);

    expect(actions.keystroke?.getScript()).toBe('referenced script');
  });

  it('can extract mouse actions', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const aaDict = context.obj({
      U: context.obj({ S: 'JavaScript', JS: PDFString.of('mouseUp') }),
      D: context.obj({ S: 'JavaScript', JS: PDFString.of('mouseDown') }),
      E: context.obj({ S: 'JavaScript', JS: PDFString.of('mouseEnter') }),
      X: context.obj({ S: 'JavaScript', JS: PDFString.of('mouseExit') }),
    });

    const actions = extractAdditionalActions(aaDict, pdfDoc);

    expect(actions.mouseUp?.getScript()).toBe('mouseUp');
    expect(actions.mouseDown?.getScript()).toBe('mouseDown');
    expect(actions.mouseEnter?.getScript()).toBe('mouseEnter');
    expect(actions.mouseExit?.getScript()).toBe('mouseExit');
  });

  it('can extract focus actions', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const aaDict = context.obj({
      Fo: context.obj({ S: 'JavaScript', JS: PDFString.of('focus') }),
      Bl: context.obj({ S: 'JavaScript', JS: PDFString.of('blur') }),
    });

    const actions = extractAdditionalActions(aaDict, pdfDoc);

    expect(actions.focus?.getScript()).toBe('focus');
    expect(actions.blur?.getScript()).toBe('blur');
  });

  it('can extract page actions', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const aaDict = context.obj({
      O: context.obj({ S: 'JavaScript', JS: PDFString.of('pageOpen') }),
    });

    const actions = extractAdditionalActions(aaDict, pdfDoc);

    expect(actions.pageOpen?.getScript()).toBe('pageOpen');
  });

  it('maps C to pageClose in page context', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const aaDict = context.obj({
      O: context.obj({ S: 'JavaScript', JS: PDFString.of('pageOpen') }),
      C: context.obj({ S: 'JavaScript', JS: PDFString.of('pageClose') }),
    });

    const actions = extractAdditionalActions(aaDict, pdfDoc, 'page');

    expect(actions.pageOpen?.getScript()).toBe('pageOpen');
    expect(actions.pageClose?.getScript()).toBe('pageClose');
    // In page context, C must not leak into the field-only `calculate` slot.
    expect(actions.calculate).toBeUndefined();
  });

  it('maps C to calculate in field context', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const aaDict = context.obj({
      C: context.obj({ S: 'JavaScript', JS: PDFString.of('calculate') }),
    });

    const actions = extractAdditionalActions(aaDict, pdfDoc, 'field');

    expect(actions.calculate?.getScript()).toBe('calculate');
    // In field context, C must not leak into the page-only `pageClose` slot.
    expect(actions.pageClose).toBeUndefined();
  });

  it('does not map a single C entry to both calculate and pageClose', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const aaDict = context.obj({
      C: context.obj({ S: 'JavaScript', JS: PDFString.of('script') }),
    });

    // Default (no context): C resolves to calculate only, never pageClose.
    const actions = extractAdditionalActions(aaDict, pdfDoc);

    expect(actions.calculate?.getScript()).toBe('script');
    expect(actions.pageClose).toBeUndefined();
  });

  it('returns empty object when no actions exist', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const aaDict = context.obj({});

    const actions = extractAdditionalActions(aaDict, pdfDoc);

    expect(Object.keys(actions).length).toBe(0);
  });

  it('ignores non-JavaScript actions', async () => {
    const pdfDoc = await PDFDocument.create();
    const context = pdfDoc.context;

    const aaDict = context.obj({
      K: context.obj({
        S: 'SubmitForm',
        F: 'http://example.com',
      }),
    });

    const actions = extractAdditionalActions(aaDict, pdfDoc);

    expect(actions.keystroke).toBeUndefined();
  });
});
