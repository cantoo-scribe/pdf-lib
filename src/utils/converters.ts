import { Converter, Coordinates, Size, Space } from '../types'

import { norm } from './maths'

export const getPixelConverter = (space: Space, size: Size): Converter => {
  const { xMin, yMin, xMax, yMax } = space
  const { width, height } = size
  const x = (x: number) => ((x - xMin) / (xMax - xMin)) * width
  const y = (y: number) => ((y - yMin) / (yMax - yMin)) * height
  const w = (w: number) => (w / (xMax - xMin)) * width
  const h = (h: number) => (h / (yMax - yMin)) * height
  return {
    /** Converts x coordinate into the corresponding pixel position x */
    x,
    /** Converts y coordinate into the corresponding pixel position y */
    y,
    /** Converts a distance on x axis into the corresponding amount of pixels */
    w,
    /** Converts a distance on y axis into the corresponding amount of pixels */
    h,
    /** Convert a position from real to pixel */
    point: (coords: Coordinates) => ({ x: x(coords.x), y: y(coords.y) }),
    /** Calculate the length in pixel of a real vector */
    norm: (vector: Coordinates) => norm({ x: w(vector.x), y: h(vector.y) }),
  }
}

export const getRealConverter = (space: Space, size: Size): Converter => {
  const { xMin, yMin, xMax, yMax } = space
  const { width, height } = size
  const x = (x: number) => (x / width) * (xMax - xMin) + xMin
  const y = (y: number) => (y / height) * (yMax - yMin) + yMin
  const w = (w: number) => (w / width) * (xMax - xMin)
  const h = (h: number) => (h / height) * (yMax - yMin)
  return {
    /** Converts x pixel position into the corresponding real position x */
    x,
    /** Converts y pixel position into the corresponding real position y */
    y,
    /** Converts a distance on x axis from pixel into the corresponding real distance */
    w,
    /** Converts a distance on y axis from pixel into the corresponding real distance */
    h,
    /** Convert a position from pixel to real */
    point: (coords: Coordinates) => ({ x: x(coords.x), y: y(coords.y) }),
    /** Calculate the real length of a pixel vector */
    norm: (vector: Coordinates) => norm({ x: w(vector.x), y: h(vector.y) }),
  }
}
