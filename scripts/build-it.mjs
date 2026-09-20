/**
 * Bangun dataset Italia: 110 provinsi, dikelompokkan ke 20 region.
 *
 * Sumber: Natural Earth 1:10m admin-1 states/provinces.
 *   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
 *   LISENSI: public domain — boleh diredistribusi tanpa syarat.
 *
 * Pakai: node scripts/build-it.mjs [path-ke-ne_10m_admin_1.geojson]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const INPUT = process.argv[2] ?? '/tmp/ne1.geojson'
const DATA_DIR = new URL('../app/assets/data/', import.meta.url)

const round = n => Math.round(n * 1000) / 1000
const roundCoords = c =>
  typeof c[0] === 'number' ? [round(c[0]), round(c[1])] : c.map(roundCoords)

/**
 * Dua provinsi yang `name_it`-nya di Natural Earth justru berisi nama
 * regionnya, bukan nama provinsinya sendiri. Ketahuan lewat pemeriksaan
 * otomatis di bawah (`name_it === region`), dan diperbaiki lewat kode ISO
 * yang tidak ambigu.
 */
const NAME_PATCH = {
  'IT-BZ': 'Bolzano',
  'IT-GE': 'Genova',
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
const source = raw.features.filter(f => f.properties.admin === 'Italy')

if (source.length !== 110) {
  throw new Error(`Diharapkan 110 provinsi Italia, dapat ${source.length}.`)
}

const seen = new Set()

const features = source.map((f) => {
  const p = f.properties
  const iso = p.iso_3166_2
  if (!iso) throw new Error(`Provinsi "${p.name}" tidak punya kode ISO.`)
  if (seen.has(iso)) throw new Error(`Kode ISO ganda: ${iso}.`)
  seen.add(iso)

  const region = p.region
  if (!region) throw new Error(`${p.name} (${iso}) tidak punya region.`)

  /**
   * Nama dari `name_it`, bukan `name`.
   *
   * Kolom `name` di Natural Earth mencampur bahasa dan memuat salah eja:
   * "Aoste" (Prancis), "Turin" (Inggris), "Crotene" dan "Oristrano" yang
   * seharusnya Crotone dan Oristano. `name_it` konsisten berbahasa Italia
   * dan benar di semua 110 provinsi kecuali dua yang ditambal di atas.
   */
  const name = NAME_PATCH[iso] ?? p.name_it
  if (!name) throw new Error(`${iso} tidak punya name_it dan belum ditambal.`)

  // Penjaga: nama provinsi yang persis sama dengan nama regionnya hampir
  // selalu berarti sumbernya mengisi kolom yang salah. Dua kasus yang
  // diketahui sudah ditambal; yang baru harus gagal, bukan lolos diam-diam.
  if (name === region && !NAME_PATCH[iso]) {
    throw new Error(`${iso}: nama provinsi sama dengan region ("${name}") — kemungkinan salah kolom di sumber.`)
  }

  return {
    type: 'Feature',
    properties: {
      id: iso,
      name,
      // Nama provinsi Italia tidak diterjemahkan ke bahasa Indonesia —
      // `name_id` di sumber justru memuat terjemahan setengah jalan
      // ("Pesaro dan Urbino"), yang lebih buruk daripada nama aslinya.
      name_id: name,
      region,
      country: 'Italy',
      iso_a2: 'IT',
    },
    geometry: {
      type: f.geometry.type,
      coordinates: roundCoords(f.geometry.coordinates),
    },
  }
})

features.sort((a, b) => a.properties.name.localeCompare(b.properties.name))

const out = new URL('it-provinces.geo.json', DATA_DIR)
writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', features }))

const regions = [...new Set(features.map(f => f.properties.region))].sort()
const bytes = readFileSync(out).length
console.log(`${features.length} provinsi ditulis ke it-provinces.geo.json (${(bytes / 1024).toFixed(0)} KB)`)
console.log(`region (${regions.length}): ${regions.join(', ')}`)
