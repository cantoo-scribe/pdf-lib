import { Writable } from 'stream';
import { MethodNotImplementedError } from '../errors';
import PDFContext from '../PDFContext';

class PDFObject {
  clone(_context?: PDFContext): PDFObject {
    throw new MethodNotImplementedError(this.constructor.name, 'clone');
  }

  toString(): string {
    throw new MethodNotImplementedError(this.constructor.name, 'toString');
  }

  sizeInBytes(): number {
    throw new MethodNotImplementedError(this.constructor.name, 'sizeInBytes');
  }

  copyBytesInto(_buffer: Uint8Array, _offset: number): number {
    throw new MethodNotImplementedError(this.constructor.name, 'copyBytesInto');
  }

  writeBytesInto(_stream: Writable): void {
    throw new MethodNotImplementedError(
      this.constructor.name,
      'writeBytesInto',
    );
  }
}

export default PDFObject;
