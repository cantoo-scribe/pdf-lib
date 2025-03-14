import { Writable } from 'stream';
import PDFDict from '../objects/PDFDict';
import CharCodes from '../syntax/CharCodes';

class PDFTrailerDict {
  static of = (dict: PDFDict) => new PDFTrailerDict(dict);

  readonly dict: PDFDict;

  private constructor(dict: PDFDict) {
    this.dict = dict;
  }

  toString(): string {
    return `trailer\n${this.dict.toString()}`;
  }

  sizeInBytes(): number {
    return 8 + this.dict.sizeInBytes();
  }

  copyBytesInto(buffer: Uint8Array, offset: number): number {
    const initialOffset = offset;

    buffer[offset++] = CharCodes.t;
    buffer[offset++] = CharCodes.r;
    buffer[offset++] = CharCodes.a;
    buffer[offset++] = CharCodes.i;
    buffer[offset++] = CharCodes.l;
    buffer[offset++] = CharCodes.e;
    buffer[offset++] = CharCodes.r;
    buffer[offset++] = CharCodes.Newline;

    offset += this.dict.copyBytesInto(buffer, offset);

    return offset - initialOffset;
  }

  writeBytesInto(stream: Writable): void {
    stream.write(
      Buffer.from([
        CharCodes.t,
        CharCodes.r,
        CharCodes.a,
        CharCodes.i,
        CharCodes.l,
        CharCodes.e,
        CharCodes.r,
        CharCodes.Newline,
      ]),
    );

    this.dict.writeBytesInto(stream);
  }
}

export default PDFTrailerDict;
