import type { Coordinates, GraphicElement } from '../../types'

import {
  isEqual,

  plus,
  norm,
  times,

} from '../maths'
import GraphElement from './GraphElement'
import Line from './Line'
import Segment from './Segment'
import { SegmentAB } from '.'

export default abstract class Point extends GraphElement {
  abstract toCoords(): Coordinates

  isEqual(element: GraphElement): boolean {
    if (!(element instanceof Point)) return false
    const A = this.toCoords()
    const B = element.toCoords()
    return isEqual(A.x, B.x) && isEqual(A.y, B.y)
  }

  orthoProjection() {
    return new PointXY(this.toCoords())
  }

  plus(vect: Coordinates) {
    const P = new PointXY(plus(this.toCoords(), vect))
    return P
  }
}

export class PointFixed extends Point {
  static type = 'PointFixed'

  x: number
  y: number

  constructor(coords = { x: 0, y: 0 }) {
    super()
    this.x = coords.x
    this.y = coords.y
  }

  toCoords() {
    return { x: this.x, y: this.y }
  }
}

export class PointXY extends PointFixed {
  static type = 'PointXY'

  translate(translationVector: Coordinates) {
    this.x += translationVector.x
    this.y += translationVector.y
  }
}

export class PointRatio extends Point {
  static type = 'PointRatio'
  O: Point
  axis: Line | Segment
  ratio: number

  constructor(
    O: Point = new PointXY(),
    axis: Line | Segment = new SegmentAB(),
    ratio = 1
  ) {
    super()
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
    return plus(this.O.toCoords(), times(this.axis.dirVect(), this.ratio))
  }
}


export class Projected extends Point {
  static type = 'Projected' as const
  support: Exclude<GraphicElement, Point>
  P: Point
  constructor(
    support: Exclude<GraphicElement, Point> = new SegmentAB(),
    P: Point = new PointXY()
  ) {
    super()
    this.support = support
    this.P = P
  }

  toCoords(): Coordinates {
    return this.support.orthoProjection(this.P).toCoords()
  }
}