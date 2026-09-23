/**
 * Bangun dataset Jerman: 16 negara bagian (Bundesländer).
 *
 * Sumber: Natural Earth 1:10m admin-1 states/provinces.
 *   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
 *   LISENSI: public domain — boleh diredistribusi tanpa syarat.
 *
 * Pola dan alasannya sama dengan build-it.mjs / build-jp.mjs; lihat
 * app/assets/data/DEUTSCHLAND.md.
 *
 * Pakai: node scripts/build-de.mjs [path-ke-ne_10m_admin_1.geojson]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const INPUT = process.argv[2] ?? '/tmp/ne1.geojson'
const DATA_DIR = new URL('../app/assets/data/', import.meta.url)

const round = n => Math.round(n * 1000) / 1000
const roundCoords = c =>
  typeof c[0] === 'number' ? [round(c[0]), round(c[1])] : c.map(roundCoords)

/**
 * Pengelompokan wilayah, sejajar dengan benua di mode dunia dan kepulauan di
 * mode Indonesia — ini yang mengisi filter "mau fokus di mana".
 *
 * Natural Earth membiarkan kolom `region` kosong untuk semua negara bagian
 * Jerman, jadi dipetakan dari kode ISO 3166-2. Pembagiannya memakai empat
 * penjuru mata angin yang lazim dipakai sehari-hari di Jerman
 * (Nord/Ost/West/Süd), bukan pembagian administratif — Jerman tidak punya
 * tingkat wilayah resmi antara negara bagian dan negara.
 */
const REGION_BY_ISO = {
  // Utara — pesisir Laut Utara & Baltik.
  'DE-SH': 'North', // Schleswig-Holstein
  'DE-HH': 'North', // Hamburg
  'DE-HB': 'North', // Bremen
  'DE-NI': 'North', // Niedersachsen
  'DE-MV': 'North', // Mecklenburg-Vorpommern

  // Timur — bekas wilayah Jerman Timur.
  'DE-BE': 'East', // Berlin
  'DE-BB': 'East', // Brandenburg
  'DE-SN': 'East', // Sachsen
  'DE-ST': 'East', // Sachsen-Anhalt
  'DE-TH': 'East', // Thüringen

  // Barat — sepanjang Rhein & Ruhr.
  'DE-NW': 'West', // Nordrhein-Westfalen
  'DE-HE': 'West', // Hessen
  'DE-RP': 'West', // Rheinland-Pfalz
  'DE-SL': 'West', // Saarland

  // Selatan — Bayern & Baden-Württemberg.
  'DE-BY': 'South', // Bayern
  'DE-BW': 'South', // Baden-Württemberg
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
const source = raw.features.filter(f => f.properties.admin === 'Germany')

if (source.length !== 16) {
  // Gagal keras, bukan diam-diam menulis dataset yang kurang: Jerman punya
  // 16 negara bagian, dan jumlah yang meleset berarti sumbernya berubah
  // bentuk — bukan sesuatu yang boleh lolos ke game.
  throw new Error(`Diharapkan 16 negara bagian Jerman, dapat ${source.length}.`)
}

const seen = new Set()

const features = source.map((f) => {
  const p = f.properties
  const iso = p.iso_3166_2
  if (!iso) throw new Error(`Negara bagian "${p.name}" tidak punya kode ISO.`)
  if (seen.has(iso)) throw new Error(`Kode ISO ganda: ${iso}.`)
  seen.add(iso)

  const region = REGION_BY_ISO[iso]
  if (!region) throw new Error(`${p.name} (${iso}) belum ada di REGION_BY_ISO.`)

  return {
    type: 'Feature',
    properties: {
      id: iso,
      // Kolom `name` Natural Earth untuk Jerman sudah berbahasa Jerman
      // (Bayern, Sachsen, …), dan itulah nama yang dipakai — bukan exonim
      // Inggris yang justru tidak tersedia di sumbernya.
      name: p.name,
      // Nama negara bagian Jerman tidak diterjemahkan ke bahasa Indonesia;
      // diisi sama dengan namanya, persis pendekatan Italia di build-it.mjs.
      name_id: p.name,
      region,
      country: 'Germany',
      iso_a2: 'DE',
    },
    geometry: {
      type: f.geometry.type,
      coordinates: roundCoords(f.geometry.coordinates),
    },
  }
})

features.sort((a, b) => a.properties.name.localeCompare(b.properties.name))

const out = new URL('de-states.geo.json', DATA_DIR)
writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', features }))

const regions = [...new Set(features.map(f => f.properties.region))].sort()
const bytes = readFileSync(out).length
console.log(`${features.length} negara bagian ditulis ke de-states.geo.json (${(bytes / 1024).toFixed(0)} KB)`)
console.log(`region (${regions.length}): ${regions.join(', ')}`)
