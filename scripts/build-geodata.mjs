/**
 * Ubah GeoJSON mentah Natural Earth (ne_110m_admin_0_countries) jadi versi ramping
 * yang dipakai game: hanya properti yang perlu + koordinat dibulatkan 3 desimal.
 *
 * Pakai: node scripts/build-geodata.mjs <path-ke-geojson-mentah>
 * Default input: /tmp/ne110.geojson
 */
import { readFileSync, writeFileSync } from 'node:fs'

const INPUT = process.argv[2] ?? '/tmp/ne110.geojson'
const OUTPUT = new URL('../app/assets/data/countries.geo.json', import.meta.url)

// Bukan negara berdaulat / tidak layak jadi soal tebakan.
const EXCLUDE = new Set(['Antarctica', 'Fr. S. Antarctic Lands'])

const round = (n) => Math.round(n * 1000) / 1000
const roundCoords = (c) =>
  typeof c[0] === 'number' ? [round(c[0]), round(c[1])] : c.map(roundCoords)

const raw = JSON.parse(readFileSync(INPUT, 'utf8'))

const features = raw.features
  .filter((f) => !EXCLUDE.has(f.properties.NAME))
  .map((f) => {
    const p = f.properties
    const iso = p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2
    return {
      type: 'Feature',
      properties: {
        name: p.NAME_EN || p.NAME,
        name_id: p.NAME_ID || p.NAME_EN || p.NAME,
        iso_a2: iso && iso !== '-99' ? iso : null,
        region: p.CONTINENT,
        subregion: p.SUBREGION,
      },
      geometry: {
        type: f.geometry.type,
        coordinates: roundCoords(f.geometry.coordinates),
      },
    }
  })
  .sort((a, b) => a.properties.name.localeCompare(b.properties.name))

writeFileSync(
  OUTPUT,
  JSON.stringify({ type: 'FeatureCollection', features }),
)

const regions = [...new Set(features.map((f) => f.properties.region))].sort()
console.log(`${features.length} negara ditulis ke app/assets/data/countries.geo.json`)
console.log(`region: ${regions.join(', ')}`)
