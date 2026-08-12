import {
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFObject,
  PDFString,
} from '../core';

const compareBytes = (left: Uint8Array, right: Uint8Array): number => {
  const length = Math.min(left.length, right.length);
  for (let idx = 0; idx < length; idx++) {
    if (left[idx] !== right[idx]) return left[idx] - right[idx];
  }
  return left.length - right.length;
};

const isNameTreeKey = (object: PDFObject): object is PDFString | PDFHexString =>
  object instanceof PDFString || object instanceof PDFHexString;

/**
 * True when `node` is a flat leaf name-tree node we can safely rewrite.
 * Returns false for `/Kids` trees (or nodes that already mix Kids + Names),
 * and for malformed `/Names` arrays — leave those PDFs untouched.
 */
export const isWritableFlatNameTree = (node: PDFDict): boolean => {
  if (node.has(PDFName.of('Kids'))) return false;

  if (!node.has(PDFName.of('Names'))) return true;

  const names = node.lookup(PDFName.of('Names'));
  if (!(names instanceof PDFArray) || names.size() % 2 !== 0) return false;

  for (let idx = 0, len = names.size(); idx < len; idx += 2) {
    if (!isNameTreeKey(names.get(idx))) return false;
  }

  return true;
};

/**
 * Sort a flat name-tree `/Names` array in place (PDF lexical / byte order).
 */
export const sortNameTreeNames = (names: PDFArray): void => {
  const pairCount = names.size() / 2;
  const pairs: Array<{ key: PDFString | PDFHexString; value: PDFObject }> = [];

  for (let idx = 0; idx < pairCount; idx++) {
    const keyIdx = idx * 2;
    pairs.push({
      key: names.lookup(keyIdx, PDFString, PDFHexString),
      value: names.get(keyIdx + 1),
    });
  }

  pairs.sort((a, b) => compareBytes(a.key.asBytes(), b.key.asBytes()));

  for (let idx = 0; idx < pairs.length; idx++) {
    names.set(idx * 2, pairs[idx].key);
    names.set(idx * 2 + 1, pairs[idx].value);
  }
};

const syncLimitsIfPresent = (node: PDFDict, names: PDFArray): void => {
  if (!node.has(PDFName.of('Limits')) || names.size() === 0) return;

  const limits = node.lookup(PDFName.of('Limits'));
  if (!(limits instanceof PDFArray) || limits.size() < 2) return;

  limits.set(0, names.get(0));
  limits.set(1, names.get(names.size() - 2));
};

/**
 * Append `key` / `value` to a flat name-tree node and re-sort `/Names`.
 *
 * @returns `true` if the entry was registered; `false` if the node uses
 * `/Kids` or another incompatible structure (left unchanged).
 */
export const addNameTreeEntry = (
  node: PDFDict,
  key: PDFString | PDFHexString,
  value: PDFObject,
): boolean => {
  if (!isWritableFlatNameTree(node)) return false;

  if (!node.has(PDFName.of('Names'))) {
    node.set(PDFName.of('Names'), node.context.obj([]));
  }

  const names = node.lookup(PDFName.of('Names'), PDFArray);
  names.push(key);
  names.push(value);
  sortNameTreeNames(names);
  syncLimitsIfPresent(node, names);

  return true;
};
