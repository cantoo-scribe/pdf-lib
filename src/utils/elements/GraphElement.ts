import { DrawConfig } from '../../types'
import { getPixelConverter, getRealConverter } from '../converters'
import { distance } from '../maths'

import Point from './Point'

export type GraphOptions = {
  color?: string
  strokeWidth?: number
  filled?: boolean
  rounded?: boolean
}

export default abstract class GraphElement<T = unknown> {
  strokeWidth?: number
  color: string
  /** The list of objects depending on this one to exist */
  dependants: GraphElement[] = []

  constructor(options?: GraphOptions) {
    const { color = 'black', strokeWidth } = options || {}
    this.color = color
    strokeWidth && (this.strokeWidth = strokeWidth)
  }

  getDrawConfig = () => ({
    fontSize: 12,
    strokeScale: 1,
    space: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
    toPixelConverter: getPixelConverter(
      { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
      { width: 10, height: 10 }
    ),
    toRealConverter: getRealConverter(
      { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
      { width: 10, height: 10 }
    ),
    measurePrecision: 0.1,
    anglePrecision: 1,
  })

  /** Set the draw config of this as the same as the prop component */
  setDrawConfigOf = (component: GraphElement) => {
    this.getDrawConfig = component.getDrawConfig
  }

  get options(): GraphOptions {
    return {
      color: this.color,
      strokeWidth: this.strokeWidth,
    }
  }

  set options(options: GraphOptions) {
    Object.assign(this, options)
  }

  /**
   * Returns the list of elements that this object needs to be correctly defined.
   * If one of those elements is removed from  the graph, it is better to remove
   * this object too
   **/
  getDependencies(): GraphElement[] {
    return []
  }

  abstract isEqual(element: GraphElement): boolean
  getDrawingAttributes(config: DrawConfig) {
    this.getDrawConfig = () => config
    return this.getDrawingAttributesImpl()
  }

  protected abstract getDrawingAttributesImpl(): T | null
  abstract orthoProjection(P: Point): Point

  distance(P: Point) {
    const H = this.orthoProjection(P)
    return distance(H, P)
  }

  toString() {
    const config = this.getDrawConfig()
    return {
      type: ((this.constructor as unknown) as { type: string }).type,
      ...this.getDrawingAttributes(config),
    }
  }
}
