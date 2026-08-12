import CharCodes from '../../core/syntax/CharCodes';
import { IsDigit, IsNumeric } from '../../core/syntax/Numeric';
import { IsWhitespace } from '../../core/syntax/Whitespace';
import { IsDelimiter } from '../../core/syntax/Delimiters';
import { charFromCode } from '../../utils';
import {
  ContentStreamOperand,
  ContentStreamOperation,
  HexStringOperand,
  LiteralStringOperand,
  NameOperand,
} from './types';

/**
 * Tokenize a decoded PDF content stream into operator / operand sequences.
 * Inline images (`BI`…`ID`…`EI`) are skipped as a unit.
 */
export const parseContentStream = (
  bytes: Uint8Array,
): ContentStreamOperation[] => {
  const parser = new ContentStreamParser(bytes);
  return parser.parse();
};

class ContentStreamParser {
  private readonly bytes: Uint8Array;
  private idx = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  parse(): ContentStreamOperation[] {
    const operations: ContentStreamOperation[] = [];
    let args: ContentStreamOperand[] = [];

    while (!this.done()) {
      this.skipWhitespaceAndComments();
      if (this.done()) break;

      const byte = this.peek();

      if (byte === CharCodes.ForwardSlash) {
        args.push(this.parseName());
        continue;
      }
      if (byte === CharCodes.LeftParen) {
        args.push(this.parseLiteralString());
        continue;
      }
      if (
        byte === CharCodes.LessThan &&
        this.peekAhead(1) === CharCodes.LessThan
      ) {
        args.push(this.parseDict());
        continue;
      }
      if (byte === CharCodes.LessThan) {
        args.push(this.parseHexString());
        continue;
      }
      if (byte === CharCodes.LeftSquareBracket) {
        args.push(this.parseArray());
        continue;
      }
      if (
        byte === CharCodes.Plus ||
        byte === CharCodes.Minus ||
        byte === CharCodes.Period ||
        IsDigit[byte]
      ) {
        args.push(this.parseNumber());
        continue;
      }

      // Operator (or keyword true/false/null — treat as operand-like no-ops via skip)
      const op = this.parseOperator();
      if (op === 'true') {
        args.push(1);
        continue;
      }
      if (op === 'false') {
        args.push(0);
        continue;
      }
      if (op === 'null') {
        args.push(0);
        continue;
      }

      if (op === 'BI') {
        this.skipInlineImage();
        args = [];
        continue;
      }

      operations.push({ name: op, args });
      args = [];
    }

    return operations;
  }

  private done() {
    return this.idx >= this.bytes.length;
  }

  private peek() {
    return this.bytes[this.idx];
  }

  private peekAhead(n: number) {
    return this.bytes[this.idx + n];
  }

  private next() {
    return this.bytes[this.idx++];
  }

  private skipWhitespaceAndComments() {
    while (!this.done()) {
      const byte = this.peek();
      if (IsWhitespace[byte]) {
        this.next();
        continue;
      }
      if (byte === CharCodes.Percent) {
        while (!this.done()) {
          const b = this.next();
          if (b === CharCodes.Newline || b === CharCodes.CarriageReturn) break;
        }
        continue;
      }
      break;
    }
  }

  private parseName(): NameOperand {
    this.next(); // /
    let value = '';
    while (!this.done()) {
      const byte = this.peek();
      if (IsWhitespace[byte] || IsDelimiter[byte]) break;
      value += charFromCode(this.next());
    }
    // Decode #HH escapes
    value = value.replace(/#([0-9A-Fa-f]{2})/g, (_, hex) =>
      charFromCode(parseInt(hex, 16)),
    );
    return { type: 'name', value };
  }

  private parseNumber(): number {
    let value = '';
    while (!this.done()) {
      const byte = this.peek();
      if (!IsNumeric[byte]) break;
      value += charFromCode(this.next());
      if (byte === CharCodes.Period) break;
    }
    while (!this.done() && IsDigit[this.peek()]) {
      value += charFromCode(this.next());
    }
    return Number(value);
  }

