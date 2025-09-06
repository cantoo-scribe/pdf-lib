import { AnnotationTypes } from './AnnotationTypes';

export interface AnnotationOptions {
  subtype: AnnotationTypes;
  rect: { x: number; y: number; width: number; height: number };
  contents?: string;
  name?: string;
  flags?: number;
  color?:
    | [number]
    | [number, number, number]
    | [number, number, number, number];
  border?: [number, number, number];
  modificationDate?: string;
}
