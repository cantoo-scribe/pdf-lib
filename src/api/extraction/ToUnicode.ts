import { arrayAsString } from '../../utils';

/**
 * Parse a ToUnicode CMap (as decoded stream bytes / string) into a map from
 * character code (number) to Unicode string.
 *
 * Supports `beginbfchar` / `endbfchar` and `beginbfrange` / `endbfrange`
 * (both destination-offset and array forms).
 */
export const parseToUnicode = (
  data: Uint8Array | string,
): Map<number, string> => {
  const text = typeof data === 'string' ? data : arrayAsString(data);
  const map = new Map<number, string>();

  // bfchar: <src> <dst>
  const bfcharRe = /(\d+)\s+beginbfchar([\s\S]*?)endbfchar/g;
  let match: RegExpExecArray | null;
  while ((match = bfcharRe.exec(text))) {
    const body = match[2];
    const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let pair: RegExpExecArray | null;
    while ((pair = pairRe.exec(body))) {
      const src = parseInt(pair[1], 16);
      map.set(src, hexToUnicodeString(pair[2]));
    }
  }

  // bfrange: <srcLow> <srcHigh> <dstLow>  OR  <srcLow> <srcHigh> [<dst> ...]
  const bfrangeRe = /(\d+)\s+beginbfrange([\s\S]*?)endbfrange/g;
  while ((match = bfrangeRe.exec(text))) {
    const body = match[2];
    // Array form first
    const arrayRangeRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([^\]]*)\]/g;
    let range: RegExpExecArray | null;
    const consumedSpans: Array<{ start: number; end: number }> = [];
    while ((range = arrayRangeRe.exec(body))) {
      consumedSpans.push({
        start: range.index,
        end: range.index + range[0].length,
      });
      const low = parseInt(range[1], 16);
      const high = parseInt(range[2], 16);
      const dests = [...range[3].matchAll(/<([0-9A-Fa-f]+)>/g)].map(
        (m) => m[1],
      );
      for (
        let code = low, i = 0;
        code <= high && i < dests.length;
        code++, i++
      ) {
        map.set(code, hexToUnicodeString(dests[i]));
      }
    }

    // Offset form: <low> <high> <dstLow>
    const offsetRangeRe =
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    while ((range = offsetRangeRe.exec(body))) {
      const inArray = consumedSpans.some(
        (s) => range!.index >= s.start && range!.index < s.end,
      );
      if (inArray) continue;
      const low = parseInt(range[1], 16);
      const high = parseInt(range[2], 16);
      let dst = parseInt(range[3], 16);
      for (let code = low; code <= high; code++) {
        map.set(code, codePointToString(dst));
        dst++;
      }
    }
  }

  return map;
};

/**
 * Infer bytes-per-character-code from a ToUnicode CMap codespacersange, defaulting
 * to 1 (or 2 if any mapping key needs two bytes).
 */
export const inferCodeByteLength = (
  cmapText: string,
  mapping: Map<number, string>,
): number => {
  const spaceMatch =
    /begincodespacersange\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/i.exec(
      cmapText,
    );
  if (spaceMatch) {
    return Math.ceil(spaceMatch[1].length / 2);
  }
  let maxKey = 0;
  for (const key of mapping.keys()) {
    if (key > maxKey) maxKey = key;
  }
  return maxKey > 0xff ? 2 : 1;
};

const hexToUnicodeString = (hex: string): string => {
  // Pad to even length
  const h = hex.length % 2 === 1 ? '0' + hex : hex;
  // UTF-16BE code units
  let out = '';
  for (let i = 0; i < h.length; i += 4) {
    if (i + 4 <= h.length) {
      const unit = parseInt(h.substring(i, i + 4), 16);
      out += String.fromCharCode(unit);
    } else if (i + 2 <= h.length) {
      out += String.fromCharCode(parseInt(h.substring(i, i + 2), 16));
    }
  }
  return out;
};

const codePointToString = (codePoint: number): string => {
  if (codePoint <= 0xffff) return String.fromCharCode(codePoint);
  return String.fromCodePoint(codePoint);
};
