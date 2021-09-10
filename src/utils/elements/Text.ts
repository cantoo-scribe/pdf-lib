import type { Coordinates, DrawConfig, LinkElement, Editable, Translatable } from '../../types'
import { intersections } from '../intersections'
import {
  getSpaceRectangle,
  isEqual,
  minus,
  plus,
  rotate,
  roundNumber,
  times,
  toDegrees,
  unitVector,
} from '../maths'

import AngleMark from './AngleMark'
import Arc, { ArcOAB } from './Arc'
import Circle, { CircleOA } from './Circle'
import GraphElement, { GraphOptions } from './GraphElement'
import Line, { LineAB, LineOVect } from './Line'
import Point, { PointXY } from './Point'
import { RectangleAC } from './Rectangle'
import Segment, { SegmentAB } from './Segment'

export type TextAttributes = {
  x: number
  y: number
  xScale: number
  color: string
  fontSize: number
  lines: string[]
  textAnchor?: 'start' | 'middle' | 'end'
  alignmentBaseline?: 
  | 'baseline'
  | 'text-bottom'
  | 'alphabetic'
  | 'ideographic'
  | 'middle'
  | 'central'
  | 'mathematical'
  | 'text-top'
  | 'bottom'
  | 'center'
  | 'top'
  | 'text-before-edge'
  | 'text-after-edge'
  | 'before-edge'
  | 'after-edge'
  | 'hanging'
}

type DrawText = Pick<DrawConfig, 'toRealConverter' | 'fontSize'>

export default abstract class Text extends GraphElement<TextAttributes> {
  abstract coords(): Coordinates

  abstract content(): string

  location() {
    const loc = new PointXY(this.coords())
    loc.setDrawConfigOf(this)
    return loc
  }

  lines(): string[] {
    return this.content().split('\n')
  }

  isEqual(element: GraphElement): boolean {
    return (
      element instanceof Text && this.location().isEqual(element.location())
      // && this.content() === element.content()
    )
  }

  getSize(): { width: number; height: number } {
    const { toRealConverter, fontSize }: DrawText = this.getDrawConfig()
    const lines = this.lines()
    const scaledFontSizeX = toRealConverter.w(fontSize)
    const scaledFontSizeY = toRealConverter.h(fontSize)
    return {
      // Estimation of the text width
      width: (Math.max(...lines.map(l => l.length)) * scaledFontSizeX) / 2,
      height: lines.length * scaledFontSizeY,
    }
  }

  getRectangle(): LinkElement {
    const { width, height } = this.getSize()
    const start = this.coords()
    const end = plus(start, { x: width, y: height })
    const rect = new RectangleAC(new PointXY(start), new PointXY(end))
    rect.setDrawConfigOf(this)
    return rect
  }

  orthoProjection(P: Point) {
    return this.getRectangle().orthoProjection(P)
  }

  getDrawingAttributesImpl(): TextAttributes | null {
    const {
      fontSize,
      toRealConverter,
    }: Pick<DrawText, 'toRealConverter' | 'fontSize'> = this.getDrawConfig()
    const { x, y } = this.coords()
    const lines = this.lines()
    const scaledFontSize = toRealConverter.h(fontSize)
    const attrs: TextAttributes = {
      lines,
      x,
      y,
      xScale: toRealConverter.w(1) / toRealConverter.h(1),
      fontSize: scaledFontSize,
      color: this.color || 'black',
    }
    return attrs
  }
}

export class FixedText extends Text {
  x: number
  y: number
  value: string

  constructor(position: Coordinates = { x: 0, y: 0 }, value = '', options?: GraphOptions) {
    super(options)
    this.x = position.x
    this.y = position.y
    this.value = value.replace(/(.{24})\s/gm, '$1\n')
  }

  coords() {
    return {
      x: this.x,
      y: this.y,
    }
  }

  content() {
    return this.value
  }
}

export class Graduation extends FixedText {
  /** Is the graduation on the yAxis? */
  yAxis: boolean
  constructor(
    position: Coordinates = { x: 0, y: 0 },
    value = '',
    yAxis = false,
    options?: GraphOptions
  ) {
    super(position, value, options)
    this.yAxis = yAxis
  }

