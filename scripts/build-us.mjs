/**
 * Bangun dataset Amerika Serikat: 50 state + DC, dan county dipecah satu file
 * per state supaya game hanya mengunduh state yang sedang dimainkan.
 *
 * Sumber: US Census Bureau Cartographic Boundary Files 2023 (1:20.000.000).
 *   https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_20m.zip
 *   https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_20m.zip
 *   LISENSI: public domain (karya pemerintah AS) — boleh diredistribusi.
 *   Ini alasan US dipilih lebih dulu; lihat app/assets/data/US.md.
 *
 * Berbeda dari build-kecamatan.mjs, tidak ada pencocokan nama di sini: Census
 * sudah memberi nama resmi lewat NAMELSAD, termasuk satuan yang bukan "County"
 * (Parish di Louisiana, Borough & Census Area di Alaska).
 *
 * Butuh mapshaper untuk membaca shapefile:
 *   npx mapshaper <shp> -proj wgs84 -simplify … -o format=geojson
 *
 * Pakai: node scripts/build-us.mjs [dir-berisi-shp]
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SRC_DIR = process.argv[2] ?? '/tmp/us-census'
const DATA_DIR = new URL('../app/assets/data/', import.meta.url)
const COUNTY_DIR = new URL('us-county/', DATA_DIR)

const STATE_SHP = join(SRC_DIR, 'cb_2023_us_state_20m.shp')
const COUNTY_SHP = join(SRC_DIR, 'cb_2023_us_county_20m.shp')

/**
 * Simplifikasi lebih agresif untuk state: bentuknya besar, jadi detail pantai
 * tidak menambah apa pun pada tebakan tapi memperbesar file dua kali.
 */
const STATE_SIMPLIFY = '6%'
const COUNTY_SIMPLIFY = '12%'
const PRECISION = 0.0001

/**
 * Wilayah Census (Northeast/Midwest/South/West) dipakai sebagai `region`,
 * sejajar dengan benua di mode dunia dan kepulauan di mode Indonesia, supaya
 * filter "mau fokus di mana" ikut berfungsi di sini. Census tidak menyertakan
 * kolom ini di shapefile state, jadi dipetakan dari kode FIPS.
 */
const REGION_BY_FIPS = {
  // Northeast
  '09': 'Northeast', '23': 'Northeast', '25': 'Northeast', '33': 'Northeast',
  '34': 'Northeast', '36': 'Northeast', '42': 'Northeast', '44': 'Northeast',
  '50': 'Northeast',
  // Midwest
  '17': 'Midwest', '18': 'Midwest', '19': 'Midwest', '20': 'Midwest',
  '26': 'Midwest', '27': 'Midwest', '29': 'Midwest', '31': 'Midwest',
  '38': 'Midwest', '39': 'Midwest', '46': 'Midwest', '55': 'Midwest',
  // South
  '01': 'South', '05': 'South', '10': 'South', '11': 'South', '12': 'South',
  '13': 'South', '21': 'South', '22': 'South', '24': 'South', '28': 'South',
  '37': 'South', '40': 'South', '45': 'South', '47': 'South', '48': 'South',
  '51': 'South', '54': 'South',
  // West
  '02': 'West', '04': 'West', '06': 'West', '08': 'West', '15': 'West',
  '16': 'West', '30': 'West', '32': 'West', '35': 'West', '41': 'West',
  '49': 'West', '53': 'West', '56': 'West',
}

/**
 * Teritori dibuang: tidak ada di file county 20m, dan letaknya jauh dari
 * daratan utama sehingga kamera ikut zoom keluar sampai peta tak terbaca.
 */
const EXCLUDE_FIPS = new Set(['60', '66', '69', '72', '78'])

/**
 * State dengan county lebih sedikit dari ini tidak masuk indeks pemilih county.
 * Angkanya = jumlah pilihan di Mode B (tebak nama): di bawah itu soalnya tidak
 * punya cukup distraktor, dan DC yang cuma satu county jadi soal tanpa lawan.
 * Mereka tetap ada di mode state.
 */
const MIN_COUNTIES = 4

