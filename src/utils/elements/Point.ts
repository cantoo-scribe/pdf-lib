import type { Coordinates, DrawConfig, GraphicElement, Translatable } from '../../types'
import { intersections } from '../intersections'
import {
  angleABC,
  isEqual,
  minus,
  norm,
  plus,
  rotate,
  roundNumber,
  times,
  toDegrees,
  toRadians,
  unitVector,
} from '../maths'

import Arc, { ArcOAB } from './Arc'
import Arrow from './Arrow'
import GraphElement, { GraphOptions } from './GraphElement'
import HalfLine from './HalfLine'
import Line, { LineParallel } from './Line'
import Segment, { SegmentAB } from './Segment'

type PointAttributes = {
  cx: string | number
  cy: string | number
  rx: string | number
  ry: string | number
  fill: string
}

export default abstract class Point extends GraphElement<PointAttributes> {
  abstract toCoords(): Coordinates

  isEqual(element: GraphElement): boolean {
    if (!(element instanceof Point)) return false
    const A = this.toCoords()
    const B = element.toCoords()
    return isEqual(A.x, B.x) && isEqual(A.y, B.y)
  }

  getDrawingAttributesImpl(): PointAttributes | null {
    const { toRealConverter }: Pick<DrawConfig, 'toRealConverter'> = this.getDrawConfig()
    const { x, y } = this.toCoords()
    const r = (this.strokeWidth || 3) * 1.5
    const attrs: PointAttributes = {
      cx: x,
      cy: y,
      rx: toRealConverter.w(r),
      ry: toRealConverter.h(r),
      fill: this.color || 'black',
    }
    return attrs
  }

  orthoProjection() {
    return new PointXY(this.toCoords())
  }

  plus(vect: Coordinates) {
    const P = new PointXY(plus(this.toCoords(), vect))
    P.setDrawConfigOf(this)
    return P
  }
}

export class PointFixed extends Point {
  static type = 'PointFixed' as
    | 'PointFixed'
    | 'PointXY'
    | 'PointPrecision'
    | 'PointLengthPrecision'
    | 'PointArcPrecision'
    | 'PointOrthogonalPrecision'
    | 'PointAnglePrecision'
    | 'ProjectedXY'

  x: number
  y: number

  constructor(coords = { x: 0, y: 0 }, options?: GraphOptions) {
    super(options)
    this.x = coords.x
    this.y = coords.y
  }

  toCoords() {
    return { x: this.x, y: this.y }
  }
}

export class PointXY extends PointFixed implements Translatable {
  static type = 'PointXY' as
    | 'PointXY'
    | 'PointPrecision'
    | 'PointLengthPrecision'
    | 'PointArcPrecision'
    | 'PointOrthogonalPrecision'
    | 'PointAnglePrecision'
    | 'ProjectedXY'

  translate(translationVector: Coordinates) {
    this.x += translationVector.x
    this.y += translationVector.y
  }
}

export class PointRatio extends Point implements Translatable {
  static type = 'PointRatio' as 'PointRatio' | 'PointLengthPrecision'
  O: Point
  axis: Line | HalfLine | Segment
  ratio: number

  constructor(
    O: Point = new PointXY(),
    axis: Line | HalfLine | Segment = new SegmentAB(),
    ratio = 1,
    options?: GraphOptions
  ) {
    super(options)
    this.O = O
    this.axis = axis
    this.ratio = ratio
  }

  translate(vector: Coordinates): void {
    const P = this.O.plus(vector)
    const H = this.axis.orthoProjection(P)
    this.ratio = this.O.distance(H) / norm(this.axis.dirVect())
  }

  toCoords() {
    this.O.setDrawConfigOf(this)
    this.axis.setDrawConfigOf(this)
    return plus(this.O.toCoords(), times(this.axis.dirVect(), this.ratio))
  }
}

export class PointParallel extends Point {
  static type = 'PointParallel' as const
  A: Point
  B: Point
  axis: Segment | Line | HalfLine
  constructor(
    A: Point = new PointXY(),
    axis: Segment | Line | HalfLine = new SegmentAB(),
    B: Point = new PointXY(),
    options?: GraphOptions
  ) {
    super(options)
    this.A = A
    this.B = B
    this.axis = axis
  }