  getDrawingAttributesImpl() {
    const attributes = super.getDrawingAttributesImpl()
    if (!attributes) return null
    attributes.fontSize *= 0.75
    // const width = Math.max(...attributes.lines.map(l => l.length)) * attributes.fontSize * attributes.xScale / 2
    attributes.textAnchor = this.yAxis ? 'end' : 'middle'
    attributes.y = this.yAxis
      ? attributes.y - attributes.fontSize / 4
      : attributes.y - attributes.fontSize
    return attributes
  }
}

export class TextXY extends FixedText implements Translatable, Editable {
  static type = 'TextXY' as const

  translate(translationVector: Coordinates) {
    const position = plus(this.coords(), translationVector)
    this.x = position.x
    this.y = position.y
  }

  setText(text: string) {
    this.value = text
  }
}

abstract class Label extends Text {
  static PADDING = 3
  x = 0
  y = 0

  coords() {
    const { toRealConverter } = this.getDrawConfig()
    return {
      x: this.x + toRealConverter.w(Label.PADDING),
      y: this.y + toRealConverter.h(Label.PADDING),
    }
  }

  getSize() {
    const { toRealConverter } = this.getDrawConfig()
    const { width, height } = super.getSize()
    return {
      width: width + toRealConverter.w(Label.PADDING) * 2,
      height: height + toRealConverter.h(Label.PADDING) * 2,
    }
  }
}

abstract class LabelTranslatable extends Label implements Translatable {
  translate(translationVector: Coordinates) {
    this.x += translationVector.x
    this.y += translationVector.y
  }
}

export class TextPointName extends LabelTranslatable implements Editable {
  static type = 'TextPointName' as const
  P: Point
  name: string

  constructor(P: Point = new PointXY(), name = '', options?: GraphOptions) {
    super(options)
    this.P = P
    this.name = name
    this.P.dependants.push(this)
  }

  getDependencies() {
    return [this.P]
  }

  content() {
    return this.name
  }

  setText(text: string) {
    this.name = text
  }

  coords() {
    this.P.setDrawConfigOf(this)
    return plus(super.coords(), this.P.toCoords())
  }
}

export class TextSegmentLength extends LabelTranslatable {
  static type = 'TextSegmentLength' as const
  segment: Segment

  constructor(segment: Segment = new SegmentAB(), options?: GraphOptions) {
    super(options)
    this.segment = segment
    this.segment.dependants.push(this)
  }

  getDependencies() {
    return [this.segment]
  }

  content() {
    const { measurePrecision } = this.getDrawConfig()
    return roundNumber(this.segment.length(), measurePrecision)
  }

  coords() {
    this.segment.setDrawConfigOf(this)
    const { width, height } = this.getSize()
    const vect = this.segment.dirVect()
    const offset = plus(this.segment.middle().toCoords(), super.coords())
    // on horizontal segment, text should be centered horizontally
    if (isEqual(vect.y, 0)) offset.x -= width / 2
    // on segment going up-right, we need to put the text to the left of the middle
    else if (vect.y > 0) offset.x -= width
    // on vertical segment, text should be centered vertically
    if (isEqual(vect.x, 0)) offset.y -= height / 2
    // on segment going to the right, we need to put the text above the middle
    else if (vect.x < 0) offset.y -= height
    return offset
  }
}

export class TextArcAngle extends LabelTranslatable {
  static type = 'TextArcAngle' as const
  arc: Arc | AngleMark

  constructor(arc: Arc | AngleMark = new ArcOAB(), options?: GraphOptions) {
    super(options)
    this.arc = arc
    this.arc.dependants.push(this)
  }

  getDependencies() {
    return [this.arc]
  }

  content() {
    const { anglePrecision } = this.getDrawConfig()
    return roundNumber(Math.abs(toDegrees(this.arc.sweep())), anglePrecision) + '°'
  }

  coords() {
    this.arc.setDrawConfigOf(this)
    const { width, height } = this.getSize()
    const sweep = this.arc.sweep()
    const O = this.arc.center()
    const vect = rotate(this.arc.originVect(), sweep / 2)
    const offset = plus(O.toCoords(), plus(vect, super.coords()))

    // on vertical vect, text should be centered horizontally
    if (isEqual(vect.x, 0)) offset.x -= width / 2
    // on right-side arc circle, we need to put the text to the left of the arc
    else if (vect.x < 0) offset.x -= width
    // on horizontal vect, text should be centered vertically
    if (isEqual(vect.y, 0)) offset.y += height / 2
    // on lower arc circle, we need to put the text below the circle
    else if (vect.y < 0) offset.y -= height
    return offset
  }
}

