/**
 * Bangun dataset Malaysia: 16 negeri & wilayah persekutuan.
 *
 * Sumber: Natural Earth 1:10m admin-1 states/provinces.
 *   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
 *   LISENSI: public domain — boleh diredistribusi tanpa syarat.
 *
 * Alasan Natural Earth dipilih, bukan GADM: file di repo ini ikut
 * dipublikasikan bersama aplikasinya, dan lisensi GADM melarang redistribusi
 * (lihat catatan di app/assets/data/KECAMATAN.md). Natural Earth juga sudah
 * berbentuk GeoJSON, jadi tidak perlu mapshaper seperti build-us.mjs.
 *
 * Pakai: node scripts/build-my.mjs [path-ke-ne_10m_admin_1.geojson]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const INPUT = process.argv[2] ?? '/tmp/ne10_admin1.json'
const DATA_DIR = new URL('../app/assets/data/', import.meta.url)

/**
 * Pembulatan koordinat. 3 desimal (±100 m) sudah jauh lebih halus daripada
 * yang bisa dibedakan mata pada zoom negeri, dan memangkas file lebih dari
 * separuh — sama dengan yang dipakai build-geodata.mjs untuk negara.
 */
const round = n => Math.round(n * 1000) / 1000
const roundCoords = c =>
  typeof c[0] === 'number' ? [round(c[0]), round(c[1])] : c.map(roundCoords)

/**
 * Pengelompokan wilayah, sejajar dengan benua di mode dunia dan kepulauan di
 * mode Indonesia — ini yang mengisi filter "mau fokus di mana".
 *
 * Natural Earth membiarkan kolom `region` kosong untuk Malaysia, jadi
 * dipetakan dari kode ISO 3166-2. Pembagiannya mengikuti pembagian yang
 * dipakai sehari-hari di Malaysia: Semenanjung dibelah utara/tengah/selatan/
 * pantai timur, dan Borneo berdiri sendiri karena terpisah laut.
 */
const REGION_BY_ISO = {
  'MY-09': 'Semenanjung Utara', // Perlis
  'MY-02': 'Semenanjung Utara', // Kedah
  'MY-07': 'Semenanjung Utara', // Pulau Pinang
  'MY-08': 'Semenanjung Utara', // Perak

  'MY-10': 'Semenanjung Tengah', // Selangor
  'MY-14': 'Semenanjung Tengah', // Kuala Lumpur
  'MY-16': 'Semenanjung Tengah', // Putrajaya

  'MY-05': 'Semenanjung Selatan', // Negeri Sembilan
  'MY-04': 'Semenanjung Selatan', // Melaka
  'MY-01': 'Semenanjung Selatan', // Johor

  'MY-03': 'Pantai Timur', // Kelantan
  'MY-11': 'Pantai Timur', // Terengganu
  'MY-06': 'Pantai Timur', // Pahang

  'MY-12': 'Borneo', // Sabah
  'MY-13': 'Borneo', // Sarawak
  'MY-15': 'Borneo', // Labuan
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
const source = raw.features.filter(f => f.properties.iso_a2 === 'MY')

if (source.length !== 16) {
  // Gagal keras, bukan diam-diam menulis dataset yang kurang: Malaysia punya
  // 13 negeri + 3 wilayah persekutuan, dan jumlah yang meleset berarti
  // sumbernya berubah bentuk — bukan sesuatu yang boleh lolos ke game.
  throw new Error(`Diharapkan 16 negeri/wilayah Malaysia, dapat ${source.length}.`)
}

const features = source.map((f) => {
  const p = f.properties
  const region = REGION_BY_ISO[p.iso_3166_2]
  if (!region) throw new Error(`${p.name} (${p.iso_3166_2}) belum ada di REGION_BY_ISO.`)

  return {
    type: 'Feature',
    properties: {
      // HASC stabil antar rilis Natural Earth; `adm1_code` tidak selalu.
      id: `MY-${p.iso_3166_2.replace('MY-', '')}`,
      name: p.name,
      // Nama negeri Malaysia sama di kedua bahasa; `name_id` dari Natural
      // Earth dipakai kalau ada supaya ejaannya ikut sumber, bukan tebakan.
      name_id: p.name_id || p.name,
      abbr: p.postal,
      region,
      /** Negeri vs Wilayah Persekutuan; ditampilkan sebagai keterangan. */
      kind: p.type_en === 'Federal Territory' ? 'federal' : 'state',
      country: 'Malaysia',
      iso_a2: 'MY',
    },
    geometry: {
      type: f.geometry.type,
      coordinates: roundCoords(f.geometry.coordinates),
    },
  }
})

features.sort((a, b) => a.properties.name.localeCompare(b.properties.name))

const out = new URL('my-states.geo.json', DATA_DIR)
writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', features }))

const regions = [...new Set(features.map(f => f.properties.region))].sort()
const bytes = readFileSync(out).length
console.log(`${features.length} negeri/wilayah ditulis ke my-states.geo.json (${(bytes / 1024).toFixed(0)} KB)`)
console.log(`region: ${regions.join(', ')}`)
