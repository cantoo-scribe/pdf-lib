import PDFArray from '../objects/PDFArray';
import PDFDict from '../objects/PDFDict';
import PDFHexString from '../objects/PDFHexString';
import PDFName from '../objects/PDFName';
import PDFRef from '../objects/PDFRef';
import PDFString from '../objects/PDFString';
import { assertIs } from '../../utils';

/** A document optional content group (OCG), commonly called a PDF "layer". */
export type PDFOptionalContentGroup = {
  /** Human-readable layer name (`/Name`). Empty when missing. */
  name: string;
  /** Whether the layer is on in the default configuration (`/OCProperties` `/D`). */
  visible: boolean;
  /** Indirect reference of the OCG dictionary. */
  ref: PDFRef;
};

/**
 * Visibility change for one or more optional content groups.
 * Provide `ref` and/or `name` (all groups with that name are updated).
 */
export type OptionalContentVisibilityUpdate = {
  name?: string;
  ref?: PDFRef;
  visible: boolean;
};

const decodeOcgName = (ocgDict: PDFDict): string => {
  const name = ocgDict.lookup(PDFName.of('Name'));
  return name instanceof PDFString || name instanceof PDFHexString
    ? name.decodeText()
    : '';
};

const refsIn = (array: PDFArray | undefined): Set<PDFRef> => {
  const refs = new Set<PDFRef>();
  if (!array) return refs;
  for (let idx = 0, len = array.size(); idx < len; idx++) {
    const entry = array.get(idx);
    if (entry instanceof PDFRef) refs.add(entry);
  }
  return refs;
};

/**
 * High-level access to `/OCProperties` (optional content / layers). Visibility
 * updates rewrite the default configuration (`/D`) `/ON` and `/OFF` arrays.
 */
class OptionalContentProperties {
  static fromDict = (dict: PDFDict) => new OptionalContentProperties(dict);

  /** @ignore */
  readonly dict: PDFDict;

  private constructor(dict: PDFDict) {
    this.dict = dict;
  }

  /** List `/OCGs` with default visibility from `/D`. */
  getGroups(): PDFOptionalContentGroup[] {
    const ocgs = this.dict.lookupMaybe(PDFName.of('OCGs'), PDFArray);
    if (!ocgs) return [];

    const dDict = this.dict.lookupMaybe(PDFName.of('D'), PDFDict);
    const on = refsIn(dDict?.lookupMaybe(PDFName.of('ON'), PDFArray));
    const off = refsIn(dDict?.lookupMaybe(PDFName.of('OFF'), PDFArray));
    // Default BaseState is ON (ISO 32000). Unchanged → treat as ON for `/D`.
    const baseOn =
      dDict?.lookupMaybe(PDFName.of('BaseState'), PDFName) !==
      PDFName.of('OFF');

    const groups: PDFOptionalContentGroup[] = [];
    for (let idx = 0, len = ocgs.size(); idx < len; idx++) {
      const ref = ocgs.get(idx);
      if (!(ref instanceof PDFRef)) continue;
      const ocgDict = this.dict.context.lookupMaybe(ref, PDFDict);
      if (!ocgDict) continue;
      groups.push({
        name: decodeOcgName(ocgDict),
        visible: on.has(ref) ? true : off.has(ref) ? false : baseOn,
        ref,
      });
    }
    return groups;
  }

  /** Set default visibility for the given groups (by `name` and/or `ref`). */
  setVisibility(updates: OptionalContentVisibilityUpdate[]): void {
    assertIs(updates, 'updates', [Array]);

    const groups = this.getGroups();
    if (groups.length === 0) {
      throw new Error('This document has no optional content groups');
    }

    const visibility = new Map(groups.map((g) => [g.ref, g.visible] as const));
    let matched = 0;

    for (const update of updates) {
      assertIs(update.visible, 'visible', ['boolean']);
      if (update.ref === undefined && update.name === undefined) {
        throw new Error(
          'Optional content visibility update must include a name and/or ref',
        );
      }
      for (const group of groups) {
        if (
          (update.ref !== undefined && group.ref === update.ref) ||
          (update.name !== undefined && group.name === update.name)
        ) {
          visibility.set(group.ref, update.visible);
          matched += 1;
        }
      }
    }

    if (matched === 0) {
      throw new Error('No matching optional content group found');
    }

    const { context } = this.dict;
    let dDict = this.dict.lookupMaybe(PDFName.of('D'), PDFDict);
    if (!dDict) {
      dDict = context.obj({});
      this.dict.set(PDFName.of('D'), dDict);
    }

    const onArray = context.obj([]);
    const offArray = context.obj([]);
    for (const group of groups) {
      (visibility.get(group.ref) ? onArray : offArray).push(group.ref);
    }

    dDict.set(PDFName.of('ON'), onArray);
    dDict.set(PDFName.of('OFF'), offArray);
    // All OCGs are listed explicitly; BaseState is irrelevant but ON is the
    // PDF default and keeps partial readers well-behaved.
    dDict.set(PDFName.of('BaseState'), PDFName.of('ON'));
  }
}

export default OptionalContentProperties;