  private parseHexString(): HexStringOperand {
    this.next(); // <
    let hex = '';
    while (!this.done()) {
      const byte = this.peek();
      if (byte === CharCodes.GreaterThan) {
        this.next();
        break;
      }
      if (!IsWhitespace[byte]) hex += charFromCode(this.next());
      else this.next();
    }
    if (hex.length % 2 === 1) hex += '0';
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return { type: 'hexString', bytes };
  }

  private parseLiteralString(): LiteralStringOperand {
    this.next(); // (
    const out: number[] = [];
    let depth = 1;
    while (!this.done() && depth > 0) {
      const byte = this.next();
      if (byte === CharCodes.BackSlash) {
        if (this.done()) break;
        const esc = this.next();
        if (esc === CharCodes.n) out.push(CharCodes.Newline);
        else if (esc === CharCodes.r) out.push(CharCodes.CarriageReturn);
        else if (esc === CharCodes.t) out.push(CharCodes.Tab);
        else if (esc === CharCodes.b) out.push(CharCodes.Backspace);
        else if (esc === CharCodes.f) out.push(CharCodes.FormFeed);
        else if (esc === CharCodes.LeftParen) out.push(CharCodes.LeftParen);
        else if (esc === CharCodes.RightParen) out.push(CharCodes.RightParen);
        else if (esc === CharCodes.BackSlash) out.push(CharCodes.BackSlash);
        else if (IsDigit[esc]) {
          let oct = charFromCode(esc);
          if (!this.done() && IsDigit[this.peek()]) {
            oct += charFromCode(this.next());
          }
          if (!this.done() && IsDigit[this.peek()]) {
            oct += charFromCode(this.next());
          }
          out.push(parseInt(oct, 8) & 0xff);
        } else if (
          esc === CharCodes.Newline ||
          esc === CharCodes.CarriageReturn
        ) {
          // line continuation — skip
          if (
            esc === CharCodes.CarriageReturn &&
            !this.done() &&
            this.peek() === CharCodes.Newline
          ) {
            this.next();
          }
        } else {
          out.push(esc);
        }
      } else if (byte === CharCodes.LeftParen) {
        depth++;
        out.push(byte);
      } else if (byte === CharCodes.RightParen) {
        depth--;
        if (depth > 0) out.push(byte);
      } else {
        out.push(byte);
      }
    }
    return { type: 'string', bytes: Uint8Array.from(out) };
  }

  private parseArray(): ContentStreamOperand[] {
    this.next(); // [
    const items: ContentStreamOperand[] = [];
    while (!this.done()) {
      this.skipWhitespaceAndComments();
      if (this.done()) break;
      if (this.peek() === CharCodes.RightSquareBracket) {
        this.next();
        break;
      }
      // Reuse operand parsers; operators shouldn't appear in arrays, but TJ has nested strings/numbers
      const byte = this.peek();
      if (byte === CharCodes.ForwardSlash) items.push(this.parseName());
      else if (byte === CharCodes.LeftParen) {
        items.push(this.parseLiteralString());
      } else if (
        byte === CharCodes.LessThan &&
        this.peekAhead(1) === CharCodes.LessThan
      ) {
        items.push(this.parseDict());
      } else if (byte === CharCodes.LessThan) items.push(this.parseHexString());
      else if (byte === CharCodes.LeftSquareBracket) {
        items.push(this.parseArray());
      } else if (
        byte === CharCodes.Plus ||
        byte === CharCodes.Minus ||
        byte === CharCodes.Period ||
        IsDigit[byte]
      ) {
        items.push(this.parseNumber());
      } else {
        // Unexpected operator-like token inside array — skip as name-ish
        this.parseOperator();
      }
    }
    return items;
  }

