/**
 * Bangun dataset kecamatan seluruh Indonesia, dipecah satu file per kabupaten/kota
 * supaya game bisa lazy-load hanya wilayah yang sedang dimainkan.
 *
 * Sumber:
 *  - Geometri: GADM 4.1 level-3 (gadm41_IDN_3.json)
 *      https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_IDN_3.json.zip
 *      LISENSI: hanya penggunaan non-komersial; redistribusi perlu izin GADM.
 *      Lihat app/assets/data/KECAMATAN.md.
 *  - Nama resmi: Kepmendagri No 300.2.2-2138 Tahun 2025 via cahyadsn/wilayah (MIT)
 *      https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.sql
 *
 * Nama GADM ditulis tanpa spasi ("AronganLambalek") dan sebagian sudah usang, jadi
 * dicocokkan ke nama resmi per kabupaten. Yang tidak ketemu di-fallback ke pemecah
 * CamelCase supaya tetap terbaca.
 *
 * Pakai: node scripts/build-kecamatan.mjs [gadm.json] [wilayah.sql]
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'

const GADM = process.argv[2] ?? '/tmp/gadm3/gadm41_IDN_3.json'
const WILAYAH = process.argv[3] ?? '/tmp/wilayah.sql'
const OUT_DIR = new URL('../app/assets/data/kecamatan/', import.meta.url)

/** Toleransi Douglas-Peucker dalam derajat (~55 m) dan presisi koordinat. */
const TOLERANCE = 0.0005
const PRECISION = 4
/** Pulau/poligon lebih kecil dari ini dibuang (derajat persegi). */
const MIN_AREA = 2e-6

/** Fitur GADM yang bukan wilayah administratif. */
const NON_ADMIN_TYPES = new Set(['WaterBody'])

/**
 * GADM menyisipkan poligon tutupan lahan dan perairan sebagai fitur level-3.
 * Pencocokan harus pada nama LENGKAP, bukan awalan: banyak kecamatan asli
 * berawalan kata yang sama (Teluk Naga, Selat Nasik, Danau Paris, Situraja),
 * dan nama kabupaten pun bisa berawalan itu (Situbondo, Teluk Bintuni).
 */
const NON_ADMIN_NAME = new RegExp(
  '^('
  + 'hutan|lahan|pulau|air|tanah'
  + '|danau|waduk|situ|rawa|laut|selat|teluk|lake'
  + '|danau/waduk|danau ?sunter ?dll'
  + ')$',
  'i',
)

/**
 * Perairan bernama, mis. "WadukJatiluhur" atau "DanauSentarum". Nama saja tidak
 * cukup untuk memutuskan — "Danau Kerinci" dan "Danau Paris" adalah kecamatan
 * asli — jadi ini hanya jadi kandidat; penentunya daftar kecamatan resmi.
 */
const WATER_PREFIX = /^(danau|waduk|situ|rawa|laut|selat|teluk)/i

/**
 * NAME_2 GADM yang tidak bisa dicocokkan otomatis ke nama resmi:
 * singkatan, prefix "Kota" yang menyatu dengan nama, atau nama yang sudah berganti.
 *
 * Tiga entri terakhir wajib: nama GADM-nya kini dipakai wilayah lain, jadi tanpa
 * alias mereka menimpa kabupaten yang benar (mis. "Pontianak" adalah nama lama
 * Kabupaten Mempawah, bukan Kota Pontianak).
 */
const KAB_ALIAS = {
  'Jambi|TanjungJabungB': '15.06',
  'Jambi|TanjungJabungT': '15.07',
  'KalimantanSelatan|KotaBaru': '63.02',
  'KalimantanTengah|KotawaringinBarat': '62.01',
  'KalimantanTengah|KotawaringinTimur': '62.02',
  'SulawesiBarat|MamujuUtara': '76.01',
  'SulawesiUtara|Kotamobagu': '71.74',
  'SulawesiUtara|SiauTagulandangBiaro': '71.09',
  'SumateraUtara|PakpakBarat': '12.15',
  'SumateraUtara|TobaSamosir': '12.12',
  // Nama lama -> kabupaten yang sekarang.
  'KalimantanBarat|Pontianak': '61.02', // kini Kabupaten Mempawah
  'Maluku|MalukuTenggaraBarat': '81.03', // kini Kabupaten Kepulauan Tanimbar
  'JawaBarat|Banjar': '32.79', // Kota Banjar (Jabar), bukan Kabupaten Banjar (Kalsel)
}

