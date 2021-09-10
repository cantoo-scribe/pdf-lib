import { Coordinates, DrawConfig, Functional, Resizable, Translatable } from '../../types'
import { intersectionCircle, intersectionLine, intersections } from '../intersections'
import {
  getSpaceRectangle,
  isColinear,
  isEqual,
  minus,
  orthogonal,
  scalar,
  times,
  vector,
  isTranslatable
} from '../maths'

import Circle, { CircleOA } from './Circle'
import GraphElement, { GraphOptions } from './GraphElement'
import HalfLine from './HalfLine'
import Point, { PointXY } from './Point'
import Segment, { SegmentAB } from './Segment'

export type LineAttributes = {
  x1: string | number
  x2: string | number
  y1: string | number
  y2: string | number
  strokeWidth: string | number
  strokeLinecap: string
  stroke: string
}

export default abstract class Line
  extends GraphElement<LineAttributes>
  implements Functional {
  /** The origin of the line */
  abstract origin(): Point
  /** Direction vector */
  abstract dirVect(): Coordinates
  /** Line equation */
  y(x: number) {
    const a = this.a()
    const b = this.b()
    return a * x + b
  }

  /** The slope */
  a() {
    const dirVect = this.dirVect()
    return dirVect.y / dirVect.x
  }

  /** Origin y coordinate */
  b() {
    const O = this.origin().toCoords()
    const a = this.a()
    return O.y - a * O.x
  }

  isEqual(element: GraphElement): boolean {
    const vect = this.dirVect()
    return (
      element instanceof Line &&
      isColinear(vect, element.dirVect()) &&
      (isEqual(vect.x, 0)
        ? // We need to take care of the case of the vertical line
          isEqual(this.origin().toCoords().x, element.origin().toCoords().x)
        : isEqual(this.b(), element.b()))
    )
  }

  /** Reversed line equation */
  x(y: number) {
    const dirVect = this.dirVect()
    return ((y - this.b()) * dirVect.x) / dirVect.y
  }

  includes(P: Point) {
    const { x, y } = P.toCoords()
    const vect = this.dirVect()
    return isEqual(vect.x, 0)
      ? isEqual(this.origin().toCoords().x, x)
      : isEqual(this.y(x), y)
  }

  orthoProjection(P: Point): PointXY {
    const vectOrtho = orthogonal(this.dirVect())
    const A = new PointXY(P.toCoords())
    const ortho = new LineAB(A, A.plus(vectOrtho))
    const H = intersectionLine(this, ortho)[0]
    return new PointXY(H)
  }

  /** This is used to standarsize type Segment | HalfLine | Line */
  getLine() {
    const line = new LineOVect(this.origin(), this.dirVect(), this.options)
    line.setDrawConfigOf(this)
    return line
  }

  getDrawingAttributesImpl() {
    const {
      strokeScale,
      space,
    }: Pick<DrawConfig, 'strokeScale' | 'space'> = this.getDrawConfig()
    const rect = getSpaceRectangle(space)
    // We only need to draw the part that crosses the viewbox
    const [A, B] = intersections(rect, this) as
      | []
      | [Coordinates]
      | [Coordinates, Coordinates]
    // If the halfline doesn't meet the viewbox, we don't draw the line
    if (!A || !B) return null
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

export class LineAB extends Line implements Resizable {
  static type = 'LineAB' as 'LineAB' | 'LineTranslatable'

  getHandles(): (Point & Translatable)[] {
    return [this.A, this.B].filter(elt => isTranslatable(elt)) as (Point & Translatable)[]
  }

  origin(): Point {
    return this.A
  }

  dirVect(): Coordinates {
    return vector(this.A, this.B)
  }

  A: Point
  B: Point

  constructor(A: Point = new PointXY(), B: Point = new PointXY(), options?: GraphOptions) {
    super(options)
    this.A = A
    this.B = B
  }
}

export class LineTangent extends Line implements Resizable {
  static type = 'LineTangent' as const
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
    return this.A
  }

  dirVect(): Coordinates {
    const center = new PointXY(this.circle.center().toCoords())
    const O = new SegmentAB(this.A, center).middle().toCoords()
    const C = new CircleOA(new PointXY(O), center)
    const origin = this.origin().toCoords()
    const [P1, P2] = intersectionCircle(this.circle, C)
    if (!P1) return { x: 0, y: 0 }
    else if (!P2) return minus(P1, origin)
    else if (scalar(orthogonal(minus(O, origin)), minus(P1, O)) > 0 === this.positive)
      return minus(P1, origin)
    return minus(P2, origin)
  }
}

export class LineTranslatable extends LineAB implements Translatable {
  static type = 'LineTranslatable' as const
  constructor(
    A: Point & Translatable = new PointXY(),
    B: Point & Translatable = new PointXY(),
    options?: GraphOptions
  ) {
    super(A, B, options)
  }

  translate(vector: Coordinates): void {
    ;(this.A as PointXY).translate(vector)
    ;(this.B as PointXY).translate(vector)
  }
}

export class LineOVect extends Line implements Resizable {
  static type = 'LineOVect' as const
  O: Point
  vect: Coordinates

  constructor(
    O: Point = new PointXY(),
    vect: Coordinates = { x: 1, y: 1 },
    options?: GraphOptions
  ) {
    super(options)
    this.O = O
    this.vect = vect
  }

  getHandles(): (Point & Translatable)[] {
    return isTranslatable(this.O) ? [this.O] : []
  }

  origin(): Point {
    return this.O
  }

  dirVect(): Coordinates {
    return this.vect
  }
}

export class LineParallel extends Line implements Resizable {
  static type = 'LineParallel' as 'LineParallel' | 'LineOrthogonal'
  O: Point
  line: Line | Segment | HalfLine

  constructor(
    O: Point = new PointXY(),
    line: Line | Segment | HalfLine = new LineAB(),
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
    return this.O
  }

  dirVect(): Coordinates {
    return this.line.dirVect()
  }
}

export class LineOrthogonal extends LineParallel {
  static type = 'LineOrthogonal' as const

  dirVect(): Coordinates {
    return orthogonal(this.line.dirVect())
  }
}

export class LineReverted extends Line {
  static type = 'LineReverted' as const
  line: Line
  constructor(line: Line = new LineAB(), options?: GraphOptions) {
    super(options)
    this.line = line
    this.line.dependants.push(this)
  }

  getDependencies() {
    return [this.line]
  }

  origin(): Point {
    return this.line.origin()
  }

  dirVect(): Coordinates {
    return times(this.line.dirVect(), -1)
  }
}