import { Coordinates } from '../../types'
import { intersection } from '../intersections'
import {
  angle,
  distanceCoords,
  isOrthogonal,
  plus,
  times,
  unitVector,
} from '../maths'

import Arc, { ArcOAB } from './Arc'
import GraphElement, { GraphOptions } from './GraphElement'
import HalfLine from './HalfLine'
import Line, { LineAB } from './Line'
import Plot, { PlotStraight } from './Plot'
import Point, { PointXY } from './Point'
import Segment from './Segment'

export type AngleMarkAttributes = (
  | { model: Arc; rightAngle: false }
  | { model: Plot; rightAngle: true }
)

function getOrientedVector(axis: Line | HalfLine | Segment, P: Coordinates) {
  const O = axis.origin().toCoords()
  return axis instanceof Segment &&
    distanceCoords(O, P) > distanceCoords(O, axis.destination().toCoords()) / 2
    ? times(axis.dirVect(), -1)
    : axis.dirVect()
}
export default class AngleMark extends GraphElement<AngleMarkAttributes> {
  static type = 'AngleMark' as const
  axis1: Line | HalfLine | Segment
  axis2: Line | HalfLine | Segment
  /** We need the last sweep to decide the angle signum */
  lastSweep: number

  constructor(
    axis1: Line | HalfLine | Segment = new LineAB(),
    axis2: Line | HalfLine | Segment = new LineAB(),
    sweep = 0,
    options?: GraphOptions
  ) {
    super(options)
    this.axis1 = axis1
    this.axis2 = axis2
    this.lastSweep = sweep
    this.axis1.dependants.push(this)
    this.axis2.dependants.push(this)
  }

  getDependencies() {
    return [this.axis1, this.axis2]
  }

  center() {
    const inter = intersection(this.axis1.getLine(), this.axis2.getLine())
    const center = inter ? new PointXY(inter) : this.axis1.origin()
    center.setDrawConfigOf(this)
    return center
  }

  originVect() {
    return times(unitVector(this.axis1.dirVect()), this.ray())
  }

  isEqual(element: GraphElement): boolean {
    if (!(element instanceof AngleMark)) return false
    else if (this.axis1.isEqual(element.axis1) && this.axis2.isEqual(element.axis2))
      return true
    else if (this.axis1.isEqual(element.axis2) && this.axis2.isEqual(element.axis1))
      return true
    else return false
  }

  sweep() {
    const sweep =
      angle(this.axis1.dirVect(), this.axis2.dirVect(), this.lastSweep) % (2 * Math.PI)
    this.lastSweep = sweep
    return sweep
  }

  ray() {
    const { toRealConverter } = this.getDrawConfig()
    const sweep = this.sweep()
    const orthogonal = isOrthogonal(sweep)
    const SIZE = 40
    const length = toRealConverter.w(orthogonal ? SIZE / Math.sqrt(2) : SIZE)
    const constraints = [length]
    // We don't want the mark to be too big on small segments
    if (this.axis1 instanceof Segment) constraints.push(this.axis1.length() * 0.6)
    if (this.axis2 instanceof Segment) constraints.push(this.axis2.length() * 0.6)
    const size = Math.min(...constraints)
    return size
  }

  getDrawingAttributesImpl(): AngleMarkAttributes | null {
    this.axis1.setDrawConfigOf(this)
    this.axis2.setDrawConfigOf(this)
    const O = this.center().toCoords()
    if (!O) return null

    const size = this.ray()
    const sweep = this.sweep()
    const orthogonal = isOrthogonal(sweep)

    const vectOA = getOrientedVector(this.axis1, O)
    const vectOB = getOrientedVector(this.axis2, O)
    const A = plus(O, times(unitVector(vectOA), size))
    const B = plus(O, times(unitVector(vectOB), size))
    const C = plus(A, times(unitVector(vectOB), size))

    if (orthogonal) {
      const model = new PlotStraight([A, C, B], this.options)
      return {
        rightAngle: true,
        model,
      }
    } else {
      const model = new ArcOAB(
        new PointXY(O),
        new PointXY(A),
        new PointXY(B),
        sweep,
        this.options
      )
      return {
        rightAngle: false,
        model,
      }
    }
  }

  orthoProjection(P: Point): Point {
    const attributes = this.getDrawingAttributesImpl()
    if (!attributes) return new PointXY()
    return attributes.model.orthoProjection(P)
  }
}