  private parseDict(): { [key: string]: ContentStreamOperand } {
    this.next(); // <
    this.next(); // <
    const dict: { [key: string]: ContentStreamOperand } = {};
    while (!this.done()) {
      this.skipWhitespaceAndComments();
      if (
        this.peek() === CharCodes.GreaterThan &&
        this.peekAhead(1) === CharCodes.GreaterThan
      ) {
        this.next();
        this.next();
        break;
      }
      const key = this.parseName();
      this.skipWhitespaceAndComments();
      const byte = this.peek();
      let value: ContentStreamOperand;
      if (byte === CharCodes.ForwardSlash) value = this.parseName();
      else if (byte === CharCodes.LeftParen) value = this.parseLiteralString();
      else if (
        byte === CharCodes.LessThan &&
        this.peekAhead(1) === CharCodes.LessThan
      ) {
        value = this.parseDict();
      } else if (byte === CharCodes.LessThan) value = this.parseHexString();
      else if (byte === CharCodes.LeftSquareBracket) value = this.parseArray();
      else if (
        byte === CharCodes.Plus ||
        byte === CharCodes.Minus ||
        byte === CharCodes.Period ||
        IsDigit[byte]
      ) {
        value = this.parseNumber();
      } else {
        const op = this.parseOperator();
        value = op === 'true' ? 1 : op === 'false' ? 0 : op === 'null' ? 0 : op;
      }
      dict[key.value] = value;
    }
    return dict;
  }

  private parseOperator(): string {
    const first = this.peek();
    // Single-char operators ' and "
    if (first === 39 /* ' */ || first === 34 /* " */) {
      return charFromCode(this.next());
    }
    let value = '';
    while (!this.done()) {
      const byte = this.peek();
      if (IsWhitespace[byte] || IsDelimiter[byte]) break;
      value += charFromCode(this.next());
    }
    return value;
  }

  private skipInlineImage() {
    // Skip until ID, then consume until EI after whitespace
    while (!this.done()) {
      this.skipWhitespaceAndComments();
      if (this.done()) return;
      // Look for ID keyword
      if (
        this.peek() === 73 /* I */ &&
        this.peekAhead(1) === CharCodes.D &&
        (this.idx + 2 >= this.bytes.length ||
          IsWhitespace[this.bytes[this.idx + 2]] ||
          IsDelimiter[this.bytes[this.idx + 2]])
      ) {
        this.next();
        this.next();
        // Skip one whitespace after ID
        if (!this.done() && IsWhitespace[this.peek()]) this.next();
        break;
      }
      // Skip a dict key/value or token
      if (this.peek() === CharCodes.ForwardSlash) {
        this.parseName();
        this.skipWhitespaceAndComments();
        // skip value crudely
        const b = this.peek();
        if (b === CharCodes.ForwardSlash) this.parseName();
        else if (
          IsNumeric[b] ||
          b === CharCodes.Plus ||
          b === CharCodes.Minus
        ) {
          this.parseNumber();
        } else if (b === CharCodes.LeftParen) this.parseLiteralString();
        else if (b === CharCodes.LessThan) {
          if (this.peekAhead(1) === CharCodes.LessThan) this.parseDict();
          else this.parseHexString();
        } else this.parseOperator();
      } else {
        this.parseOperator();
      }
    }

    // Scan for EI
    while (!this.done()) {
      if (
        this.peek() === CharCodes.E &&
        this.peekAhead(1) === 73 /* I */ &&
        (this.idx === 0 || IsWhitespace[this.bytes[this.idx - 1]] || true)
      ) {
        // EI must be preceded by whitespace or start; check previous byte
        const prev = this.idx > 0 ? this.bytes[this.idx - 1] : CharCodes.Space;
        const next = this.bytes[this.idx + 2];
        if (
          IsWhitespace[prev] &&
          (next === undefined || IsWhitespace[next] || IsDelimiter[next])
        ) {
          this.next();
          this.next();
          return;
        }
      }
      this.next();
    }
  }
}
