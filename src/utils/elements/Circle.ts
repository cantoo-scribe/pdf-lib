import { Coordinates, DrawConfig, Resizable, Translatable } from '../../types'
import {
  distance,
  distanceCoords,
  isEqual,
  minus,
  plus,
  times,
  unitVector,
  isTranslatable
} from '../maths'

import GraphElement, { GraphOptions } from './GraphElement'
import HalfLine from './HalfLine'
import Line, { LineAB } from './Line'
import Point, { PointXY } from './Point'
import Segment from './Segment'

type CircleAttributes = {
  cx: string | number
  cy: string | number
  r: string | number
  strokeWidth: string | number
  stroke?: string
  fill: string
}

export default abstract class Circle extends GraphElement<CircleAttributes> {
  abstract ray(): number
  abstract center(): Point

  filled?: boolean
  constructor(options?: GraphOptions) {
    super(options)
    if (options?.filled) this.filled = options.filled
  }

  get options(): GraphOptions {
    //@ts-ignore
    return { ...super.options, filled: this.filled }
  }

  set options(options: GraphOptions) {
    Object.assign(this, options)
  }

  getDrawingAttributesImpl() {
    const { strokeScale }: Pick<DrawConfig, 'strokeScale'> = this.getDrawConfig()
    const { x, y } = this.center().toCoords()
    const r = this.ray()
    const attrs: CircleAttributes = {
      cx: x,
      cy: y,
      r,
      strokeWidth: (this.strokeWidth || 1) * strokeScale,
      stroke: this.filled ? undefined : this.color || 'black',
      fill: this.filled ? this.color || 'black' : 'none',
    }
    return attrs
  }

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
    if (this.filled && distanceCoords(coords, center) < this.ray()) return P
    const vect = times(unitVector(minus(coords, center)), this.ray())
    return new PointXY(plus(center, vect))
  }
}

export class CircleOA extends Circle implements Resizable {
  static type = 'CircleOA' as 'CircleOA' | 'CircleTranslatable'
  O: Point
  A: Point

  constructor(O: Point = new PointXY(), A: Point = new PointXY(), options?: GraphOptions) {
    super(options)
    this.O = O
    this.A = A
  }

  getHandles(): (Point & Translatable)[] {
    return [this.A, this.O].filter(elt => isTranslatable(elt)) as (Point & Translatable)[]
  }

  ray() {
    this.A.setDrawConfigOf(this)
    return distance(this.A, this.center())
  }

  center() {
    this.O.setDrawConfigOf(this)
    return this.O
  }
}

export class CircleTangent extends Circle implements Resizable {
  static type = 'CircleTangent' as const
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

  ray() {
    this.line.setDrawConfigOf(this)
    return this.line.distance(this.center())
  }

  center() {
    this.O.setDrawConfigOf(this)
    return this.O
  }
}

export class CircleTranslatable extends CircleOA implements Translatable, Resizable {
  static type = 'CircleTranslatable' as const
  constructor(
    O: Point & Translatable = new PointXY(),
    A: Point & Translatable = new PointXY(),
    options?: GraphOptions
  ) {
    super(O, A, options)
  }

  getHandles() {
    return [this.A as PointXY, this.O as PointXY]
  }

  translate(vector: Coordinates): void {
    ;(this.O as PointXY).translate(vector)
    ;(this.A as PointXY).translate(vector)
  }
}

export class CircleORay extends Circle {
  static type = 'CircleORay' as const
  O: Point
  r: number

  constructor(O: Point = new PointXY(), r = 1, options?: GraphOptions) {
    super(options)
    this.O = O
    this.r = r
  }

  ray() {
    return this.r
  }

  center() {
    this.O.setDrawConfigOf(this)
    return this.O
  }
}
