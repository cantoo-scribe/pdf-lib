import { Coordinates, DrawConfig, Resizable, Rotatable, Translatable } from '../../types'
import { isTranslatable } from '../maths'
import GraphElement, { GraphOptions } from './GraphElement'
import Point, { Handle, PointXY } from './Point'
import { SegmentAB } from './Segment'

export type RectangleAttributes = {
  x: string | number
  y: string | number
  width: string | number
  height: string | number
  rx?: string | number
  ry?: string | number
  fill: string
  stroke?: string
  strokeWidth?: string | number
  transform?: string
}


export default abstract class Rectangle extends GraphElement<RectangleAttributes> {
  rounded?: boolean
  filled?: boolean
  constructor(options?: GraphOptions) {
    super(options)
    if (options?.filled) this.filled = options.filled
    if (options?.rounded) this.rounded = options.rounded
  }

  get options(): GraphOptions {
    // @ts-ignore
    return { ...super.options, filled: this.filled, rounded: this.rounded }
  }

  set options(options: GraphOptions) {
    Object.assign(this, options)
  }

  getStart() {
    const start = new PointXY(this.getCoords())
    start.setDrawConfigOf(this)
    return start
  }

  getEnd() {
    const { width, height } = this.getSize()
    const end = new PointXY(this.getStart()).plus({ x: width, y: -height })
    end.setDrawConfigOf(this)
    return end
  }

  center() {
    const center = new SegmentAB(this.getStart(), this.getEnd()).middle()
    center.setDrawConfigOf(this)
    return center
  }

  isEqual(element: GraphElement): boolean {
    return (
      element instanceof Rectangle &&
      this.getStart().isEqual(element.getStart()) &&
      this.getEnd().isEqual(element.getEnd())
    )
  }

  orthoProjection(P: Point) {
    const { x, y } = this.getCoords()
    const end = this.getEnd().toCoords()
    const { x: Px, y: Py } = P.toCoords()
    const Hx = Px < x ? x : Px > end.x ? end.x : Px
    const Hy = Py > y ? y : Py < end.y ? end.y : Py
    return new PointXY({ x: Hx, y: Hy })
  }

  abstract getCoords(): Coordinates

  abstract getSize(): { width: number; height: number }

  getDrawingAttributesImpl() {
    const { strokeScale }: Pick<DrawConfig, 'strokeScale'> = this.getDrawConfig()
    const { x, y } = this.getCoords()
    const { width, height } = this.getSize()
    const attrs: RectangleAttributes = {
      x,
      y: y - height,
      rx: this.rounded ? width / 10 : undefined,
      ry: this.rounded ? height / 10 : undefined,
      width,
      height,
      stroke: this.filled ? undefined : this.color || 'black',
      fill: this.filled ? this.color || 'black' : 'none',
      strokeWidth: this.filled ? undefined : (this.strokeWidth || 1) * strokeScale,
    }
    return attrs
  }
}

export class RectangleAC extends Rectangle implements Resizable {
  static type = 'RectangleAC' as 'RectangleAC' | 'RectangleTranslatable'
  start: Point
  end: Point
  constructor(
    start: Point = new PointXY(),
    end: Point = new PointXY(),
    options?: GraphOptions
  ) {
    super(options)
    this.start = start
    this.end = end
  }

  getHandles(): (Point & Translatable)[] {
    return [this.start, this.end].filter(elt => isTranslatable(elt)) as (Point &
      Translatable)[]
  }

  getSize() {
    const start = this.start.toCoords()
    const end = this.end.toCoords()
    return {
      width: Math.abs(start.x - end.x),
      height: Math.abs(start.y - end.y),
    }
  }

  getCoords() {
    this.start.setDrawConfigOf(this)
    this.end.setDrawConfigOf(this)
    const start = this.start.toCoords()
    const end = this.end.toCoords()
    return {
      x: Math.min(start.x, end.x),
      y: Math.max(start.y, end.y),
    }
  }
}
export class RectangleTranslatable
  extends RectangleAC
  implements Translatable, Resizable, Rotatable {
  static type = 'RectangleTranslatable' as const
  rotation?: number
  constructor(
    start: Point & Translatable = new PointXY(),
    end: Point & Translatable = new PointXY(),
    options?: GraphOptions
  ) {
    super(start, end, options)
  }

  rotate(angle: number): void {
    this.rotation = ((this.rotation || 0) + angle) % 360
  }

  translate(vector: Coordinates): void {
    ;(this.start as PointXY).translate(vector)
    ;(this.end as PointXY).translate(vector)
  }

  getDrawingAttributesImpl() {
    const attrs = super.getDrawingAttributesImpl()
    const { x, y } = this.getCoords()
    const { width, height } = this.getSize()

    attrs.transform = this.rotation
      ? `rotate(${this.rotation} ${x + width / 2} ${y - height / 2})`
      : ''

    return attrs
  }

  getHandles() {
    const P1 = new Handle(this.start as PointXY, (vector: Coordinates) =>
      (this.start as PointXY).translate(vector)
    )
    const P2 = new Handle(this.end as PointXY, (vector: Coordinates) =>
      (this.end as PointXY).translate(vector)
    )
    return [P1, P2]
  }
}