const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Buang prefix kota/kabupaten setelah dinormalisasi (GADM tidak pakai spasi). */
const bareNorm = s =>
  norm(s).replace(/^(kabupatenadministrasi|kotaadministrasi|kabupaten|kota|kab)/, '')

const isCityName = s => /^kota/i.test(String(s ?? '').replace(/[^a-zA-Z]/g, ''))

/** Jarak Levenshtein, untuk mencocokkan typo nama GADM ke nama resmi. */
function editDistance(a, b) {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m || !n) return Math.max(m, n)

  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

/** "AronganLambalek" -> "Arongan Lambalek", dipakai kalau nama resmi tak ketemu. */
const splitCamel = s =>
  String(s ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()

// ---------------------------------------------------------------- nama resmi

/** Parse INSERT ... ('11.01.01','Bakongan') dari dump wilayah.sql. */
function readOfficialNames(path) {
  const sql = readFileSync(path, 'utf8')
  const prov = new Map()
  const kab = new Map()
  const kec = new Map()

  for (const [, code, name] of sql.matchAll(/\('([0-9.]+)','([^']*)'\)/g)) {
    const depth = code.split('.').length
    if (depth === 1) prov.set(code, name)
    else if (depth === 2) kab.set(code, name)
    else if (depth === 3) kec.set(code, name)
  }
  return { prov, kab, kec }
}

// ------------------------------------------------------------ simplifikasi

function perpendicular(p, a, b) {
  const [x, y] = p
  const [x1, y1] = a
  const [x2, y2] = b
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1)
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

/** Douglas-Peucker iteratif — rekursif kena stack overflow di ring besar. */
function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]

  while (stack.length) {
    const [first, last] = stack.pop()
    let index = -1
    let max = 0
    for (let i = first + 1; i < last; i++) {
      const d = perpendicular(points[i], points[first], points[last])
      if (d > max) {
        max = d
        index = i
      }
    }
    if (max > tolerance && index !== -1) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }
  return points.filter((_, i) => keep[i])
}

const factor = 10 ** PRECISION
const round = n => Math.round(n * factor) / factor

function simplifyRing(ring, tolerance) {
  let out = douglasPeucker(ring, tolerance).map(([x, y]) => [round(x), round(y)])

  // Buang titik kembar yang muncul setelah pembulatan.
  const deduped = [out[0]]
  for (let i = 1; i < out.length; i++) {
    const prev = deduped[deduped.length - 1]
    if (out[i][0] !== prev[0] || out[i][1] !== prev[1]) deduped.push(out[i])
  }
  const first = deduped[0]
  const last = deduped[deduped.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) deduped.push([...first])

  return deduped.length >= 4 ? deduped : null
}

function ringArea(ring) {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return Math.abs(sum / 2)
}

function simplifyGeometry(geometry) {
  if (!geometry) return null
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const kept = []

  for (const polygon of polygons) {
    const rings = []
    for (let i = 0; i < polygon.length; i++) {
      const ring = simplifyRing(polygon[i], TOLERANCE)
      if (!ring) continue
      // Ring luar terlalu kecil -> buang seluruh poligon (pulau kecil).
      if (i === 0 && ringArea(ring) < MIN_AREA) {
        rings.length = 0
        break
      }
      rings.push(ring)
    }
    if (rings.length) kept.push(rings)
  }

  if (!kept.length) return null
  return kept.length === 1
    ? { type: 'Polygon', coordinates: kept[0] }
    : { type: 'MultiPolygon', coordinates: kept }
}

// ------------------------------------------------------------------- build

const official = readOfficialNames(WILAYAH)
const raw = JSON.parse(readFileSync(GADM, 'utf8'))

/** Kabupaten resmi + daftar kecamatannya, untuk dicocokkan dengan GADM. */
const officialKab = new Map()
for (const [code, name] of official.kab) {
  officialKab.set(code, { code, name, isCity: isCityName(name), kecs: [] })
}
for (const [code, name] of official.kec) {
  const parent = officialKab.get(code.split('.').slice(0, 2).join('.'))
  if (parent) parent.kecs.push({ code, name })
}

const kabByName = new Map()
for (const entry of officialKab.values()) {
  const key = bareNorm(entry.name)
  if (!kabByName.has(key)) kabByName.set(key, [])
  kabByName.get(key).push(entry)
}

