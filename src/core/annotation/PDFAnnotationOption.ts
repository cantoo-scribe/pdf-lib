import PDFPage from '../../api/PDFPage';
import { AnnotationTypes } from './AnnotationTypes';

export interface AnnotationOptions {
  subtype: AnnotationTypes;
  rect: { x: number; y: number; width: number; height: number };
  page: PDFPage;
  contents?: string;
  name?: string;
  flags?: number;
  color?: [number, number, number] | [number, number, number, number];
  border?:
    | [number, number, number]
    | [number, number, number, number, number, number];
  modificationDate?: string;
}
