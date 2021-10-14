import { distance, isColinear, norm, scalar, vector } from '../maths'

import GraphElement from './GraphElement'
import { LineOVect } from './Line'
import Point, { PointRatio, PointXY } from './Point'

export default abstract class Segment extends GraphElement {
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
    const line = new LineOVect(this.origin(), this.dirVect())
    return line
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
    const mid = new PointRatio(this.origin(), this, 0.5)
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

export class SegmentAB extends Segment {
  static type = 'SegmentAB'
  A: Point
  B: Point
  constructor(A: Point = new PointXY(), B: Point = new PointXY()) {
    super()
    this.A = A
    this.B = B
  }

  origin(): Point {
    return this.A
  }

  destination(): Point {
    return this.B
  }
}
