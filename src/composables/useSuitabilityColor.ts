/**
 * useSuitabilityColor.ts
 *
 * Single source of truth for the suitability-class (1..5) color scale used
 * for JS-driven styling (inline :style bindings, computed tint/icon colors).
 *
 * These values mirror the --suitability-1..5 CSS custom properties defined
 * in src/assets/base.css, which drive the static badge and dist-square
 * classes there. If the palette changes, update both places.
 */

export const SUITABILITY_COLORS: Record<number, string> = {
  1: '#4fc3f7',
  2: '#fdd835',
  3: '#ff8f00',
  4: '#e65100',
  5: '#b71c1c',
}

/** Returns the color for a suitability class (1..5), or a neutral grey for an unknown/missing class. */
export function suitabilityColor(classNum: number | null | undefined): string {
  return (classNum != null && SUITABILITY_COLORS[classNum]) || '#999'
}
