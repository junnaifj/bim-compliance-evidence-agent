export type Point3 = readonly [number, number, number];

/** Viewer geometry retains the placed IFC XYZ coordinates without remapping axes. */
export function preserveIfcCoordinates([x, y, z]: Point3): Point3 {
  return [x, y, z];
}

/** Place only the established Y-up viewer grid at the model baseline. */
export function modelBaselineY(minY: number): number {
  return Number.isFinite(minY) ? minY : 0;
}

export function heightAboveBaseline(y: number, baselineY: number): number {
  return y - baselineY;
}
