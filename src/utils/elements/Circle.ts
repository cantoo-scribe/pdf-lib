import {
  distance,
  distanceCoords,
  isEqual,
  minus,
  plus,
  times,
  unitVector
} from '../maths'

import GraphElement from './GraphElement'
import Point, { PointXY } from './Point'
export default abstract class Circle extends GraphElement{
  abstract ray(): number
  abstract center(): Point

  /** This is used to standardize type Circle | Arc */
  getCircle() {
    return this
  }

  isEqual(element: GraphElement): boolean {
    return (
      element instanceof Circle &&
      this.center().isEqual(element.center()) &&
      isEqual(this.ray(), element.ray())
    )
  }

  includes(P: Point) {
    return isEqual(distance(this.center(), P), this.ray())
  }

  orthoProjection(P: Point) {
    const center = this.center().toCoords()
    const coords = P.toCoords()
    if (distanceCoords(coords, center) < this.ray()) return P
    const vect = times(unitVector(minus(coords, center)), this.ray())
    return new PointXY(plus(center, vect))
  }
}

export class CircleOA extends Circle {
  static type = 'CircleOA' as 'CircleOA' | 'CircleTranslatable'
  O: Point
  A: Point

  constructor(O: Point = new PointXY(), A: Point = new PointXY()) {
    super()
    this.O = O
    this.A = A
  }

  ray() {
    return distance(this.A, this.center())
  }

  center() {
    return this.O
  }
}

export class CircleORay extends Circle {
  static type = 'CircleORay' as const
  O: Point
  r: number

  constructor(O: Point = new PointXY(), r = 1) {
    super()
    this.O = O
    this.r = r
  }

  ray() {
    return this.r
  }

  center() {
    return this.O
  }
}
