import Arc from '../utils/elements/Arc'
import Circle from '../utils/elements/Circle'
import Ellipse from '../utils/elements/Ellipse'
import Line from '../utils/elements/Line'
import Plot from '../utils/elements/Plot'
import Point from '../utils/elements/Point'
import Rectangle from '../utils/elements/Rectangle'
import Segment from '../utils/elements/Segment'
export { TransformationMatrix } from 'src/types/matrix';

export type Size = {
  width: number
  height: number
}

export type Coordinates = {
  x: number
  y: number
}

export type GraphicElement =
  | Arc
  | Circle
  | Ellipse
  | Line
  | Plot
  | Point
  | Rectangle
  | Segment

  export type Space = { xMin: number; yMin: number; xMax: number; yMax: number }

export type Converter = {
  x: (x: number) => number
  y: (y: number) => number
  w: (w: number) => number
  h: (h: number) => number
  point: (coords: Coordinates) => Coordinates
  norm: (vector: Coordinates) => number
}

export type LinkElement = Rectangle | Ellipse

export type DrawConfig = {
  fontSize: number
  strokeScale: number
  toPixelConverter: Converter
  toRealConverter: Converter
  space: Space
  measurePrecision: number
  anglePrecision: number
}

export interface Translatable {
  translate(vector: Coordinates): void
}

export interface Rotatable {
  /** @param angle should be in radian */
  rotate(angle: number): void
}

export interface Resizable {
  getHandles(): (Point & Translatable)[]
}

export interface Linkable {
  getLinks(): Point[]
}

export interface Editable {
  setText(text: string): void
}

export interface Functional {
  y(x: number): number
}
