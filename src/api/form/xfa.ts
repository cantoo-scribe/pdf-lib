import {
  parse as parseHtml,
  HTMLElement,
  NodeType,
} from 'node-html-better-parser';
import {
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFRawStream,
  PDFRef,
  PDFString,
  decodePDFRawStream,
  PDFName,
} from '../../core';
import { decodeXfaXml } from '../../utils';

export type XfaTemplatePacket = {
  xfa: PDFArray;
  templateIndex: number;
  streamRef: PDFRef | null;
  stream: PDFRawStream;
  xml: string;
};

export type XfaScriptEntry = {
  scriptNode: HTMLElement;
  field: string;
  event: string;
};

/**
 * Locate the XFA `template` packet on an AcroForm dictionary and decode it.
 * Only the array form of `/XFA` (alternating name/stream pairs) is supported.
 */
export const readXfaTemplatePacket = (
  acroFormDict: PDFDict,
): XfaTemplatePacket | null => {
  const context = acroFormDict.context;
  const xfaObj = acroFormDict.get(PDFName.of('XFA'));
  if (!xfaObj) return null;

  const xfa = xfaObj instanceof PDFRef ? context.lookup(xfaObj) : xfaObj;
  if (!(xfa instanceof PDFArray)) return null;

  for (let idx = 0; idx < xfa.size(); idx += 2) {
    const nameObj = xfa.get(idx);
    const streamObj = xfa.get(idx + 1);
    if (!nameObj || !streamObj) continue;

    let sectionName: string;
    if (nameObj instanceof PDFString) {
      sectionName = nameObj.asString();
    } else if (nameObj instanceof PDFHexString) {
      sectionName = nameObj.decodeText();
    } else {
      continue;
    }
    if (sectionName !== 'template') continue;

    const streamRef = streamObj instanceof PDFRef ? streamObj : null;
    const stream = streamRef ? context.lookup(streamRef) : streamObj;
    if (!(stream instanceof PDFRawStream)) continue;

    return {
      xfa,
      templateIndex: idx + 1,
      streamRef,
      stream,
      xml: decodeXfaXml(decodePDFRawStream(stream).decode()),
    };
  }

  return null;
};

export const parseXfaTemplate = (xml: string): HTMLElement =>
  parseHtml(xml, { script: true });

/**
 * Walk an XFA template tree. Tracks the enclosing `field` name and invokes
 * `visit` for every element so callers can collect scripts, signatures, etc.
 */
export const walkXfaTree = (
  node: HTMLElement,
  visit: (node: HTMLElement, field: string | undefined) => void,
  currentField?: string,
): void => {
  const tag = node.tagName?.toLowerCase();
  const fieldCtx =
    tag === 'field' ? (node.getAttribute('name') ?? undefined) : currentField;

  visit(node, fieldCtx);

  for (const child of node.childNodes) {
    if (child.nodeType === NodeType.ELEMENT_NODE) {
      walkXfaTree(child as HTMLElement, visit, fieldCtx);
    }
  }
};

export const collectXfaScripts = (root: HTMLElement): XfaScriptEntry[] => {
  const results: XfaScriptEntry[] = [];

  // Scripts also need the enclosing event name, so this walk tracks both
  // field and event (walkXfaTree only tracks field).
  const walk = (node: HTMLElement, field?: string, event?: string) => {
    const tag = node.tagName?.toLowerCase();
    let fieldCtx = field;
    let eventCtx = event;

    if (tag === 'field') {
      fieldCtx = node.getAttribute('name') ?? undefined;
      eventCtx = undefined;
    } else if (tag === 'event') {
      eventCtx = node.getAttribute('name') ?? undefined;
    } else if (tag === 'script' && fieldCtx && eventCtx) {
      results.push({ scriptNode: node, field: fieldCtx, event: eventCtx });
    }

    for (const child of node.childNodes) {
      if (child.nodeType === NodeType.ELEMENT_NODE) {
        walk(child as HTMLElement, fieldCtx, eventCtx);
      }
    }
  };

  walk(root);
  return results;
};

const collectXfaRefs = (node: HTMLElement): string[] => {
  const refs: string[] = [];
  for (const child of node.childNodes) {
    if (child.nodeType !== NodeType.ELEMENT_NODE) continue;
    const el = child as HTMLElement;
    if (el.tagName?.toLowerCase() !== 'ref') continue;
    const text = el.text?.trim();
    if (text) refs.push(text);
  }
  return refs;
};

export type XfaSignatureRaw = {
  field: string;
  manifestUse?: string;
  inlineRefs: string[];
};

export const collectXfaSignatures = (
  root: HTMLElement,
): { signatures: XfaSignatureRaw[]; manifests: Map<string, string[]> } => {
  const signatures: XfaSignatureRaw[] = [];
  const manifests = new Map<string, string[]>();

  walkXfaTree(root, (node, fieldCtx) => {
    const tag = node.tagName?.toLowerCase();
    if (tag === 'manifest') {
      const id = node.getAttribute('id');
      if (id) manifests.set(id, collectXfaRefs(node));
      return;
    }
    if (tag !== 'signature' || !fieldCtx) return;

    let manifestUse: string | undefined;
    const inlineRefs: string[] = [];
    for (const child of node.childNodes) {
      if (child.nodeType !== NodeType.ELEMENT_NODE) continue;
      const el = child as HTMLElement;
      if (el.tagName?.toLowerCase() !== 'manifest') continue;
      const use = el.getAttribute('use');
      if (use) manifestUse = use.replace(/^#/, '');
      const id = el.getAttribute('id');
      const refs = collectXfaRefs(el);
      if (id) manifests.set(id, refs);
      inlineRefs.push(...refs);
    }
    signatures.push({ field: fieldCtx, manifestUse, inlineRefs });
  });

  return { signatures, manifests };
};
