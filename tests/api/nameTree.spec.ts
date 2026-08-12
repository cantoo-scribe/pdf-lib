import {
  PDFArray,
  PDFContext,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFString,
} from '../../src/core';
import {
  addNameTreeEntry,
  isWritableFlatNameTree,
  sortNameTreeNames,
} from '../../src/api/nameTree';

const decodeNameKeys = (names: PDFArray): string[] => {
  const keys: string[] = [];
  for (let idx = 0, len = names.size(); idx < len; idx += 2) {
    keys.push(names.lookup(idx, PDFString, PDFHexString).decodeText());
  }
  return keys;
};

describe('nameTree helpers', () => {
  let context: PDFContext;

  beforeEach(() => {
    context = PDFContext.create();
  });

  describe('isWritableFlatNameTree()', () => {
    it('accepts empty nodes and flat Names arrays', () => {
      expect(isWritableFlatNameTree(context.obj({}))).toBe(true);
      expect(
        isWritableFlatNameTree(
          context.obj({
            Names: [
              PDFHexString.fromText('a'),
              context.register(context.obj({})),
            ],
          }),
        ),
      ).toBe(true);
    });

    it('rejects Kids trees and malformed Names', () => {
      const leafRef = context.register(context.obj({ Names: [] }));
      expect(isWritableFlatNameTree(context.obj({ Kids: [leafRef] }))).toBe(
        false,
      );
      expect(
        isWritableFlatNameTree(
          context.obj({
            Kids: [leafRef],
            Names: [],
          }),
        ),
      ).toBe(false);
      expect(
        isWritableFlatNameTree(
          context.obj({ Names: [PDFHexString.fromText('a')] }),
        ),
      ).toBe(false);
      expect(
        isWritableFlatNameTree(
          context.obj({ Names: [PDFName.of('NotAString'), 1] }),
        ),
      ).toBe(false);
    });
  });

  describe('sortNameTreeNames()', () => {
    it('sorts keys in PDF lexical order', () => {
      const names = context.obj([
        PDFHexString.fromText('2.jpg'),
        context.register(context.obj({})),
        PDFHexString.fromText('10.jpg'),
        context.register(context.obj({})),
        PDFHexString.fromText('1.jpg'),
        context.register(context.obj({})),
      ]) as PDFArray;

      sortNameTreeNames(names);

      expect(decodeNameKeys(names)).toEqual(['1.jpg', '10.jpg', '2.jpg']);
    });
  });

  describe('addNameTreeEntry()', () => {
    it('creates Names, appends, and keeps entries sorted', () => {
      const node = context.obj({}) as PDFDict;
      const refA = context.register(context.obj({}));
      const refB = context.register(context.obj({}));
      const refC = context.register(context.obj({}));

      expect(addNameTreeEntry(node, PDFHexString.fromText('2.jpg'), refA)).toBe(
        true,
      );
      expect(
        addNameTreeEntry(node, PDFHexString.fromText('10.jpg'), refB),
      ).toBe(true);
      expect(addNameTreeEntry(node, PDFHexString.fromText('1.jpg'), refC)).toBe(
        true,
      );

      const names = node.lookup(PDFName.of('Names'), PDFArray);
      expect(decodeNameKeys(names)).toEqual(['1.jpg', '10.jpg', '2.jpg']);
    });

    it('repairs an already-unsorted flat Names array', () => {
      const refZ = context.register(context.obj({}));
      const refA = context.register(context.obj({}));
      const node = context.obj({
        Names: [
          PDFHexString.fromText('zebra'),
          refZ,
          PDFHexString.fromText('alpha'),
          refA,
        ],
      }) as PDFDict;

      const refM = context.register(context.obj({}));
      expect(
        addNameTreeEntry(node, PDFHexString.fromText('middle'), refM),
      ).toBe(true);

      expect(
        decodeNameKeys(node.lookup(PDFName.of('Names'), PDFArray)),
      ).toEqual(['alpha', 'middle', 'zebra']);
    });

    it('updates Limits when present', () => {
      const refA = context.register(context.obj({}));
      const node = context.obj({
        Names: [PDFHexString.fromText('b'), refA],
        Limits: [PDFHexString.fromText('b'), PDFHexString.fromText('b')],
      }) as PDFDict;

      addNameTreeEntry(
        node,
        PDFHexString.fromText('a'),
        context.register(context.obj({})),
      );
      addNameTreeEntry(
        node,
        PDFHexString.fromText('c'),
        context.register(context.obj({})),
      );

      const limits = node.lookup(PDFName.of('Limits'), PDFArray);
      expect(limits.lookup(0, PDFHexString).decodeText()).toBe('a');
      expect(limits.lookup(1, PDFHexString).decodeText()).toBe('c');
    });

    it('leaves Kids trees unchanged', () => {
      const leaf = context.obj({
        Names: [
          PDFHexString.fromText('existing.txt'),
          context.register(context.obj({})),
        ],
      });
      const leafRef = context.register(leaf);
      const node = context.obj({ Kids: [leafRef] }) as PDFDict;

      expect(
        addNameTreeEntry(
          node,
          PDFHexString.fromText('new.txt'),
          context.register(context.obj({})),
        ),
      ).toBe(false);

      expect(node.has(PDFName.of('Kids'))).toBe(true);
      expect(node.has(PDFName.of('Names'))).toBe(false);
      expect(node.lookup(PDFName.of('Kids'), PDFArray).size()).toBe(1);
    });
  });
});
