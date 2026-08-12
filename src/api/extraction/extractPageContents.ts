import PDFArray from '../../core/objects/PDFArray';
import PDFDict from '../../core/objects/PDFDict';
import PDFName from '../../core/objects/PDFName';
import PDFNumber from '../../core/objects/PDFNumber';
import PDFRawStream from '../../core/objects/PDFRawStream';
import PDFRef from '../../core/objects/PDFRef';
import PDFStream from '../../core/objects/PDFStream';
import PDFContext from '../../core/PDFContext';
import { decodePDFRawStream } from '../../core/streams/decode';
import PDFContentStream from '../../core/structures/PDFContentStream';
import PDFPageLeaf from '../../core/structures/PDFPageLeaf';
import CharCodes from '../../core/syntax/CharCodes';
import { TransformationMatrix, identityMatrix } from '../../types/matrix';
import { mergeIntoTypedArray } from '../../utils';
import { parseContentStream } from './ContentStreamParser';
import { FontDecoder, isStringOperand } from './FontDecoder';
import {
  PdfPathBuilder,
  cmykCss,
  grayCss,
  rgbCss,
} from './graphicsSvg';
import { extractImageBytes } from './imageBytes';
import {
  ContentStreamOperand,
  ContentStreamOperation,
  NameOperand,
  PdfAsset,
} from './types';

/** Same convention as `combineMatrix` in svg.ts: A × B */
const multiply = (
  [a, b, c, d, e, f]: TransformationMatrix,
  [a2, b2, c2, d2, e2, f2]: TransformationMatrix,
): TransformationMatrix => [
  a * a2 + c * b2,
  b * a2 + d * b2,
  a * c2 + c * d2,
  b * c2 + d * d2,
  a * e2 + c * f2 + e,
  b * e2 + d * f2 + f,
];

const cloneMatrix = (m: TransformationMatrix): TransformationMatrix => [
  m[0],
  m[1],
  m[2],
  m[3],
  m[4],
  m[5],
];

type GraphicsState = {
  ctm: TransformationMatrix;
  fill?: string;
  stroke?: string;
  lineWidth: number;
};

/**
 * Extract typed text, image, and vector graphics assets from a page's content streams.
 */
export const extractPageContents = (page: PDFPageLeaf): PdfAsset[] => {
  page.normalize();
  const { Contents, Resources } = page.normalizedEntries();
  if (!Contents) return [];

  const bytes = decodeContentsArray(Contents);
  const operations = parseContentStream(bytes);
  return walkOperations(
    operations,
    Resources,
    page.context,
    new Set(),
    identityMatrix,
  );
};

const decodeContentsArray = (contents: PDFArray): Uint8Array => {
  const newline = Uint8Array.of(CharCodes.Newline);
  const parts: Uint8Array[] = [];

  for (let idx = 0, len = contents.size(); idx < len; idx++) {
    const stream = contents.lookup(idx, PDFStream);
    parts.push(decodeStreamBytes(stream), newline);
  }

  return mergeIntoTypedArray(...parts);
};

const decodeStreamBytes = (stream: PDFStream): Uint8Array => {
  if (stream instanceof PDFRawStream) {
    return decodePDFRawStream(stream).decode();
  }
  if (stream instanceof PDFContentStream) {
    return stream.getUnencodedContents();
  }
  return stream.getContents();
};

type TextMeta = {
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
};

