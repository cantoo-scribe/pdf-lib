import { Coordinates, DrawConfig, Resizable, Translatable } from '../../types'
import { intersectionCircle, intersections } from '../intersections'
import { getSpaceRectangle, minus, orthogonal, scalar, times, vector, isTranslatable } from '../maths'

import Circle, { CircleOA } from './Circle'
import GraphElement, { GraphOptions } from './GraphElement'
import Line, { LineOVect, LineAttributes } from './Line'
import Point, { PointXY } from './Point'
import Segment, { SegmentAB } from './Segment'

export default abstract class HalfLine extends GraphElement<LineAttributes> {
  /** The origin of the line */
  abstract origin(): Point
  /** Direction vector */
  abstract dirVect(): Coordinates
  /** Equivalent line */
  getLine() {
    const line = new LineOVect(this.origin(), this.dirVect(), this.options)
    line.setDrawConfigOf(this)
    return line
  }

  isEqual(element: GraphElement): boolean {
    return (
      element instanceof HalfLine &&
      element.getLine().isEqual(this.getLine()) &&
      scalar(this.dirVect(), element.dirVect()) > 0
    )
  }

  includes(P: Point) {
    return (
      this.getLine().includes(P) && scalar(vector(this.origin(), P), this.dirVect()) >= 0
    )
  }

  orthoProjection(P: Point) {
    const H = this.getLine().orthoProjection(P)
    if (this.includes(H)) return H
    else return this.origin()
  }

  getDrawingAttributesImpl() {
    const {
      strokeScale,
      space,
    }: Pick<DrawConfig, 'strokeScale' | 'space'> = this.getDrawConfig()
    const rect = getSpaceRectangle(space)
    const inters = intersections(rect, this)
    // We will draw the line between the origin and one border, or between 2 borders
    const [A, B] = [...inters, this.origin().toCoords()] as
      | [Coordinates]
      | [Coordinates, Coordinates]
      | [Coordinates, Coordinates, Coordinates]
    // If the halfline doesn't meet the viewbox, we don't draw the line
    if (!B) return null
    const { x: x1, y: y1 } = A
    const { x: x2, y: y2 } = B
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
}

export class HalfLineTangent extends HalfLine implements Resizable {
  static type = 'HalfLineTangent' as const
  A: Point
  circle: Circle
  positive: boolean
  constructor(
    A: Point = new PointXY(),
    circle: Circle = new CircleOA(),
    positive = true,
    options?: GraphOptions
  ) {
    super(options)
    this.A = A
    this.circle = circle
    this.positive = positive
  }

  getHandles(): (Point & Translatable)[] {
    return isTranslatable(this.A) ? [this.A] : []
  }

  origin(): Point {
    this.A.setDrawConfigOf(this)
    return this.A
  }

  dirVect(): Coordinates {
    const C = new CircleOA(
      new SegmentAB(this.A, this.circle.center()).middle(),
      this.circle.center()
    )
    const [P1, P2] = intersectionCircle(this.circle, C)
    if (!P1) return { x: 0, y: 0 }
    else if (!P2) return minus(P1, this.origin().toCoords())
    else if (
      scalar(
        orthogonal(vector(this.origin(), C.center())),
        vector(C.center(), new PointXY(P1))
      ) >
        0 ===
      this.positive
    )
      return minus(P1, this.origin().toCoords())
    return minus(P2, this.origin().toCoords())
  }
}

export class HalfLineOVect extends HalfLine implements Resizable {
  static type = 'HalfLineOVect' as const
  A: Point
  v: Coordinates

  constructor(
    A: Point = new PointXY(),
    v: Coordinates = { x: 1, y: 0 },
    options?: GraphOptions
  ) {
    super(options)
    this.A = A
    this.v = v
  }

  getHandles(): (Point & Translatable)[] {
    return isTranslatable(this.A) ? [this.A] : []
  }

  origin(): Point {
    this.A.setDrawConfigOf(this)
    return this.A
  }

  dirVect(): Coordinates {
    return this.v
  }
}

export class HalfLineAB extends HalfLine implements Resizable {
  static type = 'HalfLineAB' as 'HalfLineAB' | 'HalfLineTranslatable'
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

  dirVect(): Coordinates {
    return vector(this.A, this.B)
  }
}

export class HalfLineTranslatable extends HalfLineAB implements Translatable {
  static type = 'HalfLineTranslatable' as const

  constructor(
    A: Point & Translatable = new PointXY(),
    B: Point & Translatable = new PointXY(),
    options?: GraphOptions
  ) {
    super(A, B, options)
  }

  translate(vector: Coordinates): void {
    ;(this.origin() as PointXY).translate(vector)
  }
}

export class HalfLineParallel extends HalfLine implements Resizable {
  static type = 'HalfLineParallel' as 'HalfLineParallel' | 'HalfLineOrthogonal'
  O: Point
  line: Line | Segment | HalfLine

  constructor(
    O: Point = new PointXY(),
    line: Line | Segment | HalfLine = new HalfLineAB(),
    options?: GraphOptions
  ) {
    super(options)
    this.O = O
    this.line = line
  }

  getHandles(): (Point & Translatable)[] {
    return isTranslatable(this.O) ? [this.O] : []
  }

  origin(): Point {
    this.O.setDrawConfigOf(this)
    return this.O
  }

  dirVect(): Coordinates {
    return this.line.dirVect()
  }
}

export class HalfLineOrthogonal extends HalfLineParallel {
  static type = 'HalfLineOrthogonal' as const

  origin(): Point {
    const ortho = this.line.orthoProjection(this.O)
    ortho.setDrawConfigOf(this)
    return ortho
  }

  dirVect(): Coordinates {
    const ortho = orthogonal(this.line.dirVect())
    return scalar(ortho, vector(this.origin(), this.O)) > 0 ? ortho : times(ortho, -1)
  }
}
