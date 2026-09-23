import type { Geometry } from 'geojson'

/** Luas bertanda cincin poligon (shoelace) — untuk memilih ring terbesar. */
export function ringArea(ring: number[][]): number {
  let area = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i]!
    const [x1, y1] = ring[i + 1]!
    area += x0 * y1 - x1 * y0
  }
  return area
}

/** Pusat massa (area-weighted) sebuah ring — perkiraan "tengah" wilayah. */
export function ringCentroid(ring: number[][]): { lat: number, lng: number } | null {
  if (ring.length < 3) return null
  let area = 0
  let lng = 0
  let lat = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i]!
    const [x1, y1] = ring[i + 1]!
    const cross = x0 * y1 - x1 * y0
    area += cross
    lng += (x0 + x1) * cross
    lat += (y0 + y1) * cross
  }
  if (Math.abs(area) < 1e-9) return null
  return { lng: lng / (3 * area), lat: lat / (3 * area) }
}

/** Pusat sebuah geometri poligon, diambil dari ring terluasnya. */
export function featureCentroid(geometry: Geometry): { lat: number, lng: number } | null {
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return null
  const polys = geometry.type === 'Polygon'
    ? [geometry.coordinates as number[][][]]
    : (geometry.coordinates as number[][][][])

  let best: number[][] | null = null
  let bestArea = 0
  for (const poly of polys) {
    const ring = poly[0]
    if (!ring || ring.length < 4) continue
    const area = Math.abs(ringArea(ring))
    if (area > bestArea) {
      bestArea = area
      best = ring
    }
  }
  return best ? ringCentroid(best) : null
}