const walkOperations = (
  operations: ContentStreamOperation[],
  resources: PDFDict | undefined,
  context: PDFContext,
  visitedForms: Set<string>,
  initialCtm: TransformationMatrix,
): PdfAsset[] => {
  const assets: PdfAsset[] = [];
  const fontCache = new Map<string, FontDecoder>();

  let gs: GraphicsState = {
    ctm: cloneMatrix(initialCtm),
    lineWidth: 1,
  };
  const gsStack: GraphicsState[] = [];

  const path = new PdfPathBuilder();

  let textMatrix = cloneMatrix(identityMatrix);
  let textLineMatrix = cloneMatrix(identityMatrix);
  let leading = 0;

  let currentFont: FontDecoder | undefined;
  let fontSize = 0;
  let textBuffer = '';
  let textMeta: TextMeta | undefined;
  let inTextObject = false;

  const flushText = () => {
    if (textBuffer.length > 0 && textMeta) {
      const text = textBuffer;
      const meta = textMeta;
      assets.push({
        kind: 'text',
        getText: () => text,
        x: meta.x,
        y: meta.y,
        fontSize: meta.fontSize,
        fontFamily: meta.fontFamily,
      });
    }
    textBuffer = '';
    textMeta = undefined;
  };

  const textPosition = (): { x: number; y: number } => {
    const combined = multiply(textMatrix, gs.ctm);
    return { x: combined[4], y: combined[5] };
  };

  const captureTextMetaIfNeeded = () => {
    if (textMeta) return;
    const pos = textPosition();
    textMeta = {
      x: pos.x,
      y: pos.y,
      fontSize,
      fontFamily: currentFont?.fontFamily ?? 'Unknown',
    };
  };

  const resolveFont = (name: string): FontDecoder | undefined => {
    const cached = fontCache.get(name);
    if (cached) return cached;
    const fontDict = lookupResource(resources, 'Font', name, context);
    if (!(fontDict instanceof PDFDict)) return undefined;
    const decoder = FontDecoder.forFontDict(fontDict, context);
    fontCache.set(name, decoder);
    return decoder;
  };

  const appendText = (value: string) => {
    if (!value) return;
    captureTextMetaIfNeeded();
    textBuffer += value;
  };

  const paintPath = (opts: {
    fill?: boolean;
    stroke?: boolean;
    close?: boolean;
    evenOdd?: boolean;
  }) => {
    if (opts.close) path.closePath();
    if (path.isEmpty) {
      path.clear();
      return;
    }
    const result = path.paint(gs.ctm, {
      fill: opts.fill ? gs.fill ?? '#000000' : opts.stroke ? 'none' : undefined,
      stroke: opts.stroke ? gs.stroke ?? '#000000' : 'none',
      fillRule: opts.evenOdd ? 'evenodd' : undefined,
      lineWidth: gs.lineWidth,
    });
    path.clear();
    if (!result) return;
    const svg = result.svg;
    assets.push({
      kind: 'graphics',
      x: result.x,
      y: result.y,
      width: result.width,
      height: result.height,
      getSvg: () => svg,
    });
  };

  const num = (args: ContentStreamOperand[], i: number): number =>
    typeof args[i] === 'number' ? (args[i] as number) : 0;

  for (const op of operations) {
    switch (op.name) {
      case 'q':
        gsStack.push({
          ctm: cloneMatrix(gs.ctm),
          fill: gs.fill,
          stroke: gs.stroke,
          lineWidth: gs.lineWidth,
        });
        break;
      case 'Q': {
        const restored = gsStack.pop();
        gs = restored
          ? {
              ctm: cloneMatrix(restored.ctm),
              fill: restored.fill,
              stroke: restored.stroke,
              lineWidth: restored.lineWidth,
            }
          : { ctm: cloneMatrix(identityMatrix), lineWidth: 1 };
        break;
      }
      case 'cm': {
        const m = argsToMatrix(op.args);
        if (m) gs.ctm = multiply(gs.ctm, m);
        break;
      }
      case 'w':
        gs.lineWidth = num(op.args, 0);
        break;
      case 'rg':
        gs.fill = rgbCss(num(op.args, 0), num(op.args, 1), num(op.args, 2));
        break;
      case 'RG':
        gs.stroke = rgbCss(num(op.args, 0), num(op.args, 1), num(op.args, 2));
        break;
      case 'g':
        gs.fill = grayCss(num(op.args, 0));
        break;
      case 'G':
        gs.stroke = grayCss(num(op.args, 0));
        break;
      case 'k':
        gs.fill = cmykCss(
          num(op.args, 0),
          num(op.args, 1),
          num(op.args, 2),
          num(op.args, 3),
        );
        break;
      case 'K':
        gs.stroke = cmykCss(
          num(op.args, 0),
          num(op.args, 1),
          num(op.args, 2),
          num(op.args, 3),
        );
        break;

      case 'm':
        path.moveTo(num(op.args, 0), num(op.args, 1));
        break;
      case 'l':
        path.lineTo(num(op.args, 0), num(op.args, 1));
        break;
      case 'c':
        path.curveTo(
          num(op.args, 0),
          num(op.args, 1),
          num(op.args, 2),
          num(op.args, 3),
          num(op.args, 4),
          num(op.args, 5),
        );
        break;
      case 'v':
        path.curveV(
          num(op.args, 0),
          num(op.args, 1),
          num(op.args, 2),
          num(op.args, 3),
        );
        break;
      case 'y':
        path.curveY(
          num(op.args, 0),
          num(op.args, 1),
          num(op.args, 2),
          num(op.args, 3),
        );
        break;
      case 'h':
        path.closePath();
        break;
      case 're':
        path.rectangle(
          num(op.args, 0),
          num(op.args, 1),
          num(op.args, 2),
          num(op.args, 3),
        );
        break;

      case 'W':
      case 'W*':
        // Clip path — discarded on following `n`
        break;
      case 'n':
        path.clear();
        break;

      case 'f':
      case 'F':
        paintPath({ fill: true });
        break;
      case 'f*':
        paintPath({ fill: true, evenOdd: true });
        break;
      case 'S':
        paintPath({ stroke: true });
        break;
      case 's':
        paintPath({ stroke: true, close: true });
        break;
      case 'B':
        paintPath({ fill: true, stroke: true });
        break;
      case 'B*':
        paintPath({ fill: true, stroke: true, evenOdd: true });
        break;
      case 'b':
        paintPath({ fill: true, stroke: true, close: true });
        break;
      case 'b*':
        paintPath({ fill: true, stroke: true, close: true, evenOdd: true });
        break;

      case 'BT':
        inTextObject = true;
        textBuffer = '';
        textMeta = undefined;
        textMatrix = cloneMatrix(identityMatrix);
        textLineMatrix = cloneMatrix(identityMatrix);
        break;
      case 'ET':
        flushText();
        inTextObject = false;
        break;
      case 'Tf': {
        const fontArg = op.args[0];
        const sizeArg = op.args[1];
        if (isName(fontArg)) {
          currentFont = resolveFont(fontArg.value);
        }
        if (typeof sizeArg === 'number') {
          fontSize = sizeArg;
        }
        break;
      }
      case 'TL': {
        if (typeof op.args[0] === 'number') leading = op.args[0];
        break;
      }
      case 'Tm': {
        const m = argsToMatrix(op.args);
        if (m) {
          textMatrix = m;
          textLineMatrix = cloneMatrix(m);
        }
        break;
      }
      case 'Td': {
        const tx = typeof op.args[0] === 'number' ? op.args[0] : 0;
        const ty = typeof op.args[1] === 'number' ? op.args[1] : 0;
        textMatrix = multiply([1, 0, 0, 1, tx, ty], textLineMatrix);
        textLineMatrix = cloneMatrix(textMatrix);
        if (textBuffer.length > 0 && !textBuffer.endsWith('\n')) {
          textBuffer += '\n';
        }
        break;
      }
      case 'TD': {
        const tx = typeof op.args[0] === 'number' ? op.args[0] : 0;
        const ty = typeof op.args[1] === 'number' ? op.args[1] : 0;
        leading = -ty;
        textMatrix = multiply([1, 0, 0, 1, tx, ty], textLineMatrix);
        textLineMatrix = cloneMatrix(textMatrix);
        if (textBuffer.length > 0 && !textBuffer.endsWith('\n')) {
          textBuffer += '\n';
        }
        break;
      }
      case 'T*': {
        textMatrix = multiply([1, 0, 0, 1, 0, -leading], textLineMatrix);
        textLineMatrix = cloneMatrix(textMatrix);
        if (textBuffer.length > 0 && !textBuffer.endsWith('\n')) {
          textBuffer += '\n';
        }
        break;
      }
      case 'Tj':
      case "'":
      case '"': {
        if (op.name === "'" || op.name === '"') {
          textMatrix = multiply([1, 0, 0, 1, 0, -leading], textLineMatrix);
          textLineMatrix = cloneMatrix(textMatrix);
        }
        const strArg = op.name === '"' ? op.args[2] : op.args[0];
        if (isStringOperand(strArg) && currentFont) {
          appendText(currentFont.decode(strArg));
        }
        break;
      }
      case 'TJ': {
        const arr = op.args[0];
        if (Array.isArray(arr) && currentFont) {
          for (const item of arr) {
            if (isStringOperand(item)) {
              appendText(currentFont.decode(item));
            }
          }
        }
        break;
      }
      case 'Do': {
        flushText();
        path.clear();
        const nameArg = op.args[0];
        if (!isName(nameArg)) break;
        const xObject = lookupResource(
          resources,
          'XObject',
          nameArg.value,
          context,
        );
        if (!(xObject instanceof PDFStream)) break;

        const subtype = xObject.dict.lookup(PDFName.of('Subtype'));
        if (subtype === PDFName.of('Image')) {
          const image = extractImageBytes(xObject);
          if (image) {
            const { width, height, mimeType, bytes } = image;
            assets.push({
              kind: 'image',
              x: gs.ctm[4],
              y: gs.ctm[5],
              width,
              height,
              drawWidth: Math.hypot(gs.ctm[0], gs.ctm[1]),
              drawHeight: Math.hypot(gs.ctm[2], gs.ctm[3]),
              mimeType,
              getBytes: () => bytes.slice(),
            });
          }
        } else if (subtype === PDFName.of('Form')) {
          const refKey = formVisitKey(xObject, context);
          if (visitedForms.has(refKey)) break;
          visitedForms.add(refKey);

          const formResources =
            xObject.dict.lookupMaybe(PDFName.of('Resources'), PDFDict) ??
            resources;
          const formMatrix = readFormMatrix(xObject.dict);
          const formCtm = multiply(gs.ctm, formMatrix);
          const formBytes = decodeStreamBytes(xObject);
          const formOps = parseContentStream(formBytes);
          assets.push(
            ...walkOperations(
              formOps,
              formResources,
              context,
              visitedForms,
              formCtm,
            ),
          );
        }
        break;
      }
      default:
        break;
    }
  }

  if (inTextObject) flushText();

  return assets;
};