  toCoords() {
    const line = new LineParallel(this.A, this.axis)
    line.setDrawConfigOf(this)
    return line.orthoProjection(this.B).toCoords()
  }
}

export class PointVector extends Point {
  static type = 'PointVector' as const
  A: Point
  segment: Segment
  constructor(
    A: Point = new PointXY(),
    segment: Segment = new SegmentAB(),
    options?: GraphOptions
  ) {
    super(options)
    this.A = A
    this.segment = segment
  }

  toCoords() {
    this.A.setDrawConfigOf(this)
    this.segment.setDrawConfigOf(this)
    return plus(this.A.toCoords(), this.segment.dirVect())
  }
}

/** Point orthogonal to line and at a distance that respects the measure precision */
export class PointOrthogonalPrecision extends PointXY {
  static type = 'PointOrthogonalPrecision' as const
  line: Segment | Line | HalfLine
  constructor(
    line: Segment | Line | HalfLine = new SegmentAB(),
    P: Coordinates = new PointXY(),
    options?: GraphOptions
  ) {
    super(P, options)
    this.line = line
  }

  toCoords() {
    const P = new PointXY(super.toCoords())
    P.setDrawConfigOf(this)
    const H = this.line.orthoProjection(P)
    H.setDrawConfigOf(this)
    const precisePoint = new PointPrecision(H, P)
    precisePoint.setDrawConfigOf(this)
    return precisePoint.toCoords()
  }
}

/** Create a point that will be at `length` distance from the origin */
export class PointPrecision extends PointXY {
  static type = 'PointPrecision' as const
  origin: Point

  constructor(
    origin: Point = new PointXY(),
    P: Coordinates = new PointXY(),
    options?: GraphOptions
  ) {
    super(P, options)
    this.origin = origin
  }

  toCoords(): Coordinates {
    const { measurePrecision } = this.getDrawConfig()
    this.origin.setDrawConfigOf(this)
    const origin = this.origin.toCoords()
    const vect = minus(super.toCoords(), origin)
    const length = norm(vect)
    const fixedLength = parseFloat(roundNumber(length, measurePrecision))
    if (isEqual(fixedLength, 0)) return origin
    return plus(origin, times(vect, fixedLength / length))
  }
}

/** A point on the axis (AB) that will be at `length` distance from A in the direction of B. */
export class PointLengthPrecision extends PointRatio {
  static type = 'PointLengthPrecision' as const

  /** Create a point on the axis (AB) that will be at `length` distance from A in the direction of B. */
  constructor(
    O: Point = new PointXY(),
    axis: Segment | HalfLine | Line = new SegmentAB(),
    P: Coordinates = O.plus(axis.dirVect()).toCoords(),
    options?: GraphOptions
  ) {
    super(O, axis, O.distance(new PointXY(P)) / norm(axis.dirVect()), options)
  }

  toCoords() {
    this.O.setDrawConfigOf(this)
    this.axis.setDrawConfigOf(this)
    // We apply the measure precision
    const P = new PointPrecision(
      this.O,
      this.O.plus(times(this.axis.dirVect(), this.ratio))
    )
    P.setDrawConfigOf(this)
    return P.toCoords()
  }
}

/** Provided points O and A, angle(A, O, this) will always be a rounded angle. this will be on the circle of ray OA. */
export class PointAnglePrecision extends PointXY {
  static type = 'PointAnglePrecision' as const
  center: Point
  start: Point
  sweep: number

  constructor(
    center: Point = new PointXY(),
    start: Point = new PointXY(),
    P: Coordinates = start.toCoords(),
    sweep = 0,
    options?: GraphOptions
  ) {
    super(P, options)
    this.center = center
    this.start = start
    this.sweep = sweep
  }

  roundedSweep() {
    const { anglePrecision } = this.getDrawConfig()
    this.sweep = angleABC(
      this.start,
      this.center,
      new PointFixed(super.toCoords()),
      this.sweep
    )
    return roundNumber(toDegrees(this.sweep) % 360, anglePrecision)
  }

  toCoords() {
    this.center.setDrawConfigOf(this)
    this.start.setDrawConfigOf(this)
    const rounded = this.roundedSweep()
    const center = this.center.toCoords()
    const vect = minus(this.start.toCoords(), center)
    const rotatedVect = rotate(vect, toRadians(parseFloat(rounded)))
    return plus(center, rotatedVect)
  }
}