/** Semua nama kecamatan resmi, penentu apakah sebuah fitur wilayah asli. */
const officialKecNames = new Set([...official.kec.values()].map(norm))

/**
 * Nama kecamatan -> kode kabupaten menurut daftar resmi terbaru. GADM 4.1 masih
 * memakai batas sebelum pemekaran, jadi kecamatan yang kini milik kabupaten baru
 * (mis. Pangandaran yang dipisah dari Ciamis) masih tercatat di induk lamanya.
 * Nama yang dipakai lebih dari satu kabupaten diabaikan supaya tidak salah pindah.
 */
const kecNameToKab = new Map()
for (const [code, name] of official.kec) {
  const key = norm(name)
  const kabCode = code.split('.').slice(0, 2).join('.')
  if (kecNameToKab.has(key) && kecNameToKab.get(key) !== kabCode) {
    kecNameToKab.set(key, null) // ambigu
    continue
  }
  kecNameToKab.set(key, kabCode)
}

/**
 * Buang fitur yang bukan kecamatan. Daftar resmi jadi penentu: nama yang ada di
 * situ selalu dipertahankan, walau berawalan kata perairan. Filter hanya melihat
 * NAME_3 — nama kabupaten tidak relevan, dan menyaringnya ikut membuang seluruh
 * Situbondo, Teluk Bintuni, dan Teluk Wondama.
 */
function isNonAdmin(p) {
  const name3 = String(p.NAME_3 ?? '').trim()
  if (officialKecNames.has(norm(name3))) return false
  if (NON_ADMIN_TYPES.has(p.TYPE_3)) return true
  if (NON_ADMIN_NAME.test(name3)) return true
  // Perairan bernama yang tidak ada di daftar resmi, mis. "WadukJatiluhur".
  if (WATER_PREFIX.test(name3) && splitCamel(name3).includes(' ')) return true
  return false
}

// Kelompokkan fitur GADM per kabupaten/kota.
const groups = new Map()
for (const feature of raw.features) {
  const p = feature.properties
  if (isNonAdmin(p)) continue

  const key = `${p.NAME_1}|${p.NAME_2}`
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(feature)
}

/** Pilih kabupaten resmi yang paling cocok: nama sama + kecamatannya paling banyak tumpang tindih. */
function matchKab(key, features) {
  const aliased = KAB_ALIAS[key]
  if (aliased) return officialKab.get(aliased) ?? null

  const name2 = key.split('|')[1]
  let candidates = kabByName.get(bareNorm(name2)) ?? []
  if (candidates.length > 1) {
    const sameKind = candidates.filter(c => c.isCity === isCityName(name2))
    if (sameKind.length) candidates = sameKind
  }
  if (!candidates.length) return null

  let best = null
  let bestScore = -1
  for (const candidate of candidates) {
    const names = new Set(candidate.kecs.map(k => norm(k.name)))
    const score = features.filter(f => names.has(norm(f.properties.NAME_3))).length
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }

  // Nol kecocokan nama kecamatan berarti nama kabupatennya kebetulan sama tapi
  // wilayahnya beda (nama lama yang kini dipakai daerah lain). Tolak daripada
  // menimpa kabupaten yang benar — perlu entri KAB_ALIAS.
  if (bestScore === 0 && (best?.kecs.length ?? 0) > 0) return null

  return best
}

const slug = s =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

let matchedKab = new Map()

/**
 * Pindahkan fitur ke kabupaten yang benar menurut daftar resmi terbaru.
 * Hanya dipindah kalau nama kecamatannya persis ada di daftar dan tidak ambigu,
 * dan kabupaten tujuannya memang punya padanan resmi — jadi wilayah hasil
 * pemekaran muncul di kabupatennya sendiri, bukan menumpuk di induk lamanya.
 */
