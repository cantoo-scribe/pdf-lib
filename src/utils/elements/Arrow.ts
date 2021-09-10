import { Coordinates, Resizable, Translatable } from '../../types'
import { norm, plus, rotate, times, unitVector, vector, isTranslatable } from '../maths'

import GraphElement, { GraphOptions } from './GraphElement'
import Point, { PointXY } from './Point'
import Segment, { SegmentFixed } from './Segment'

export type ArrowAttributes = {
  main: Segment
  left: Segment
  right: Segment
}

export default abstract class Arrow extends GraphElement<ArrowAttributes> {
  abstract origin(): Point

  abstract destination(): Point

  getSize() {
    return norm(vector(this.destination(), this.origin()))
  }

  getSegment(): Segment {
    const segment = new SegmentFixed(
      this.origin().toCoords(),
      this.destination().toCoords()
    )
    segment.setDrawConfigOf(this)
    return segment
  }

  isEqual(element: GraphElement): boolean {
    return element instanceof Arrow && element.getSegment().isEqual(this.getSegment())
  }

  getDrawingAttributesImpl(): ArrowAttributes {
    const config = this.getDrawConfig()
    const { toPixelConverter, toRealConverter } = config
    const segment = this.getSegment()
    segment.options = {
      color: this.color,
      strokeWidth: this.strokeWidth,
    }
    const B = this.destination().toCoords()
    const reverseVect = times(segment.dirVect(), -1)
    const u1 = rotate(reverseVect, Math.PI / 8)
    const u2 = rotate(reverseVect, -Math.PI / 8)
    const pixelU1 = times(
      unitVector({ x: toPixelConverter.w(u1.x), y: toPixelConverter.h(u1.y) }),
      (this.strokeWidth || 1) * 10
    )
    const pixelU2 = times(
      unitVector({ x: toPixelConverter.w(u2.x), y: toPixelConverter.h(u2.y) }),
      (this.strokeWidth || 1) * 10
    )
    const realU1 = {
      x: toRealConverter.w(pixelU1.x),
      y: toRealConverter.h(pixelU1.y),
    }
    const realU2 = {
      x: toRealConverter.w(pixelU2.x),
      y: toRealConverter.h(pixelU2.y),
    }
    const leftSegment = new SegmentFixed(B, plus(B, realU1), {
      ...this.options,
    })
    leftSegment.setDrawConfigOf(this)
    const rightSegment = new SegmentFixed(B, plus(B, realU2), {
      ...this.options,
    })
    rightSegment.setDrawConfigOf(this)
    const attrs = {
      main: segment,
      left: leftSegment,
      right: rightSegment,
    }
    return attrs
  }

  orthoProjection(P: Point) {
    return this.getSegment().orthoProjection(P)
  }
}

export class ArrowFixed extends Arrow {
  static type = 'ArrowFixed' as const
  A: Coordinates
  B: Coordinates
  constructor(
    A: Coordinates = { x: 0, y: 0 },
    B: Coordinates = { x: 0, y: 0 },
    options?: GraphOptions
  ) {
    super(options)
    this.A = A
    this.B = B
  }

  origin(): Point {
    const origin = new PointXY(this.A)
    origin.setDrawConfigOf(this)
    return origin
  }

  destination(): Point {
    const dest = new PointXY(this.B)
    dest.setDrawConfigOf(this)
    return dest
  }
}

export class ArrowAB extends Arrow implements Resizable {
  static type = 'ArrowAB' as 'ArrowAB' | 'ArrowTranslatable'
  A: Point
  B: Point

  constructor(A: Point = new PointXY(), B: Point = new PointXY(), options?: GraphOptions) {
    super(options)
    this.A = A
    this.B = B
  }

  getHandles(): (Point & Translatable)[] {
    return [this.A, this.B].filter(elt => isTranslatable(elt)) as (Point & Translatable)[]
  }

  origin() {
    this.A.setDrawConfigOf(this)
    return this.A
  }

  destination() {
    this.B.setDrawConfigOf(this)
    return this.B
  }
}

export class ArrowTranslatable extends ArrowAB implements Translatable, Resizable {
  static type = 'ArrowTranslatable' as const

  constructor(
    A: Point & Translatable = new PointXY(),
    B: Point & Translatable = new PointXY(),
    options?: GraphOptions
  ) {
    super(A, B, options)
  }

  origin() {
    this.A.setDrawConfigOf(this)
    return this.A as PointXY
  }

  destination() {
    this.B.setDrawConfigOf(this)
    return this.B as PointXY
  }

  translate(vector: Coordinates): void {
    this.origin().translate(vector)
    this.destination().translate(vector)
  }
}
