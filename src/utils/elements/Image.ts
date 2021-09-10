import { Coordinates, Resizable, Rotatable, Translatable } from '../../types'
import { plus } from '../maths'

import GraphElement, { GraphOptions } from './GraphElement'
import Point, { Handle, PointXY } from './Point'
import { RectangleTranslatable } from './Rectangle'

export type ImageAttributes = {
  svg?: string
  transform?: string
  x: number
  y: number
  height: number
  width: number
  xlinkHref: string
  preserveAspectRatio: string
}

export default abstract class Image
  extends GraphElement<ImageAttributes>
  implements Rotatable {
  abstract getCoords(): Coordinates
  abstract getSize(): { width: number; height: number }

  content: string
  rotation?: number
  constructor(shape = '', options?: GraphOptions) {
    super(options)
    this.content = shape
  }

  rotate(angle: number): void {
    this.rotation = ((this.rotation || 0) + angle) % 360
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getDrawingAttributesImpl() {
    const { x, y } = this.getCoords()
    const { width, height } = this.getSize()
    // TODO(fbillioud): handle svg files
    const isSVG = this.content?.includes('</svg>')

    const attrs: ImageAttributes = {
      x,
      y,
      width,
      height,
      transform: this.rotation ? `rotate(${this.rotation} ${width / 2} ${height / 2})` : '',
      svg: isSVG ? this.content?.replace(/currentColor/g, this.color) : undefined,
      preserveAspectRatio: 'xMidYMid', // should we handle svg differently ? this.isSVG ? 'none' : 'xMidYMid'
      // Doesn't seem to work for web. Check on mobile
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      xlinkHref: this.isSVG ? undefined : this.content, // { uri: content }
    }

    return attrs
  }

  getRectangle() {
    const origin = new PointXY(this.getCoords())
    const { width, height } = this.getSize()
    const rectangle = new RectangleTranslatable(
      origin,
      origin.plus({ x: width, y: -height })
    )
    rectangle.setDrawConfigOf(this)
    return rectangle
  }

  isEqual(element: GraphElement): boolean {
    // Should we consider that the content matters or not in the comparison?
    return (
      element instanceof Image &&
      this.getRectangle().isEqual(element.getRectangle()) &&
      this.content === element.content
    )
  }

  orthoProjection(P: Point) {
    return this.getRectangle().orthoProjection(P)
  }
}

export class ImageTranslatable extends Image implements Resizable, Translatable {
  static type = 'ImageTranslatable' as const
  start: Coordinates
  end: Coordinates

  constructor(
    start: Coordinates = { x: 0, y: 0 },
    end: Coordinates = { x: 0, y: 0 },
    content = '',
    options?: GraphOptions
  ) {
    super(content, options)
    this.start = start
    this.end = end
  }

  getCoords(): Coordinates {
    return {
      x: Math.min(this.start.x, this.end.x),
      y: Math.max(this.start.y, this.end.y),
    }
  }

  getSize(): { width: number; height: number } {
    return {
      width: Math.abs(this.start.x - this.end.x),
      height: Math.abs(this.start.y - this.end.y),
    }
  }

  translate(vector: Coordinates): void {
    this.start = plus(this.start, vector)
    this.end = plus(this.end, vector)
  }

  getHandles() {
    const P1 = new Handle(
      this.start,
      (vector: Coordinates) => (this.start = plus(this.start, vector))
    )
    const P2 = new Handle(
      this.end,
      (vector: Coordinates) => (this.end = plus(this.end, vector))
    )
    return [P1, P2]
  }
}
