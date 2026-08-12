import { parseContentStream } from '../../src/api/extraction/ContentStreamParser';
import { parseToUnicode } from '../../src/api/extraction/ToUnicode';
import { ContentStreamOperation } from '../../src/api/extraction/types';

describe('parseContentStream', () => {
  it('parses names, numbers, hex strings, and operators', () => {
    const bytes = new TextEncoder().encode(
      '/F1 12 Tf\nBT\n<48656C6C6F> Tj\nET\n',
    );
    const ops = parseContentStream(bytes);
    expect(ops.map((o: ContentStreamOperation) => o.name)).toEqual([
      'Tf',
      'BT',
      'Tj',
      'ET',
    ]);
    expect(ops[0].args[0]).toEqual({ type: 'name', value: 'F1' });
    expect(ops[0].args[1]).toBe(12);
    expect(ops[2].args[0]).toEqual({
      type: 'hexString',
      bytes: Uint8Array.of(0x48, 0x65, 0x6c, 0x6c, 0x6f),
    });
  });

  it('parses TJ arrays', () => {
    const bytes = new TextEncoder().encode('[(Hello) -20 (World)] TJ');
    const ops = parseContentStream(bytes);
    expect(ops).toHaveLength(1);
    expect(ops[0].name).toBe('TJ');
    const arr = ops[0].args[0] as unknown[];
    expect(arr).toHaveLength(3);
    expect(arr[1]).toBe(-20);
  });
});

describe('parseToUnicode', () => {
  it('parses bfchar entries', () => {
    const cmap = `
/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
1 begincodespacersange
<0000><FFFF>
endcodespacersange
2 beginbfchar
<0001> <0048>
<0002> <0065>
endbfchar
endcmap
`;
    const map = parseToUnicode(cmap);
    expect(map.get(1)).toBe('H');
    expect(map.get(2)).toBe('e');
  });

  it('parses bfrange offset form', () => {
    const cmap = `
1 beginbfrange
<0001> <0003> <0041>
endbfrange
`;
    const map = parseToUnicode(cmap);
    expect(map.get(1)).toBe('A');
    expect(map.get(2)).toBe('B');
    expect(map.get(3)).toBe('C');
  });
});