let reassigned = 0
{
  const resolved = new Map()
  for (const [key, features] of groups) resolved.set(key, matchKab(key, features))

  /** Kode kabupaten -> key grup yang sudah dipetakan ke kode itu. */
  const keyByKabCode = new Map()
  for (const [key, kab] of resolved) if (kab) keyByKabCode.set(kab.code, key)

  for (const [key, features] of [...groups]) {
    const currentKab = resolved.get(key)
    if (!currentKab) continue

    const staying = []
    for (const feature of features) {
      const target = kecNameToKab.get(norm(feature.properties.NAME_3))
      if (!target || target === currentKab.code) {
        staying.push(feature)
        continue
      }
      const targetKab = officialKab.get(target)
      if (!targetKab) {
        staying.push(feature)
        continue
      }
      // Grup tujuan: yang sudah ada, atau grup sintetis baru untuk kabupaten
      // yang belum ada di GADM sama sekali.
      let targetKey = keyByKabCode.get(target)
      if (!targetKey) {
        targetKey = `${key.split('|')[0]}|__${target}`
        keyByKabCode.set(target, targetKey)
        groups.set(targetKey, [])
        resolved.set(targetKey, targetKab)
      }
      groups.get(targetKey).push(feature)
      reassigned++
    }
    groups.set(key, staying)
  }

  // Buang grup yang jadi kosong setelah pemindahan.
  for (const [key, features] of [...groups]) if (!features.length) groups.delete(key)

  // Simpan hasil pencocokan supaya loop di bawah tidak menghitung ulang
  // (grup sintetis tidak punya NAME_2 yang bisa dicocokkan).
  matchedKab = resolved
}

rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })

const index = []
const writtenIds = new Map()
const unmatchedKab = []
let totalKec = 0
let renamedKec = 0
let fallbackKec = 0
let droppedGeom = 0
let mergedDupes = 0

