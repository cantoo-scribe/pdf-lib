import { Coordinates, DrawConfig, LinkElement } from '../../types'
import { controlPoints, minus, plus } from '../maths'

import GraphElement, { GraphOptions } from './GraphElement'
import Point, { PointXY } from './Point'
import { SegmentAB } from './Segment'
type PlotAttributes = {
  stroke: string
  strokeWidth: string | number
  strokeLinejoin: string
  strokeLinecap:string
  fill: string
  d: string
}

export interface Translatable {
  translate(vector: Coordinates): void
}

export default abstract class Plot extends GraphElement<PlotAttributes> {
  abstract getPoints(): Coordinates[]

  isEqual(element: GraphElement): boolean {
    if (!(element instanceof Plot)) return false
    const points = this.getPoints().map(coord => new PointXY(coord))
    const points2 = element.getPoints().map(coord => new PointXY(coord))
    return (
      points.every((point, i) => point.isEqual(points2[i])) ||
      points.reverse().every((point, i) => point.isEqual(points2[i]))
    )
  }

  // for reference, check this link
  // https://stackoverflow.com/questions/62855310/converting-a-list-of-points-to-an-svg-cubic-piecewise-bezier-curve
  drawCurve() {
    const p = this.getPoints()
    if (p.length <= 2) return ''
    const pc = controlPoints(p) // the control points array
    let d = `M${p[0].x},${p[0].y} Q${pc[1][1].x},${pc[1][1].y}, ${p[1].x},${p[1].y}`
    if (p.length > 2) {
      // central curves are cubic Bezier
      for (let i = 1; i < p.length - 2; i++) {
        d += ` C${pc[i][0].x},${pc[i][0].y}, ${pc[i + 1][1].x},${pc[i + 1][1].y}, ${
          p[i + 1].x
        },${p[i + 1].y}`
      }
      // the first & the last curve are quadratic Bezier
      const n = p.length - 1
      d += ` Q${pc[n - 1][0].x},${pc[n - 1][0].y}, ${p[n].x},${p[n].y}`
    }
    return d
  }

  orthoProjection(P: Point) {
    const points = this.getPoints()
    const orthos = points
      .slice(0, -1)
      .map((pt, i) => new SegmentAB(new PointXY(pt), new PointXY(points[i + 1])))
      .map(seg => {
        seg.setDrawConfigOf(this)
        return seg.orthoProjection(P)
      })
    let min = Number.POSITIVE_INFINITY
    let closest: Point = new PointXY(points[0])
    orthos.forEach(ortho => {
      const d = ortho.distance(P)
      if (d < min) {
        min = d
        closest = ortho
      }
    })
    return closest
  }

  getDrawingAttributesImpl() {
    const { strokeScale }: Pick<DrawConfig, 'strokeScale' | 'space'> = this.getDrawConfig()
    const path = this.drawCurve()
    const attrs: PlotAttributes = {
      stroke: this.color || 'black',
      strokeWidth: (this.strokeWidth || 1) * strokeScale,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      fill: 'none',
      d: path,
    }
    return attrs
  }
}

/** Straight lines between the points */
export class PlotStraight extends Plot {
  static type = 'PlotStraight' as const
  points: Coordinates[]

  constructor(points: Coordinates[] = [], options?: GraphOptions) {
    super(options)
    this.points = points
  }

  getPoints() {
    return [...this.points]
  }

  drawCurve() {
    const p = this.getPoints()
    if (p.length < 2) return ''
    return p.slice(1).reduce((d, pt) => d + ` L${pt.x},${pt.y}`, `M${p[0].x},${p[0].y}`)
  }
}

export class PlotLink extends Plot {
  static type = 'PlotLink' as const
  origin: LinkElement
  destination: LinkElement

  constructor(origin: LinkElement, destination: LinkElement, options?: GraphOptions) {
    super(options)
    this.origin = origin
    this.destination = destination
  }

  getPoints(): Coordinates[] {
    const originCenter = this.origin.center().toCoords()
    const destinationCenter = this.destination.center().toCoords()
    const { width: originWidth, height: originHeight } = this.origin.getSize()
    const {
      width: destinationWidth,
      height: destinationHeight,
    } = this.destination.getSize()
    const axis = minus(destinationCenter, originCenter)

    if (Math.abs(originHeight / originWidth) > Math.abs(axis.y / axis.x)) {
      if (axis.x > 0) {
        return [
          {
            x: originCenter.x + originWidth / 2,
            y: originCenter.y,
          },
          {
            x: destinationCenter.x - destinationWidth / 2,
            y: destinationCenter.y,
          },
        ]
      } else {
        return [
          {
            x: originCenter.x - originWidth / 2,
            y: originCenter.y,
          },
          {
            x: destinationCenter.x + destinationWidth / 2,
            y: destinationCenter.y,
          },
        ]
      }
    } else {
      if (axis.y > 0) {
        return [
          {
            x: originCenter.x,
            y: originCenter.y + originHeight / 2,
          },
          {
            x: destinationCenter.x,
            y: destinationCenter.y - destinationHeight / 2,
          },
        ]
      } else {
        return [
          {
            x: originCenter.x,
            y: originCenter.y - originHeight / 2,
          },
          {
            x: destinationCenter.x,
            y: destinationCenter.y + destinationHeight / 2,
          },
        ]
      }
    }
  }

  getRectangles() {
    return [this.origin, this.destination]
  }

  drawCurve() {
    const points = this.getPoints()
    const line = new PlotStraight(points, this.options)
    line.setDrawConfigOf(this) // copy parameters from the current element

    return line.drawCurve()
  }
}

export class PlotFree extends Plot implements Translatable {
  static type = 'PlotFree' as const
  points: Coordinates[]

  constructor(points: Coordinates[] = [], options?: GraphOptions) {
    super(options)
    this.points = points
  }

  getPoints() {
    return [...this.points]
  }

  translate(translationVector: Coordinates) {
    this.points = this.points.map(point => plus(point, translationVector))
  }
}
