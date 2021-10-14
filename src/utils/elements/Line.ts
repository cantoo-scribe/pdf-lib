import { Coordinates } from '../../types'
import { intersectionLine } from '../intersections'
import {
  isColinear,
  isEqual,
  orthogonal,
  vector,
} from '../maths'

import GraphElement from './GraphElement'
import Point, { PointXY } from './Point'

export default abstract class Line extends GraphElement {
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

  /** This is used to standarsize type Segment | HalfLine | Line */
  getLine() {
    const line = new LineOVect(this.origin(), this.dirVect())
    return line
  }

  orthoProjection(P: Point): PointXY {
    const vectOrtho = orthogonal(this.dirVect())
    const A = new PointXY(P.toCoords())
    const ortho = new LineAB(A, A.plus(vectOrtho))
    const H = intersectionLine(this, ortho)[0]
    return new PointXY(H)
  }
}

export class LineAB extends Line {
  static type = 'LineAB'

  origin(): Point {
    return this.A
  }

  dirVect(): Coordinates {
    return vector(this.A, this.B)
  }

  A: Point
  B: Point

  constructor(A: Point = new PointXY(), B: Point = new PointXY()) {
    super()
    this.A = A
    this.B = B
  }
}

export class LineOVect extends Line {
  static type = 'LineOVect' as const
  O: Point
  vect: Coordinates

  constructor(
    O: Point = new PointXY(),
    vect: Coordinates = { x: 1, y: 1 }
  ) {
    super()
    this.O = O
    this.vect = vect
  }

  origin(): Point {
    return this.O
  }

  dirVect(): Coordinates {
    return this.vect
  }
}