/** A projected point on an arc that will be at a rounded angle from the origin */
export class PointArcPrecision extends PointXY {
  static type = 'PointArcPrecision' as const
  arc: Arc
  sweep: number

  constructor(
    arc: Arc = new ArcOAB(),
    P: Coordinates = arc.origin().toCoords(),
    sweep = 0,
    options?: GraphOptions
  ) {
    super(P, options)
    this.arc = arc
    this.sweep = sweep
  }

  toCoords() {
    this.arc.setDrawConfigOf(this)
    const anglePoint = new PointAnglePrecision(
      this.arc.center(),
      this.arc.origin(),
      super.toCoords(),
      this.sweep
    )
    anglePoint.setDrawConfigOf(this)
    this.sweep = anglePoint.sweep
    return anglePoint.toCoords()
  }
}

export class PointIntersection extends Point {
  static type = 'PointIntersection' as const
  elt1: GraphicElement
  elt2: GraphicElement
  index?: number
  constructor(
    elt1: GraphicElement = new PointXY(),
    elt2: GraphicElement = new PointXY(),
    index?: number,
    options?: GraphicElement
  ) {
    super(options)
    this.elt1 = elt1
    this.elt2 = elt2
    this.index = index
  }

  toCoords() {
    this.elt1.setDrawConfigOf(this)
    this.elt2.setDrawConfigOf(this)
    const P = intersections(this.elt1, this.elt2)[this.index || 0]
    // If the intersection point doesn't exist, we create a fake point at (0,0)
    if (!P) return { x: 0, y: 0 }
    return P
  }

  // If the point doesn't exist, we don't draw it.
  getDrawingAttributesImpl() {
    this.elt1.setDrawConfigOf(this)
    this.elt2.setDrawConfigOf(this)
    if (!intersections(this.elt1, this.elt2)[this.index || 0]) return null
    else return super.getDrawingAttributesImpl()
  }
}

export class Handle extends PointXY {
  onTranslate: (vector: Coordinates) => void
  constructor(coords: Coordinates, onTranslate: (vector: Coordinates) => void) {
    super(coords)
    this.onTranslate = onTranslate
  }

  translate(translationVector: Coordinates) {
    this.x += translationVector.x
    this.y += translationVector.y
    this.onTranslate(translationVector)
  }
}

export class Projected extends Point {
  static type = 'Projected' as const
  support: Exclude<GraphicElement, Point | Text | Arrow>
  P: Point
  constructor(
    support: Exclude<GraphicElement, Point | Text | Arrow> = new SegmentAB(),
    P: Point = new PointXY(),
    options?: GraphOptions
  ) {
    super(options)
    this.support = support
    this.P = P
  }

  toCoords(): Coordinates {
    this.support.setDrawConfigOf(this)
    this.P.setDrawConfigOf(this)
    return this.support.orthoProjection(this.P).toCoords()
  }
}

export class PointSameLength extends Point {
  static type = 'PointSameLength' as const
  source: Segment
  axis: Line | HalfLine | Segment
  constructor(
    source: Segment = new SegmentAB(),
    axis: Line | HalfLine | Segment = source,
    options?: GraphOptions
  ) {
    super(options)
    this.source = source
    this.axis = axis
  }

  toCoords(): Coordinates {
    this.axis.setDrawConfigOf(this)
    this.source.setDrawConfigOf(this)
    const A = this.axis.origin().toCoords()
    const length = this.source.length()
    return plus(A, times(unitVector(this.axis.dirVect()), length))
  }
}

export class ProjectedXY extends PointXY {
  static type = 'ProjectedXY' as const
  support: Exclude<GraphicElement, Point | Text | Arrow>
  constructor(
    support: Exclude<GraphicElement, Point | Text | Arrow> = new SegmentAB(),
    P: Coordinates = new PointXY(),
    options?: GraphOptions
  ) {
    super(P, options)
    this.support = support
  }

  toCoords(): Coordinates {
    this.support.setDrawConfigOf(this)
    const P = new PointXY(super.toCoords())
    P.setDrawConfigOf(this)
    const H = this.support.orthoProjection(P).toCoords()
    this.x = H.x
    this.y = H.y
    return H
  }
}
