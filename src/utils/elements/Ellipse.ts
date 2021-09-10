import { Coordinates, DrawConfig, Size, Resizable, Translatable } from '../../types'
import {
  angle,
  distance,
  isEqual,
  orientation,
  orthogonal,
  rotate,
  times,
  toDegrees,
  unitVector,
  vector,
  isTranslatable,
} from '../maths'

import GraphElement, { GraphOptions } from './GraphElement'
import Point, { PointXY } from './Point'
import Segment, { SegmentAB } from './Segment'
type EllipseAttributes = {
  cx: string | number
  cy: string | number
  rx: string | number
  ry: string | number
  strokeWidth: string | number
  stroke?: string
  fill: string
  transform: string
}
export default abstract class Ellipse extends GraphElement<EllipseAttributes> {
  filled?: boolean
  constructor(options?: GraphOptions) {
    super(options)
    if (options?.filled) this.filled = options.filled
  }

  get options(): GraphOptions {
    // @ts-ignore
    return { ...super.options, filled: this.filled }
  }

  set options(options: GraphOptions) {
    Object.assign(this, options)
  }

  abstract center(): Point
  abstract a(): number
  abstract b(): number
  abstract rotation(): number

  getDrawingAttributesImpl() {
    const { strokeScale }: Pick<DrawConfig, 'strokeScale'> = this.getDrawConfig()
    const { x, y } = this.center().toCoords()
    const rx = this.a()
    const ry = this.b()
    const rotation = this.rotation()
    const attrs: EllipseAttributes = {
      cx: x,
      cy: y,
      rx,
      ry,
      transform: `rotate(${toDegrees(rotation)} ${x} ${y})`,
      strokeWidth: (this.strokeWidth || 1) * strokeScale,
      stroke: this.filled ? undefined : this.color || 'black',
      fill: this.filled ? this.color || 'black' : 'none',
    }
    return attrs
  }

  /** Segment representing the main axis */
  axis(): Segment {
    const vect = rotate({ x: 1, y: 0 }, this.rotation())
    const a = this.a()
    const C = this.center()
    const axis = new SegmentAB(C.plus(times(vect, -a)), C.plus(times(vect, a)))
    axis.setDrawConfigOf(this)
    return axis
  }

  getSize(): Size {
    return { width: 2 * this.a(), height: 2 * this.b() }
  }

  isEqual(element: GraphElement): boolean {
    if (!(element instanceof Ellipse)) return false
    const a = this.a()
    const b = this.b()
    const rotation = this.rotation()
    const eltA = element.a()
    const eltB = element.b()
    const eltRotation = element.rotation()
    // If the main axis is the same on both ellipse
    if (eltA < eltB === a < b) {
      // The rotation is equivalent module PI as the element is symetrical
      return (
        isEqual(eltA, a) &&
        isEqual(eltB, b) &&
        isEqual(rotation + (Math.PI % Math.PI), eltRotation + (Math.PI % Math.PI))
      )
    }
    // If the small axis is different
    else {
      // We add a rotation of PI / 2 to emulate the fact that the main axis are actually orthogonal
      return (
        isEqual(eltA, b) &&
        isEqual(eltB, a) &&
        isEqual(
          rotation + (Math.PI % Math.PI),
          eltRotation + (((3 * Math.PI) / 2) % Math.PI)
        )
      )
    }
  }

  includes(P: Point) {
    const { x, y } = P.toCoords()
    const { x: cx, y: cy } = this.center().toCoords()
    const teta = this.rotation()
    return isEqual(
      Math.pow(((x - cx) * Math.cos(teta) + (y - cy) * Math.sin(teta)) / this.a(), 2) +
        Math.pow(((x - cx) * Math.sin(teta) - (y - cy) * Math.cos(teta)) / this.b(), 2),
      1
    )
  }

  orthoProjection(P: Point) {
    // We will consider that the parametric projection is a correct approximation of the distance for the current case, even if it is not orthogonal
    const C = this.center()
    const axis = this.axis()
    const CP = vector(C, P)
    const teta = angle(axis.dirVect(), vector(C, P))
    const ray = this.polarRay(teta)
    if (this.filled && distance(P, this.center()) < ray) return P
    const vect = times(unitVector(CP), ray)
    return new PointXY(this.center().plus(vect).toCoords())
  }

  polarRay(teta: number) {
    const a = this.a()
    const b = this.b()
    const excentricity = Math.sqrt(Math.abs(a * a - b * b)) / Math.max(a, b)
    return Math.min(a, b) / Math.sqrt(1 - Math.pow(excentricity * Math.cos(teta), 2))
  }
}

export class EllipseABC extends Ellipse implements Resizable {
  static type = 'EllipseABC' as 'EllipseABC' | 'EllipseTranslatable'
  A: Point
  B: Point
  C: Point

  constructor(
    A: Point = new PointXY(),
    B: Point = new PointXY(),
    C: Point = new PointXY(),
    options?: GraphOptions
  ) {
    super(options)
    this.A = A
    this.B = B
    this.C = C
  }

  getHandles(): (Point & Translatable)[] {
    return [this.A, this.B, this.C].filter(elt => isTranslatable(elt)) as (Point &
      Translatable)[]
  }

  center(): Point {
    const center = this.axis().middle()
    center.setDrawConfigOf(this)
    return center
  }

  axis(): Segment {
    const axis = new SegmentAB(this.A, this.B)
    axis.setDrawConfigOf(this)
    return axis
  }

  a(): number {
    const axis = this.axis()
    return Math.max(axis.length() / 2, axis.distance(this.C))
  }

  b(): number {
    const axis = this.axis()
    return Math.min(axis.length() / 2, axis.distance(this.C))
  }

  rotation(): number {
    const axis = this.axis()
    return axis.length() / 2 > axis.distance(this.C)
      ? orientation(axis.dirVect())
      : orientation(orthogonal(axis.dirVect()))
  }
}

export class EllipseTranslatable extends EllipseABC implements Translatable, Resizable {
  static type = 'EllipseTranslatable' as const
  constructor(
    A: Point & Translatable = new PointXY(),
    B: Point & Translatable = new PointXY(),
    C: Point & Translatable = new PointXY(),
    options?: GraphOptions
  ) {
    super(A, B, C, options)
  }

  translate(vector: Coordinates): void {
    ;(this.A as PointXY).translate(vector)
    ;(this.B as PointXY).translate(vector)
    ;(this.C as PointXY).translate(vector)
  }
}

export class EllipseAB extends Ellipse implements Resizable {
  static type = 'EllipseAB' as 'EllipseAB' | 'EllipseABTranslatable'
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

  center(): Point {
    this.A.setDrawConfigOf(this)
    this.B.setDrawConfigOf(this)
    const vect = times(vector(this.A, this.B), 0.5)
    const center = this.A.plus(vect)
    center.setDrawConfigOf(this)
    return center
  }

  axis(): Segment {
    const axis = new SegmentAB(this.A, this.B)
    axis.setDrawConfigOf(this)
    return axis
  }

  a(): number {
    const axis = this.axis().dirVect()
    return Math.abs(axis.x / 2)
  }

  b(): number {
    const axis = this.axis().dirVect()
    return Math.abs(axis.y / 2)
  }

  rotation(): number {
    return 0
  }
}

export class EllipseABTranslatable extends EllipseAB implements Translatable, Resizable {
  static type = 'EllipseABTranslatable' as const
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
