import Point, { PointXY } from './elements/Point'
import { RectangleAC } from './elements/Rectangle'
import { Coordinates, Space, Translatable, Rotatable, Resizable, Editable, Functional, Linkable } from '../types'

/** This value represents the precision we accept for float values */
export const FLOAT_APPROXIMATION = 0.000001

/** Calculates the distance between 2 points */
export function distance(A: Point, B: Point) {
  return norm(vector(A, B))
}

export function distanceCoords(A: Coordinates, B: Coordinates) {
  return norm(minus(B, A))
}

/** Calculates the distance denoted by a vector */
export function norm(vect: Coordinates) {
  return Math.sqrt(vect.x * vect.x + vect.y * vect.y)
}

/** Calculates the orthogonal vector of provided vector */
export function orthogonal({ x, y }: Coordinates): Coordinates {
  return { x: -y, y: x }
}

/** Check if 2 vectors are proportional */
export function isColinear(
  { x: ux, y: uy }: Coordinates,
  { x: vx, y: vy }: Coordinates
): boolean {
  return isEqual(ux * vy, uy * vx)
}

/** Check if 2 floating values can be considered equals */
export function isEqual(a: number, b: number): boolean {
  // TODO(fbillioud) Should be improved to handle small space values (xMin: 0.000001, xMax: 0.000010)
  return Math.round(Math.abs(a - b) / FLOAT_APPROXIMATION) === 0
}

/** Return true if a is proportional to b: (a = kb), considering float imprecision */
export function isProportional(a: number, b: number): boolean {
  return isEqual((Math.abs(a) + FLOAT_APPROXIMATION / 10) % b, 0)
}

/** Calculate the scalar product between 2 vectors */
export function scalar(
  { x: ux, y: uy }: Coordinates,
  { x: vx, y: vy }: Coordinates
): number {
  return ux * vx + uy * vy
}

/** Calculate the sum of 2 vectors */
export function plus(
  { x: ux, y: uy }: Coordinates,
  { x: vx, y: vy }: Coordinates
): Coordinates {
  return { x: ux + vx, y: uy + vy }
}

/** Calculate the vector multiplied by a scalar */
export function times({ x, y }: Coordinates, k = 1): Coordinates {
  return { x: k * x, y: k * y }
}

/** Calculate the difference of 2 vectors */
export function minus(u: Coordinates, v: Coordinates): Coordinates {
  return plus(u, times(v, -1))
}

/** Returns the vector between 2 points. */
export function vector(A: Point, B: Point): Coordinates {
  return minus(B.toCoords(), A.toCoords())
}

/**
 * Returns the angle between the vector and the horizontal axis (Ox).
 * The return value is between -PI and PI.
 * @returns {number} angle in radian between -Pi and Pi
 */
export function orientation({ x, y }: Coordinates): number {
  const angle = Math.acos(x / Math.sqrt(x * x + y * y))
  return y > 0 ? angle : -angle
}

/** Returns the unit vector associated to the provided vector,
 * or the Null vector (0, 0) if the vector is null **/
export function unitVector(u: Coordinates): Coordinates {
  const l = norm(u)
  return l > 0 ? times(u, 1 / l) : u
}

/** Returns the angle from u to v in radian **/
export function angle(u: Coordinates, v: Coordinates, previousAngle = 0) {
  let sweep = orientation(v) - orientation(u)
  // If the angle has the same sign as the arc orientation, we return the angle as is
  // Otherwise, we need to correct the value, adding or removing 2π
  while (Math.abs(previousAngle - sweep) > Math.PI)
    sweep += Math.sign(previousAngle - sweep) * 2 * Math.PI
  return sweep
}

/** Returns the angle between the lines (BA) and (BC) in radian
 * @returns {number} the angle in radian, between -Pi and Pi
 */
export function angleABC(A: Point, B: Point, C: Point, previousAngle = 0): number {
  return angle(vector(B, A), vector(B, C), previousAngle)
}

/** Rotate the vector by an angle in radian */
export function rotate(vector: Coordinates, angle: number): Coordinates {
  const { x, y } = vector
  const nx = x * Math.cos(angle) - y * Math.sin(angle)
  const ny = y * Math.cos(angle) + x * Math.sin(angle)
  return { x: nx, y: ny }
}

export function toDegrees(rad: number) {
  return (rad * 180) / Math.PI
}

export function toRadians(degrees: number) {
  return (degrees / 180) * Math.PI
}

// for reference, check this link
// https://stackoverflow.com/questions/62855310/converting-a-list-of-points-to-an-svg-cubic-piecewise-bezier-curve
export const controlPoints = (p: Coordinates[]) => {
  const tangentSize = 1 / 5
  // given the points array p calculate the control points for the cubic Bezier curves
  const pc: Coordinates[][] = []

  for (let i = 1; i < p.length - 1; i++) {
    const dx = p[i - 1].x - p[i + 1].x // difference x
    const dy = p[i - 1].y - p[i + 1].y // difference y
    // the first control point
    const x1 = p[i].x - dx * tangentSize
    const y1 = p[i].y - dy * tangentSize
    const o1 = {
      x: x1,
      y: y1,
    }

    // the second control point
    const x2 = p[i].x + dx * tangentSize
    const y2 = p[i].y + dy * tangentSize
    const o2 = {
      x: x2,
      y: y2,
    }

    // building the control points array
    pc[i] = []
    pc[i].push(o1)
    pc[i].push(o2)
  }

  return pc
}

/**
 * Round a value to the provided precision
 * @param value The value to round up
 * @param precision The step between 2 values. For instance: 0.1 to accept 2.1, 2.2, etc
 * @returns The rounded value as a string, ready for displaying
 */
export const roundNumber = (value: number, precision: number) => {
  const rounded =
    precision < 1
      ? Math.round(value / precision) / (1 / precision)
      : Math.round(value / precision) * precision
  const fixes = precision >= 1 ? 0 : ((precision + '').split('.')[1] || '').length
  const hardRounded = rounded.toFixed(fixes)
  return hardRounded
}

/**
 * Create the math representation of the viewport
 * @param {Space} space The space representing the viewport
 * @returns {Rectangle} The Rectangle representing the viewport
 */
export const getSpaceRectangle = (space: Space) => {
  return new RectangleAC(
    new PointXY({ x: space.xMin, y: space.yMin }),
    new PointXY({ x: space.xMax, y: space.yMax })
  )
}

/**
 * Is the angle orthogonal
 * @param angle The angle in radian
 * @returns true if the angle is +-Math.PI / 2
 */
export const isOrthogonal = (angle: number) => isEqual(Math.abs(angle), Math.PI / 2)

export function isTranslatable(elt: unknown): elt is Translatable {
  return typeof (<Translatable>elt).translate === 'function'
}

export function isRotatable(elt: unknown): elt is Rotatable {
  return typeof (<Rotatable>elt).rotate === 'function'
}

export function isResizable(elt: unknown): elt is Resizable {
  return typeof (<Resizable>elt).getHandles === 'function'
}

export function isEditable(elt: unknown): elt is Editable {
  return typeof (<Editable>elt).setText === 'function'
}

export function isFunctional(elt: unknown): elt is Functional {
  return typeof (<Functional>elt).y === 'function'
}

export function isLinkable(elt: unknown): elt is Linkable {
  return typeof (<Linkable>elt).getLinks === 'function'
}
