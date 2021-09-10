import { Coordinates, DrawConfig, Resizable, Translatable } from '../../types'

import { angleABC, distance, distanceCoords, rotate, vector, isTranslatable } from '../maths'

import { CircleORay } from './Circle'
import GraphElement, { GraphOptions } from './GraphElement'
import Point, { PointXY, Projected } from './Point'
type ArcAttributes = {
  d: string
  strokeWidth: string | number
  strokeLinecap: string
  stroke: string
  fill: string
}
export default abstract class Arc extends GraphElement<ArcAttributes> {
  abstract center(): Point
  abstract origin(): Point
  abstract sweep(): number

  destination(): Point {
    const dest = this.center().plus(
      rotate(vector(this.center(), this.origin()), this.sweep())
    )
    dest.setDrawConfigOf(this)
    return dest
  }

  ray() {
    return distance(this.center(), this.origin())
  }

  getDrawingAttributesImpl() {
    const { strokeScale }: Pick<DrawConfig, 'strokeScale'> = this.getDrawConfig()
    const A = this.origin().toCoords()
    const r = this.ray()
    const B = this.destination().toCoords()
    const sweep = this.sweep()
    const sweepFlag = sweep > 0 ? 1 : 0
    const largeArcFlag = Math.abs(sweep) > Math.PI ? 1 : 0
    const attrs: ArcAttributes = {
      d: `M ${A.x},${A.y} A ${r},${r} 0 ${largeArcFlag} ${sweepFlag} ${B.x} ${B.y}`,
      stroke: this.color,
      strokeWidth: (this.strokeWidth || 1) * strokeScale,
      strokeLinecap: 'round',
      fill: 'none',
    }
    return attrs
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
    circle.setDrawConfigOf(this)
    return circle
  }

  originVect() {
    return vector(this.center(), this.origin())
  }

  middle() {
    const halfSweep = this.sweep() / 2
    const mid = this.center().plus(rotate(vector(this.center(), this.origin()), halfSweep))
    mid.setDrawConfigOf(this)
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

export class ArcOAB extends Arc implements Resizable {
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
    lastSweep = 0,
    options?: GraphOptions
  ) {
    super(options)
    this.O = O
    this.A = A
    this.B = B
    this.lastSweep = lastSweep
  }

  getHandles(): (Point & Translatable)[] {
    return [this.A, this.B, this.O].filter(elt => isTranslatable(elt)) as (Point &
      Translatable)[]
  }

  center() {
    this.O.setDrawConfigOf(this)
    return this.O
  }

  origin() {
    this.A.setDrawConfigOf(this)
    return this.A
  }

  destination() {
    const dest = new Projected(this.getCircle(), this.B)
    dest.setDrawConfigOf(this)
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
  constructor(arc: Arc = new ArcOAB(), P: Point = new PointXY(), options?: GraphOptions) {
    super(options)
    this.arc = arc
    arc.dependants.push(this)
    arc.origin().dependants.push(this)
    this.P = P
    P.dependants.push(this)
  }

  getDependencies() {
    return [this.arc, this.arc.origin(), this.destination()]
  }

  center(): Point {
    const center = this.arc.center()
    center.setDrawConfigOf(this)
    return center
  }

  origin(): Point {
    const origin = this.arc.origin()
    origin.setDrawConfigOf(this)
    return origin
  }

  sweep(): number {
    return angleABC(this.origin(), this.center(), this.P, this.arc.sweep())
  }
}

export class ArcTranslatable extends ArcOAB implements Translatable, Resizable {
  static type = 'ArcTranslatable' as const
  constructor(
    O: Point & Translatable = new PointXY(),
    A: Point & Translatable = new PointXY(),
    B: Point & Translatable = new PointXY(),
    lastSweep = 0,
    options?: GraphOptions
  ) {
    super(O, A, B, lastSweep, options)
  }

  translate(vector: Coordinates): void {
    ;(this.O as PointXY).translate(vector)
    ;(this.A as PointXY).translate(vector)
    ;(this.B as PointXY).translate(vector)
  }
}
