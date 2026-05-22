/**
 * useProjections.ts
 *
 * Registers Swiss projections (LV03 and LV95) in OpenLayers via proj4.
 * Without this, OpenLayers cannot display WMTS tiles from swisstopo
 * which use EPSG:2056 (Swiss LV95 coordinate system).
 */

import proj4 from 'proj4'
import { register } from 'ol/proj/proj4'
import { get as getProjection } from 'ol/proj'
import type { Projection } from 'ol/proj'

// proj4 definition strings for Swiss projections
const EPSG_2056_DEF =
  '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs'

const EPSG_21781_DEF =
  '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs'

// Register projections in proj4
proj4.defs('EPSG:2056', EPSG_2056_DEF)
proj4.defs('EPSG:21781', EPSG_21781_DEF)

// Tell OpenLayers to use them
register(proj4)

/**
 * Returns the EPSG:2056 projection ready for OpenLayers use.
 * Also sets the Swiss extent for proper WMTS tile clipping.
 */
export function useProjections() {
  const projection = getProjection('EPSG:2056') as Projection

  // Swiss extent in LV95 coordinates (TileMatrixSet 2056 bounding box)
  projection.setExtent([2420000, 1030000, 2900000, 1350000])

  return {
    projection,
    swissCenter: [2660000, 1190000] as [number, number],
  }
}