function shapefileToGeojson(shp, simplify) {
  if (!existsSync(shp)) {
    throw new Error(
      `Shapefile tidak ada: ${shp}\n`
      + `Unduh & ekstrak dulu:\n`
      + `  mkdir -p ${SRC_DIR} && cd ${SRC_DIR}\n`
      + `  curl -LO https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_20m.zip\n`
      + `  curl -LO https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_20m.zip\n`
      + `  unzip -o '*.zip'`,
    )
  }
  const out = join(tmpdir(), `us-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
  // Census memakai NAD83; diproyeksikan ke WGS84 supaya sejajar dengan
  // dataset lain dan dengan ubin peta.
  execFileSync('npx', [
    '--yes', 'mapshaper', shp,
    '-proj', 'wgs84',
    '-simplify', simplify, 'keep-shapes',
    '-o', `precision=${PRECISION}`, 'format=geojson', out,
  ], { stdio: ['ignore', 'ignore', 'inherit'] })

  const data = JSON.parse(readFileSync(out, 'utf8'))
  rmSync(out, { force: true })
  return data
}

const slug = s =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

// ─── State ──────────────────────────────────────────────────────────────────

console.log('membaca state…')
const rawStates = shapefileToGeojson(STATE_SHP, STATE_SIMPLIFY)

const stateFeatures = []
/** FIPS -> nama & kode pos, dipakai saat memberi label county. */
const stateByFips = new Map()

for (const f of rawStates.features) {
  const p = f.properties
  if (EXCLUDE_FIPS.has(p.STATEFP)) continue

  const region = REGION_BY_FIPS[p.STATEFP]
  if (!region) throw new Error(`State ${p.NAME} (${p.STATEFP}) belum ada di REGION_BY_FIPS.`)

  stateByFips.set(p.STATEFP, { name: p.NAME, abbr: p.STUSPS, region })
  stateFeatures.push({
    type: 'Feature',
    properties: {
      id: `US-${p.STATEFP}`,
      name: p.NAME,
      // Nama wilayah tidak diterjemahkan — sama seperti nama kecamatan.
      name_id: p.NAME,
      abbr: p.STUSPS,
      region,
      country: 'United States of America',
      iso_a2: 'US',
    },
    geometry: f.geometry,
  })
}

stateFeatures.sort((a, b) => a.properties.name.localeCompare(b.properties.name))
writeFileSync(
  new URL('us-states.geo.json', DATA_DIR),
  JSON.stringify({ type: 'FeatureCollection', features: stateFeatures }),
)

// ─── County ─────────────────────────────────────────────────────────────────

console.log('membaca county…')
const rawCounties = shapefileToGeojson(COUNTY_SHP, COUNTY_SIMPLIFY)

/** Kelompokkan county per state; satu file per state. */
const byState = new Map()
for (const f of rawCounties.features) {
  const p = f.properties
  if (EXCLUDE_FIPS.has(p.STATEFP)) continue
  if (!stateByFips.has(p.STATEFP)) {
    throw new Error(`County ${p.NAMELSAD} punya STATEFP ${p.STATEFP} yang tidak ada di file state.`)
  }
  if (!byState.has(p.STATEFP)) byState.set(p.STATEFP, [])
  byState.get(p.STATEFP).push(f)
}

rmSync(COUNTY_DIR, { recursive: true, force: true })
mkdirSync(COUNTY_DIR, { recursive: true })

const index = []
const skipped = []
let totalCounties = 0

for (const [fips, features] of [...byState].sort(([a], [b]) => a.localeCompare(b))) {
  const state = stateByFips.get(fips)

  const out = features.map((f) => {
    const p = f.properties
    return {
      type: 'Feature',
      properties: {
        // GEOID unik nasional (state FIPS + county FIPS).
        id: `USC-${p.GEOID}`,
        // NAMELSAD sudah memuat satuannya: "Brooks County", "Orleans Parish",
        // "Nome Census Area". NAME saja akan menghapus perbedaan itu.
        name: p.NAMELSAD,
        name_id: p.NAMELSAD,
        shortName: p.NAME,
        state: state.name,
        // Sejajar dengan kecamatan: region = induk langsung, dipakai sebagai
        // pengelompokan dan filter di UI.
        region: state.name,
        country: 'United States of America',
      },
      geometry: f.geometry,
    }
  })

  out.sort((a, b) => a.properties.name.localeCompare(b.properties.name))

  if (out.length < MIN_COUNTIES) {
    skipped.push(`${state.abbr} (${out.length})`)
    continue
  }
  totalCounties += out.length

  const id = `${fips}-${slug(state.abbr)}`
  const file = `${id}.geo.json`
  writeFileSync(
    new URL(file, COUNTY_DIR),
    JSON.stringify({ type: 'FeatureCollection', features: out }),
  )

  index.push({
    id,
    file,
    state: state.name,
    abbr: state.abbr,
    region: state.region,
    count: out.length,
  })
}

index.sort((a, b) => a.state.localeCompare(b.state))
writeFileSync(
  new URL('index.json', COUNTY_DIR),
  JSON.stringify({
    regions: [...new Set(index.map(i => i.region))].sort(),
    states: index,
  }),
)

console.log(`${stateFeatures.length} state ditulis ke us-states.geo.json`)
console.log(`${totalCounties} county di ${index.length} state ditulis ke us-county/`)
if (skipped.length) {
  console.log(`state dilewati (county < ${MIN_COUNTIES}): ${skipped.join(', ')}`)
}