for (const [key, features] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
  const kab = matchedKab.get(key) ?? matchKab(key, features)
  if (!kab) unmatchedKab.push(key)

  const provinceName = (kab
    ? official.prov.get(kab.code.split('.')[0]) ?? splitCamel(key.split('|')[0])
    : splitCamel(key.split('|')[0])).trim()
  const cityName = (kab ? kab.name : splitCamel(key.split('|')[1])).trim()

  // Nama resmi kecamatan, diindeks per nama ternormalisasi.
  const officialKec = new Map((kab?.kecs ?? []).map(k => [norm(k.name), k]))
  const usedCodes = new Set()

  /**
   * Nama GADM kadang typo ("Menddoyo", "Kabayoran Lama"). Cari padanan terdekat
   * di dalam kabupaten yang sama; batas jarak dibuat proporsional terhadap
   * panjang nama supaya nama pendek tidak salah tebak.
   */
  function closestOfficial(rawName) {
    const target = norm(rawName)
    const limit = Math.max(1, Math.floor(target.length * 0.25))
    let best = null
    let bestDistance = Infinity

    for (const candidate of kab?.kecs ?? []) {
      if (usedCodes.has(candidate.code)) continue
      const distance = editDistance(target, norm(candidate.name))
      if (distance < bestDistance) {
        bestDistance = distance
        best = candidate
      }
    }
    return bestDistance <= limit ? best : null
  }

  // Sederhanakan geometri dulu; fitur yang habis tersimplifikasi dibuang.
  const prepared = []
  for (const feature of features) {
    const geometry = simplifyGeometry(feature.geometry)
    if (!geometry) {
      droppedGeom++
      continue
    }
    prepared.push({ p: feature.properties, geometry })
  }

  // Penamaan dua tahap: nama yang persis sama dengan daftar resmi mengklaim
  // kodenya lebih dulu, baru sisanya dicocokkan lewat jarak edit. Tanpa urutan
  // ini, typo seperti "Menddoyo" bisa mengklaim "Mendoyo" sebelum ejaan yang
  // benar sempat, lalu keduanya berakhir bernama sama.
  const named = new Array(prepared.length).fill(null)
  prepared.forEach(({ p }, i) => {
    const exact = officialKec.get(norm(p.NAME_3))
    if (exact && !usedCodes.has(exact.code)) {
      usedCodes.add(exact.code)
      named[i] = exact.name
      renamedKec++
    }
  })
  prepared.forEach(({ p }, i) => {
    if (named[i]) return
    const match = closestOfficial(p.NAME_3)
    if (match) {
      usedCodes.add(match.code)
      named[i] = match.name
      renamedKec++
    }
    else {
      named[i] = splitCamel(p.NAME_3)
      fallbackKec++
    }
  })

  /**
   * GADM kadang memuat satu kecamatan dua kali dengan ejaan berbeda
   * ("SetiaBudi" + "Setiabudi", "Menddoyo" + "Mendoyo"). Poligonnya digabung,
   * bukan dibuang, supaya tidak ada wilayah yang hilang dari peta.
   *
   * Varian yang tidak ada di daftar resmi digabung ke tetangga terdekatnya di
   * kabupaten yang sama; hanya nama fallback yang boleh dilebur, jadi kecamatan
   * resmi yang namanya mirip tidak ikut tergabung.
   */
  const polysOf = g => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
  const merged = new Map()
  const officialNamesHere = new Set((kab?.kecs ?? []).map(k => norm(k.name)))

  function mergeTargetFor(name) {
    const key = norm(name)
    if (merged.has(key)) return key
    // Nama resmi selalu jadi entri sendiri.
    if (officialNamesHere.has(key)) return null
    // Varian ejaan: cari entri yang sudah ada dan sangat mirip.
    const limit = Math.max(1, Math.floor(key.length * 0.2))
    let best = null
    let bestDistance = Infinity
    for (const existing of merged.keys()) {
      const distance = editDistance(key, existing)
      if (distance < bestDistance) {
        bestDistance = distance
        best = existing
      }
    }
    return bestDistance <= limit ? best : null
  }

  // Nama resmi dimasukkan lebih dulu supaya varian ejaan punya target untuk
  // digabung; urutan asli GADM kadang menaruh varian sebelum ejaan yang benar.
  const mergeOrder = prepared
    .map((_, i) => i)
    .sort((a, b) => {
      const aOfficial = officialNamesHere.has(norm(named[a])) ? 0 : 1
      const bOfficial = officialNamesHere.has(norm(named[b])) ? 0 : 1
      return aOfficial - bOfficial
    })

  for (const i of mergeOrder) {
    const name = named[i].trim()
    const { p, geometry } = prepared[i]
    const target = mergeTargetFor(name)

    if (target === null) {
      merged.set(norm(name), { name, id: p.GID_3, geometry })
      continue
    }
    const existing = merged.get(target)
    existing.geometry = {
      type: 'MultiPolygon',
      coordinates: [...polysOf(existing.geometry), ...polysOf(geometry)],
    }
    // Kalau entri yang ada bernama fallback dan yang baru nama resmi, pakai yang resmi.
    if (!officialNamesHere.has(target) && officialNamesHere.has(norm(name))) {
      existing.name = name
    }
    mergedDupes++
  }

  const out = [...merged.values()].map(({ name, id, geometry }) => ({
    type: 'Feature',
    properties: {
      // GID_3 unik per fitur GADM; CC_3 ada yang kosong/duplikat.
      id: `KEC-${id}`,
      name,
      fullName: `Kecamatan ${name}`,
      name_id: name,
      city: cityName,
      province: provinceName,
      region: cityName,
      country: 'Indonesia',
    },
    geometry,
  }))

  if (!out.length) continue
  out.sort((a, b) => a.properties.name.localeCompare(b.properties.name))
  totalKec += out.length

  const id = kab ? kab.code.replace('.', '-') : slug(key)
  // Dua grup GADM tidak boleh menulis ke file yang sama — kalau terjadi, satu
  // wilayah hilang tanpa jejak. Lebih baik gagal keras.
  if (writtenIds.has(id)) {
    throw new Error(
      `Tabrakan id "${id}": "${key}" dan "${writtenIds.get(id)}" ter-map ke kabupaten yang sama. Tambahkan KAB_ALIAS.`,
    )
  }
  writtenIds.set(id, key)
  const file = `${id}.geo.json`
  writeFileSync(
    new URL(file, OUT_DIR),
    JSON.stringify({ type: 'FeatureCollection', features: out }),
  )

  index.push({
    id,
    file,
    city: cityName,
    province: provinceName,
    count: out.length,
  })
}

index.sort(
  (a, b) => a.province.localeCompare(b.province) || a.city.localeCompare(b.city),
)
writeFileSync(
  new URL('index.json', OUT_DIR),
  JSON.stringify({ provinces: [...new Set(index.map(i => i.province))].sort(), cities: index }),
)

const provinceCount = new Set(index.map(i => i.province)).size
console.log(`${totalKec} kecamatan di ${index.length} kabupaten/kota (${provinceCount} provinsi)`)
console.log(`nama resmi: ${renamedKec}, fallback CamelCase: ${fallbackKec}`)
if (droppedGeom) console.log(`geometri dibuang (terlalu kecil): ${droppedGeom}`)
if (mergedDupes) console.log(`fitur duplikat digabung: ${mergedDupes}`)
if (reassigned) console.log(`fitur dipindah ke kabupaten hasil pemekaran: ${reassigned}`)
if (unmatchedKab.length) {
  console.log(`kabupaten tanpa padanan resmi (${unmatchedKab.length}): ${unmatchedKab.join(', ')}`)
}