export class TextCircleName extends LabelTranslatable implements Editable {
  static type = 'TextCircleName' as 'TextCircleName' | 'TextCircleDescription'
  circle: Circle
  name: string

  constructor(circle: Circle = new CircleOA(), name = 'C', options?: GraphOptions) {
    super(options)
    this.circle = circle
    this.name = name
    this.circle.dependants.push(this)
  }

  getDependencies() {
    return [this.circle]
  }

  content() {
    return this.name
  }

  setText(text: string) {
    this.name = text
  }

  coords() {
    this.circle.setDrawConfigOf(this)
    const O = this.circle.center().toCoords()
    const r = this.circle.ray()
    return plus(super.coords(), plus(O, { x: r, y: r }))
  }
}

export class TextCircleDescription extends TextCircleName {
  static type = 'TextCircleDescription' as const

  constructor(circle: Circle = new CircleOA(), text = 'C', options?: GraphOptions) {
    super(circle, text, options)
  }

  coords() {
    this.circle.setDrawConfigOf(this)
    const { width, height } = this.getSize()
    return plus(
      super.coords(),
      plus(this.circle.center().toCoords(), { x: -width / 2, y: height / 2 })
    )
  }
}

export class TextLinkElementDescription extends Label implements Editable {
  static type = 'TextLinkElementDescription' as const

  element: LinkElement
  value: string

  constructor(
    element: LinkElement = new RectangleAC(),
    text = 'Description',
    options?: GraphOptions
  ) {
    super(options)
    this.element = element
    this.value = text
    this.element.dependants.push(this)
  }

  getDependencies() {
    return [this.element]
  }

  content() {
    return this.value
  }

  setText(text: string) {
    this.value = text
  }

  coords() {
    this.setDrawConfigOf(this)
    this.element.setDrawConfigOf(this)
    const { width, height } = this.getSize()
    return plus(
      super.coords(),
      plus(this.element.center().toCoords(), { x: -width / 2, y: -height / 2 })
    )
  }
}

export class TextLineName extends LabelTranslatable implements Editable {
  static type = 'TextLineName' as const
  line: Line
  name: string

  constructor(line: Line = new LineAB(), name = 'd', options?: GraphOptions) {
    super(options)
    this.line = line
    this.name = name
    this.line.dependants.push(this)
  }

  content() {
    return this.name
  }

  setText(text: string) {
    this.name = text
  }

  getDependencies() {
    return [this.line]
  }

  getDrawingAttributesImpl() {
    this.line.setDrawConfigOf(this)
    const lineAttrs = this.line.getDrawingAttributes(this.getDrawConfig())
    // If the line is not in the viewbox, we don't draw the name
    if (!lineAttrs) return null
    else return super.getDrawingAttributesImpl()
  }

  coords() {
    const { space, toRealConverter } = this.getDrawConfig()
    const rect = getSpaceRectangle(space)
    this.line.setDrawConfigOf(this)
    rect.setDrawConfigOf(this)
    const [A, B] = intersections(rect, this.line) as
      | []
      | [Coordinates]
      | [Coordinates, Coordinates]
    // Returns a dummy point if the line is not in the viewbox
    if (!A || !B) return { x: 0, y: 0 }

    const { width, height } = this.getSize()
    const vect = unitVector(minus(A, B))
    const dist = toRealConverter.w(15)
    const offset = plus(B, times(vect, dist))
    // on horizontal segment, text should be centered horizontally
    if (isEqual(vect.y, 0)) offset.x -= width / 2
    // on segment going up, we need to put the text to the left of the middle
    else if (vect.y > 0) offset.x += width
    // on vertical segment, text should be centered vertically
    if (isEqual(vect.x, 0)) offset.y -= height / 2
    // on segment going to the right, we need to put the text above the middle
    else if (vect.x > 0) offset.y -= height
    return offset
  }
}

export class TextAxisName extends TextLineName {
  constructor(axis: 'x' | 'y' = 'x', name = '') {
    super(new LineOVect(new PointXY(), { x: 0, y: 0, [axis]: 1 }), name)
  }

  coords() {
    const { x, y } = super.coords()
    const { width, height } = this.getSize()
    const isXAxis = this.line.dirVect().x > 0
    return { x: x - (isXAxis ? 0 : width), y: y - (isXAxis ? height : 0) }
  }
}