const argsToMatrix = (
  args: ContentStreamOperand[],
): TransformationMatrix | undefined => {
  if (
    args.length >= 6 &&
    typeof args[0] === 'number' &&
    typeof args[1] === 'number' &&
    typeof args[2] === 'number' &&
    typeof args[3] === 'number' &&
    typeof args[4] === 'number' &&
    typeof args[5] === 'number'
  ) {
    return [args[0], args[1], args[2], args[3], args[4], args[5]];
  }
  return undefined;
};

const readFormMatrix = (dict: PDFDict): TransformationMatrix => {
  const matrix = dict.lookup(PDFName.of('Matrix'));
  if (!(matrix instanceof PDFArray) || matrix.size() < 6) {
    return cloneMatrix(identityMatrix);
  }
  const values: number[] = [];
  for (let i = 0; i < 6; i++) {
    const n = matrix.lookup(i);
    values.push(n instanceof PDFNumber ? n.asNumber() : 0);
  }
  return values as TransformationMatrix;
};

const isName = (value: ContentStreamOperand): value is NameOperand =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (value as NameOperand).type === 'name';

const lookupResource = (
  resources: PDFDict | undefined,
  category: string,
  name: string,
  context: PDFContext,
): unknown => {
  if (!resources) return undefined;
  const categoryDict = resources.lookup(PDFName.of(category));
  if (!(categoryDict instanceof PDFDict)) return undefined;
  const value = categoryDict.get(PDFName.of(name));
  if (value instanceof PDFRef) return context.lookup(value);
  return value;
};

const formVisitKey = (stream: PDFStream, context: PDFContext): string => {
  const entries = context.enumerateIndirectObjects();
  for (let i = 0; i < entries.length; i++) {
    const [ref, obj] = entries[i];
    if (obj === stream) return `${ref.objectNumber}R${ref.generationNumber}`;
  }
  return `direct:${assetsIdentity(stream)}`;
};

const streamIds = new WeakMap<object, number>();
let nextStreamId = 1;
const assetsIdentity = (stream: object): number => {
  let id = streamIds.get(stream);
  if (id === undefined) {
    id = nextStreamId++;
    streamIds.set(stream, id);
  }
  return id;
};
