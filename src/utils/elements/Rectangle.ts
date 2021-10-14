import { Coordinates } from '../../types'
import GraphElement from './GraphElement'
import Point, { PointXY } from './Point'
import { SegmentAB } from './Segment'

export default abstract class Rectangle extends GraphElement{
  getStart() {
    const start = new PointXY(this.getCoords())
    return start
  }

  getEnd() {
    const { width, height } = this.getSize()
    const end = new PointXY(this.getStart()).plus({ x: width, y: -height })
    return end
  }

  center() {
    const center = new SegmentAB(this.getStart(), this.getEnd()).middle()
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
}

export class RectangleAC extends Rectangle {
  static type = 'RectangleAC'
  start: Point
  end: Point
  constructor(
    start: Point = new PointXY(),
    end: Point = new PointXY()
  ) {
    super()
    this.start = start
    this.end = end
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
    const start = this.start.toCoords()
    const end = this.end.toCoords()
    return {
      x: Math.min(start.x, end.x),
      y: Math.max(start.y, end.y),
    }
  }
}
