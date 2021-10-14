import { angleABC, distance, distanceCoords, rotate, vector } from '../maths'

import { CircleORay } from './Circle'
import GraphElement from './GraphElement'
import Point, { PointXY, Projected } from './Point'

export default abstract class Arc extends GraphElement {
  abstract center(): Point
  abstract origin(): Point
  abstract sweep(): number

  destination(): Point {
    const dest = this.center().plus(
      rotate(vector(this.center(), this.origin()), this.sweep())
    )
    return dest
  }

  ray() {
    return distance(this.center(), this.origin())
  }

  isEqual(element: GraphElement): boolean {
    if (!(element instanceof Arc)) return false
    const dest = this.destination()
    const o = this.origin()
    const eDest = element.destination()
    const eO = element.origin()
    return (
      this.getCircle().isEqual(element.getCircle()) &&
      ((dest.isEqual(eDest) && o.isEqual(eO)) || (dest.isEqual(eO) && o.isEqual(eDest)))
    )
  }

  getCircle() {
    const circle = new CircleORay(this.center(), this.ray())
    return circle
  }

  originVect() {
    return vector(this.center(), this.origin())
  }

  middle() {
    const halfSweep = this.sweep() / 2
    const mid = this.center().plus(rotate(vector(this.center(), this.origin()), halfSweep))
    return mid
  }

  includes(P: Point) {
    // As angles are returned between -π and π, we need the middle of the arc
    return (
      this.getCircle().includes(P) &&
      Math.abs(angleABC(this.middle(), this.center(), P)) <= Math.abs(this.sweep() / 2)
    )
  }

  orthoProjection(P: Point) {
    const H = this.getCircle().orthoProjection(P)
    if (this.includes(H)) return H
    else {
      const origin = this.origin().toCoords()
      const destination = this.destination().toCoords()
      // Returns the closest between origin and destination
      const coords =
        distanceCoords(H.toCoords(), origin) < distanceCoords(H.toCoords(), destination)
          ? origin
          : destination
      return new PointXY(coords)
    }
  }
}

export class ArcOAB extends Arc {
  static type = 'ArcOAB' as 'ArcOAB' | 'ArcTranslatable'
  O: Point
  A: Point
  B: Point
  /** Last sweep. Used to deduce the angle orientation */
  lastSweep: number

  constructor(
    O: Point = new PointXY(),
    A: Point = new PointXY(),
    B: Point = new PointXY(),
    lastSweep = 0
  ) {
    super()
    this.O = O
    this.A = A
    this.B = B
    this.lastSweep = lastSweep
  }

  center() {
    return this.O
  }

  origin() {
    return this.A
  }

  destination() {
    const dest = new Projected(this.getCircle(), this.B)
    return dest
  }

  sweep() {
    this.lastSweep = angleABC(
      this.origin(),
      this.center(),
      this.destination(),
      this.lastSweep
    )
    return this.lastSweep
  }
}

/** Create an Arc that will be removed if the original support is removed, or the origin of the arc. */
export class ArcDependant extends Arc {
  static type = 'ArcDependant' as const
  arc: Arc
  P: Point
  constructor(arc: Arc = new ArcOAB(), P: Point = new PointXY()) {
    super()
    this.arc = arc
    this.P = P
  }

  getDependencies() {
    return [this.arc, this.arc.origin(), this.destination()]
  }

  center(): Point {
    const center = this.arc.center()
    return center
  }

  origin(): Point {
    const origin = this.arc.origin()
    return origin
  }

  sweep(): number {
    return angleABC(this.origin(), this.center(), this.P, this.arc.sweep())
  }
}
