import { AnnotationTypes } from './AnnotationTypes';

export interface AnnotationOptions {
  subtype: AnnotationTypes;
  rect: { x: number; y: number; width: number; height: number };
  contents?: string;
  name?: string;
  flags?: number;
  color?: number[];
  border?: number[];
  modificationDate?: string;
}
