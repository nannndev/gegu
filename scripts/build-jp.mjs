/**
 * Bangun dataset Jepang: 47 prefektur.
 *
 * Sumber: Natural Earth 1:10m admin-1 states/provinces.
 *   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
 *   LISENSI: public domain — boleh diredistribusi tanpa syarat.
 *
 * Pola dan alasannya sama dengan build-my.mjs; lihat app/assets/data/JEPANG.md.
 *
 * Pakai: node scripts/build-jp.mjs [path-ke-ne_10m_admin_1.geojson]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const INPUT = process.argv[2] ?? '/tmp/ne1.geojson'
const DATA_DIR = new URL('../app/assets/data/', import.meta.url)

const round = n => Math.round(n * 1000) / 1000
const roundCoords = c =>
  typeof c[0] === 'number' ? [round(c[0]), round(c[1])] : c.map(roundCoords)

/**
 * Region yang tidak diisi Natural Earth. Keduanya di Kyushu — dibiarkan
 * kosong, dua prefektur ini hilang dari filter wilayah.
 */
const REGION_PATCH = {
  'JP-41': 'Kyushu', // Saga
  'JP-42': 'Kyushu', // Nagasaki
}

/**
 * Nama Indonesia yang tidak disediakan sumber. Hokkaido tidak memakai awalan
 * "Prefektur" karena satuannya memang bukan prefektur (`Circuit`/道), dan
 * Tokyo lazim disebut tanpa awalan itu juga dalam bahasa Indonesia.
 */
const NAME_ID_PATCH = {
  'JP-13': 'Tokyo',
  'JP-01': 'Hokkaido',
}

/**
 * Buang pulau terpencil yang jauh dari badan utama prefekturnya.
 *
 * Tokyo secara administratif mencakup Kepulauan Ogasawara, ±1.000 km di
 * Pasifik (sampai 24°LU, sementara Tokyo daratan di 35°LU). Pulau-pulau itu
 * beberapa piksel di layar dan tidak pernah jadi jawaban, tapi ikut masuk
 * hitungan `fitBounds` — kameranya jadi memuat lautan kosong dan seluruh
 * Jepang mengecil sampai prefekturnya sulit diklik. Hal yang sama berlaku
 * untuk Kagoshima (Kepulauan Amami) dan Okinawa (Daitō).
 *
 * Yang dibuang hanya cincin yang pusatnya lebih dari `MAX_ISLAND_DEG` dari
 * cincin terbesar prefektur itu — jadi pulau yang memang dekat, termasuk
 * seluruh Okinawa utama, tetap ada.
 */
const MAX_ISLAND_DEG = 3.5

function ringCenter(ring) {
  let x1 = 180, y1 = 90, x2 = -180, y2 = -90
  for (const [x, y] of ring) {
    x1 = Math.min(x1, x); x2 = Math.max(x2, x)
    y1 = Math.min(y1, y); y2 = Math.max(y2, y)
  }
  return { lng: (x1 + x2) / 2, lat: (y1 + y2) / 2, span: (x2 - x1) * (y2 - y1) }
}

function dropRemoteIslands(geometry) {
  if (geometry.type !== 'MultiPolygon') return { geometry, dropped: 0 }

  const polys = geometry.coordinates.map(p => ({ p, c: ringCenter(p[0]) }))
  // Badan utama = cincin dengan bbox terbesar, bukan yang pertama: urutan
  // cincin di GeoJSON tidak dijamin menaruh daratan utama di depan.
  const main = polys.reduce((a, b) => (b.c.span > a.c.span ? b : a))

  const kept = polys.filter(({ c }) =>
    Math.hypot(c.lng - main.c.lng, c.lat - main.c.lat) <= MAX_ISLAND_DEG,
  )

  return {
    geometry: { type: 'MultiPolygon', coordinates: kept.map(k => k.p) },
    dropped: polys.length - kept.length,
  }
}

if (!existsSync(INPUT)) {
  throw new Error(
    `Sumber tidak ada: ${INPUT}\n`
    + `Unduh dulu:\n`
    + `  curl -sL -o ${INPUT} \\\n`
    + `    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson`,
  )
}

const raw = JSON.parse(readFileSync(INPUT, 'utf8'))
const source = raw.features.filter(f => f.properties.admin === 'Japan')

if (source.length !== 47) {
  throw new Error(`Diharapkan 47 prefektur Jepang, dapat ${source.length}.`)
}

let droppedTotal = 0
const droppedBy = []

const features = source.map((f) => {
  const p = f.properties
  const iso = p.iso_3166_2
  const region = p.region || REGION_PATCH[iso]
  if (!region) throw new Error(`${p.name} (${iso}) tidak punya region dan belum ada di REGION_PATCH.`)

  const name = p.name
  const trimmed = dropRemoteIslands(f.geometry)
  if (trimmed.dropped) {
    droppedTotal += trimmed.dropped
    droppedBy.push(`${name} (${trimmed.dropped})`)
  }

  return {
    type: 'Feature',
    properties: {
      id: iso,
      // Makron dipertahankan (Ōsaka, Kyōto) — itu ejaan yang benar, dan
      // nama wilayah di sini hanya dibaca atau diklik, tidak pernah diketik:
      // Mode A menjawab lewat klik peta dan Mode B lewat pilihan ganda.
      name,
      name_id: p.name_id && p.name_id !== name
        ? p.name_id
        : NAME_ID_PATCH[iso] ?? name,
      region,
      country: 'Japan',
      iso_a2: 'JP',
    },
    geometry: {
      type: trimmed.geometry.type,
      coordinates: roundCoords(trimmed.geometry.coordinates),
    },
  }
})

features.sort((a, b) => a.properties.name.localeCompare(b.properties.name))

const out = new URL('jp-prefectures.geo.json', DATA_DIR)
writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', features }))

const regions = [...new Set(features.map(f => f.properties.region))].sort()
const bytes = readFileSync(out).length
console.log(`${features.length} prefektur ditulis ke jp-prefectures.geo.json (${(bytes / 1024).toFixed(0)} KB)`)
console.log(`region (${regions.length}): ${regions.join(', ')}`)
if (droppedTotal) {
  console.log(`pulau terpencil dibuang (>${MAX_ISLAND_DEG}°): ${droppedTotal} — ${droppedBy.join(', ')}`)
}
