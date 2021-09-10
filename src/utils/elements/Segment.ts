import { Coordinates, DrawConfig, Resizable, Translatable } from '../../types'
import { distance, isColinear, norm, scalar, vector, isTranslatable } from '../maths'

import GraphElement, { GraphOptions } from './GraphElement'
import HalfLine from './HalfLine'
import Line, { LineOVect, LineOrthogonal, LineAttributes } from './Line'
import Point, { PointRatio, PointXY } from './Point'

export default abstract class Segment extends GraphElement<LineAttributes> {
  abstract origin(): Point
  abstract destination(): Point

  dirVect() {
    return vector(this.origin(), this.destination())
  }

  length() {
    return distance(this.destination(), this.origin())
  }

  isEqual(element: GraphElement): boolean {
    if (!(element instanceof Segment)) return false
    const o = this.origin()
    const dest = this.destination()
    const oE = element.origin()
    const destE = element.destination()
    return (
      element instanceof Segment &&
      ((o.isEqual(oE) && dest.isEqual(destE)) || (o.isEqual(destE) && dest.isEqual(oE)))
    )
  }

  /** Returns an equivalent line object */
  getLine() {
    const line = new LineOVect(this.origin(), this.dirVect(), this.options)
    line.getDrawConfig = this.getDrawConfig
    return line
  }

  getDrawingAttributesImpl() {
    const { strokeScale }: Pick<DrawConfig, 'strokeScale'> = this.getDrawConfig()
    const { x: x1, y: y1 } = this.origin().toCoords()
    const { x: x2, y: y2 } = this.destination().toCoords()
    const attrs: LineAttributes = {
      x1,
      x2,
      y1,
      y2,
      strokeWidth: (this.strokeWidth || 1) * strokeScale,
      strokeLinecap: 'round',
      stroke: this.color || 'black',
    }
    return attrs
  }

  includes(P: Point) {
    const vect = this.dirVect()
    const otherVect = vector(this.origin(), P)
    // The vectors are not even colinear
    if (!isColinear(vect, otherVect)) return false
    // The point is behind the origin
    else if (scalar(vect, otherVect) < 0) return false
    // The point is after the destination
    else if (norm(vect) < norm(otherVect)) return false
    else return true
  }

  middle() {
    const mid = new PointRatio(this.origin(), this, 0.5, {
      color: this.color,
      strokeWidth: this.strokeWidth,
    })
    mid.setDrawConfigOf(this)
    return mid
  }

  orthoProjection(P: Point) {
    const H = this.getLine().orthoProjection(P)
    const vect = this.dirVect()
    const origin = this.origin().toCoords()
    const destination = this.destination().toCoords()
    const otherVect = vector(this.origin(), H)
    // The point is before the origin
    if (scalar(vect, otherVect) < 0) return new PointXY(origin)
    // The point is after the destination
    else if (norm(vect) < norm(otherVect)) return new PointXY(destination)
    // The point is within the segment
    else return H
  }
}

export class SegmentFixed extends Segment {
  static type = 'SegmentFixed' as const
  origin(): Point {
    const origin = new PointXY(this.A)
    origin.setDrawConfigOf(this)
    return origin
  }

  destination(): Point {
    const destination = new PointXY(this.B)
    destination.setDrawConfigOf(this)
    return destination
  }

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
}

export class SegmentParallel extends Segment implements Resizable {
  static type = 'SegmentParallel' as const
  line: Line | HalfLine | Segment
  O: Point
  origin(): Point {
    this.O.setDrawConfigOf(this)
    return this.O
  }

  destination(): Point {
    this.O.setDrawConfigOf(this)
    this.line.setDrawConfigOf(this)
    return this.O.plus(this.line.dirVect())
  }

  getHandles(): (Point & Translatable)[] {
    return isTranslatable(this.O) ? [this.O] : []
  }

  constructor(O: Point, line: Line | HalfLine | Segment, options?: GraphOptions) {
    super(options)
    this.O = O
    this.line = line
  }
}

export class SegmentOrthogonal extends Segment implements Resizable {
  static type = 'SegmentOrthogonal' as const
  line: Line | HalfLine | Segment
  O: Point

  getHandles(): (Point & Translatable)[] {
    return isTranslatable(this.O) ? [this.O] : []
  }

  origin(): Point {
    this.O.setDrawConfigOf(this)
    this.line.setDrawConfigOf(this)
    const ortho = this.line.orthoProjection(this.O)
    ortho.setDrawConfigOf(this)
    return ortho
  }

  destination(): Point {
    this.line.setDrawConfigOf(this)
    const line = new LineOrthogonal(this.origin(), this.line)
    // This will handle the case when O is away from the line.
    const dest = line.orthoProjection(this.O)
    dest.setDrawConfigOf(this)
    return dest
  }

  constructor(O: Point, line: Line | HalfLine | Segment, options?: GraphOptions) {
    super(options)
    this.O = O
    this.line = line
  }
}

export class SegmentAB extends Segment implements Resizable {
  static type = 'SegmentAB' as 'SegmentAB' | 'SegmentTranslatable' | 'SegmentDependant'
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

  origin(): Point {
    this.A.setDrawConfigOf(this)
    return this.A
  }

  destination(): Point {
    this.B.setDrawConfigOf(this)
    return this.B
  }
}

/** A segment that will be destroyed if on of the edges is being destroyed */
export class SegmentDependant extends SegmentAB {
  static type = 'SegmentDependant' as const
  constructor(A: Point = new PointXY(), B: Point = new PointXY(), options?: GraphOptions) {
    super(A, B, options)
    this.A.dependants.push(this)
    this.B.dependants.push(this)
  }

  getDependencies() {
    return [this.A, this.B]
  }
}

export class SegmentTranslatable extends SegmentAB implements Translatable, Resizable {
  static type = 'SegmentTranslatable' as const

  constructor(
    A: Point & Translatable = new PointXY(),
    B: Point & Translatable = new PointXY(),
    options?: GraphOptions
  ) {
    super(A, B, options)
  }

  translate(translationVector: Coordinates) {
    this.origin().translate(translationVector)
    this.destination().translate(translationVector)
  }

  origin(): Point & Translatable {
    this.A.setDrawConfigOf(this)
    return this.A as PointXY
  }

  destination(): Point & Translatable {
    this.B.setDrawConfigOf(this)
    return this.B as PointXY
  }
}

export class SegmentReverted extends Segment {
  static type = 'SegmentReverted' as const
  segment: Segment
  constructor(segment: Segment = new SegmentAB(), options?: GraphOptions) {
    super(options)
    this.segment = segment
    this.segment.dependants.push(this)
  }

  getDependencies() {
    return [this.segment]
  }

  origin(): Point {
    this.segment.setDrawConfigOf(this)
    return this.segment.destination()
  }

  destination(): Point {
    this.segment.setDrawConfigOf(this)
    return this.segment.origin()
  }
}
