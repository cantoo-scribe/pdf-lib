import { TransformationMatrix } from '../../types/matrix';

export type PathPaintStyle = {
  fill?: string;
  stroke?: string;
  fillRule?: 'nonzero' | 'evenodd';
  lineWidth: number;
};

export type GraphicsSvgResult = {
  x: number;
  y: number;
  width: number;
  height: number;
  svg: string;
};

type Pt = { x: number; y: number };

/** Accumulates a PDF path in current user space, then emits page-space SVG. */
export class PdfPathBuilder {
  private ops: PathOp[] = [];
  private current: Pt | undefined;
  private subpathStart: Pt | undefined;
  private hasGeometry = false;

  get isEmpty(): boolean {
    return !this.hasGeometry;
  }

  clear(): void {
    this.ops = [];
    this.current = undefined;
    this.subpathStart = undefined;
    this.hasGeometry = false;
  }

  moveTo(x: number, y: number): void {
    this.current = { x, y };
    this.subpathStart = { x, y };
    this.ops.push({ type: 'M', x, y });
    this.hasGeometry = true;
  }

  lineTo(x: number, y: number): void {
    this.current = { x, y };
    this.ops.push({ type: 'L', x, y });
    this.hasGeometry = true;
  }

  curveTo(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
  ): void {
    this.current = { x: x3, y: y3 };
    this.ops.push({ type: 'C', x1, y1, x2, y2, x3, y3 });
    this.hasGeometry = true;
  }

  /** `v`: replicate first control point as current point */
  curveV(x2: number, y2: number, x3: number, y3: number): void {
    const x1 = this.current?.x ?? 0;
    const y1 = this.current?.y ?? 0;
    this.curveTo(x1, y1, x2, y2, x3, y3);
  }

  /** `y`: replicate final control point */
  curveY(x1: number, y1: number, x3: number, y3: number): void {
    this.curveTo(x1, y1, x3, y3, x3, y3);
  }

  closePath(): void {
    if (this.subpathStart) {
      this.current = { ...this.subpathStart };
    }
    this.ops.push({ type: 'Z' });
  }

  rectangle(x: number, y: number, w: number, h: number): void {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.closePath();
  }

  /**
   * Build an SVG asset: path points are mapped through `ctm` into page space.
   * The SVG uses `scale(1,-1)` so it displays with a conventional y-down axis
   * while path data stays in PDF user-space numbers.
   */
  paint(
    ctm: TransformationMatrix,
    style: PathPaintStyle,
  ): GraphicsSvgResult | undefined {
    if (!this.hasGeometry || this.ops.length === 0) return undefined;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const include = (p: Pt) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    };

    const dParts: string[] = [];
    for (const op of this.ops) {
      if (op.type === 'Z') {
        dParts.push('Z');
        continue;
      }
      if (op.type === 'M' || op.type === 'L') {
        const p = applyCtm(op.x, op.y, ctm);
        include(p);
        dParts.push(`${op.type} ${fmt(p.x)} ${fmt(p.y)}`);
        continue;
      }
      if (op.type === 'C') {
        const p1 = applyCtm(op.x1, op.y1, ctm);
        const p2 = applyCtm(op.x2, op.y2, ctm);
        const p3 = applyCtm(op.x3, op.y3, ctm);
        include(p1);
        include(p2);
        include(p3);
        dParts.push(
          `C ${fmt(p1.x)} ${fmt(p1.y)} ${fmt(p2.x)} ${fmt(p2.y)} ${fmt(p3.x)} ${fmt(p3.y)}`,
        );
      }
    }

    if (!Number.isFinite(minX)) return undefined;

    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    const scale = averageScale(ctm);
    const strokeWidth = style.lineWidth * scale;

    const fill = style.fill ?? (style.stroke ? 'none' : '#000000');
    const stroke = style.stroke ?? 'none';
    const fillRule =
      style.fillRule === 'evenodd' ? ' fill-rule="evenodd"' : '';

    const attrs = [
      `d="${dParts.join(' ')}"`,
      `fill="${fill}"`,
      `stroke="${stroke}"`,
      stroke !== 'none' ? `stroke-width="${fmt(strokeWidth)}"` : undefined,
      fillRule || undefined,
    ]
      .filter(Boolean)
      .join(' ');

    const vbX = minX;
    const vbY = -maxY;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `viewBox="${fmt(vbX)} ${fmt(vbY)} ${fmt(width)} ${fmt(height)}">` +
      `<g transform="scale(1,-1)"><path ${attrs}/></g></svg>`;

    return { x: minX, y: minY, width, height, svg };
  }
}

type PathOp =
  | { type: 'M' | 'L'; x: number; y: number }
  | {
      type: 'C';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      x3: number;
      y3: number;
    }
  | { type: 'Z' };

export const rgbCss = (r: number, g: number, b: number): string => {
  const R = Math.round(clamp01(r) * 255);
  const G = Math.round(clamp01(g) * 255);
  const B = Math.round(clamp01(b) * 255);
  return `#${hex2(R)}${hex2(G)}${hex2(B)}`;
};

export const grayCss = (g: number): string => rgbCss(g, g, g);

/** Rough CMYK→RGB for extraction display */
export const cmykCss = (
  c: number,
  m: number,
  y: number,
  k: number,
): string => {
  const C = clamp01(c);
  const M = clamp01(m);
  const Y = clamp01(y);
  const K = clamp01(k);
  return rgbCss(
    1 - Math.min(1, C * (1 - K) + K),
    1 - Math.min(1, M * (1 - K) + K),
    1 - Math.min(1, Y * (1 - K) + K),
  );
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const hex2 = (n: number) => n.toString(16).padStart(2, '0');

const fmt = (n: number): string => {
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(n * 1000) / 1000);
};

const applyCtm = (
  x: number,
  y: number,
  [a, b, c, d, e, f]: TransformationMatrix,
): Pt => ({
  x: a * x + c * y + e,
  y: b * x + d * y + f,
});

const averageScale = ([a, b, c, d]: TransformationMatrix): number => {
  const sx = Math.hypot(a, b);
  const sy = Math.hypot(c, d);
  return (sx + sy) / 2 || 1;
};
