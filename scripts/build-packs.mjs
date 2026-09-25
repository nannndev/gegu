/**
 * Bangun dataset "paket negara": satu tingkat wilayah (provinsi / negara
 * bagian / departemen) untuk negara-negara terkenal yang belum punya
 * dataset sendiri.
 *
 * Sumber: Natural Earth 1:10m admin-1 states/provinces — sumber yang sama
 * dengan build-de.mjs / build-it.mjs / build-jp.mjs.
 *   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
 *   LISENSI: public domain — boleh diredistribusi tanpa syarat.
 *
 * Bedanya dengan skrip per negara: di sini geometrinya disederhanakan
 * (Douglas–Peucker) dan pulau mungil dibuang. Natural Earth 1:10m sangat
 * rapat — Jerman saja 1,8 MB — dan Kanada dengan ribuan pulau Arktiknya
 * akan jadi belasan MB tanpa penyederhanaan. Toleransinya dipilih per
 * negara, kira-kira sepersekian piksel pada zoom main negara itu.
 *
 * Tiap negara gagal keras kalau jumlah wilayahnya meleset: angka yang
 * berubah berarti sumbernya berubah bentuk, dan itu harus diperiksa manusia,
 * bukan diam-diam ditulis ke game.
 *
 * Pakai: node scripts/build-packs.mjs [path-ke-ne_10m_admin_1.geojson] [kode…]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const INPUT = process.argv[2] ?? '/tmp/ne1.geojson'
const ONLY = process.argv.slice(3)
const OUT_DIR = new URL('../app/assets/data/packs/', import.meta.url)

/**
 * Konfigurasi per negara.
 *
 * - `admin`: nilai kolom `admin` Natural Earth.
 * - `worldName`: nama negara di countries.geo.json, kalau beda dari `admin`.
 * - `expect`: jumlah wilayah setelah `keep` — penjaga bentuk sumber.
 * - `keep`: saring wilayah yang bukan bagian permainan (wilayah seberang
 *   laut, pulau terpencil yang jadi fitur sendiri, entri tanpa nama).
 * - `nameField`: kolom nama. Nama lokal beraksara Latin dipakai apa adanya
 *   (Bouches-du-Rhône, São Paulo); negara beraksara lain pakai `name_en`.
 * - `nameIdField`: kolom nama Indonesia, kalau Natural Earth mengisinya
 *   dengan benar ("Benggala Barat", "Jeolla Selatan"). Negara yang namanya
 *   tidak diterjemahkan dalam bahasa Indonesia memakai nama yang sama.
 * - `rename`: koreksi salah eja & nama usang di sumber.
 * - `region`: pengelompokan untuk filter "mau fokus di mana". Kolom
 *   `region` sumber dipakai kalau terisi lengkap; sisanya dipetakan dari ISO.
 * - `tolerance`: toleransi Douglas–Peucker, derajat.
 * - `minRingArea`: cincin (pulau) lebih kecil dari ini dibuang, derajat².
 *   Cincin terbesar tiap wilayah selalu dipertahankan.
 */
const PACKS = {
  fr: {
    admin: 'France',
    expect: 96,
    // Departemen seberang laut (Guyane, Martinique, …) ribuan km dari
    // Eropa; ikut dimuat berarti kamera harus mencakup separuh dunia.
    keep: p => p.type_en === 'Metropolitan department',
    nameField: 'name',
    rename: {
      'FR-68': 'Haut-Rhin', // sumber: "Haute-Rhin"
      'FR-77': 'Seine-et-Marne', // sumber: "Seien-et-Marne"
    },
    region: p => p.region,
    tolerance: 0.004,
    minRingArea: 0.0004,
  },
  es: {
    admin: 'Spain',
    expect: 52,
    keep: () => true,
    nameField: 'name',
    // Sumbernya memakai nama Kastilia lama; nama resminya sekarang
    // mengikuti bahasa daerahnya.
    rename: {
      'ES-C': 'A Coruña',
      'ES-GI': 'Girona',
      'ES-L': 'Lleida',
      'ES-OR': 'Ourense',
    },
    region: p => (p.region === 'Canary Is.' ? 'Canarias' : p.region),
    tolerance: 0.004,
    minRingArea: 0.0004,
  },
  cn: {
    admin: 'China',
    // Nama di countries.geo.json; peta memakainya untuk mengenali daratan
    // negara induk di backdrop.
    worldName: "People's Republic of China",
    expect: 31,
    // Kepulauan Paracel tercatat sebagai fitur tersendiri tanpa tipe.
    keep: p => !p.iso_3166_2.includes('~'),
    nameField: 'name_en',
    nameIdField: 'name_id',
    region: p => (p.iso_3166_2 === 'CN-FJ' ? 'East China' : p.region),
    tolerance: 0.02,
    minRingArea: 0.01,
  },
  in: {
    admin: 'India',
    expect: 36,
    keep: () => true,
    nameField: 'name_en',
    nameIdField: 'name_id',
    rename: { 'IN-AN': 'Andaman and Nicobar Islands' },
    renameId: { 'IN-OR': 'Odisha' }, // sumber memakai nama lama "Orissa"
    region: (p) => {
      if (p.iso_3166_2 === 'IN-AN') return 'South'
      if (p.iso_3166_2 === 'IN-LA') return 'North'
      return p.region
    },
    tolerance: 0.01,
    minRingArea: 0.002,
  },
  br: {
    admin: 'Brazil',
    expect: 27,
    keep: () => true,
    nameField: 'name',
    // Lima wilayah resmi IBGE; kolom `region` sumber kosong.
    region: p => ({
      AC: 'North', AM: 'North', AP: 'North', PA: 'North', RO: 'North', RR: 'North', TO: 'North',
      AL: 'Northeast', BA: 'Northeast', CE: 'Northeast', MA: 'Northeast', PB: 'Northeast', PE: 'Northeast', PI: 'Northeast', RN: 'Northeast', SE: 'Northeast',
      DF: 'Central-West', GO: 'Central-West', MT: 'Central-West', MS: 'Central-West',
      ES: 'Southeast', MG: 'Southeast', RJ: 'Southeast', SP: 'Southeast',
      PR: 'South', RS: 'South', SC: 'South',
    })[p.iso_3166_2.slice(3)],
    tolerance: 0.02,
    minRingArea: 0.005,
  },
  ca: {
    admin: 'Canada',
    expect: 13,
    keep: () => true,
    nameField: 'name',
    region: p => p.region.replace(' Canada', ''),
    // Garis pantai Arktik Kanada adalah yang terpanjang di dunia; toleransi
    // dan batas pulaunya paling longgar di sini.
    tolerance: 0.04,
    minRingArea: 0.08,
  },
  au: {
    admin: 'Australia',
    expect: 8,
    // Lord Howe, Macquarie, dan Jervis Bay tercatat sebagai fitur sendiri;
    // bukan negara bagian/teritori yang dikenal pemain.
    keep: p => !p.iso_3166_2.includes('~') && p.name !== 'Lord Howe Island',
    nameField: 'name_en',
    nameIdField: 'name_id',
    // Delapan wilayah terlalu sedikit untuk dipecah — satu region saja,
    // dan UI menyembunyikan filternya.
    region: () => 'Australia',
    tolerance: 0.02,
    minRingArea: 0.01,
  },
  kr: {
    admin: 'South Korea',
    expect: 17,
    keep: () => true,
    nameField: 'name_en',
    nameIdField: 'name_id',
    // Pembagian wilayah tradisional yang lazim dipakai sehari-hari.
    region: p => ({
      11: 'Capital Area', 28: 'Capital Area', 41: 'Capital Area',
      42: 'Gangwon',
      30: 'Chungcheong', 43: 'Chungcheong', 44: 'Chungcheong', 50: 'Chungcheong',
      29: 'Honam', 45: 'Honam', 46: 'Honam',
      26: 'Yeongnam', 27: 'Yeongnam', 31: 'Yeongnam', 47: 'Yeongnam', 48: 'Yeongnam',
      49: 'Jeju',
    })[p.iso_3166_2.slice(3)],
    tolerance: 0.004,
    minRingArea: 0.0005,
  },
  mx: {
    admin: 'Mexico',
    expect: 32,
    keep: p => Boolean(p.name),
    nameField: 'name',
    // Distrito Federal berganti nama jadi Ciudad de México sejak 2016.
    rename: { 'MX-DIF': 'Ciudad de México' },
    region: p => ({
      BCN: 'Northwest', BCS: 'Northwest', SON: 'Northwest', SIN: 'Northwest', CHH: 'Northwest', DUR: 'Northwest',
      COA: 'Northeast', NLE: 'Northeast', TAM: 'Northeast',
      NAY: 'West', JAL: 'West', COL: 'West', MIC: 'West', AGU: 'West', ZAC: 'West',
      GUA: 'Central', QUE: 'Central', SLP: 'Central', HID: 'Central', MEX: 'Central', DIF: 'Central', MOR: 'Central', PUE: 'Central', TLA: 'Central',
      GRO: 'South', OAX: 'South', CHP: 'South',
      VER: 'Southeast', TAB: 'Southeast', CAM: 'Southeast', YUC: 'Southeast', ROO: 'Southeast',
    })[p.iso_3166_2.slice(3)],
    tolerance: 0.01,
    minRingArea: 0.002,
  },
  th: {
    admin: 'Thailand',
    expect: 77,
    keep: () => true,
    nameField: 'name_en',
    rename: { 'TH-10': 'Bangkok' },
    region: p => p.region,
    tolerance: 0.005,
    minRingArea: 0.0008,
  },
}

// ── Geometri ─────────────────────────────────────────────────────

const round = n => Math.round(n * 1000) / 1000

function ringArea(ring) {
  let a = 0
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return Math.abs(a / 2)
}

/** Jarak kuadrat titik p ke segmen a–b. */
function segDist2(p, a, b) {
  let [x, y] = a
  let dx = b[0] - x
  let dy = b[1] - y
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)
    if (t > 1) { x = b[0]; y = b[1] }
    else if (t > 0) { x += dx * t; y += dy * t }
  }
  dx = p[0] - x
  dy = p[1] - y
  return dx * dx + dy * dy
}

/** Douglas–Peucker iteratif (rekursi meluap di cincin berpuluh ribu titik). */
function simplifyRing(ring, tol) {
  if (ring.length <= 4) return ring
  const tol2 = tol * tol
  const keep = new Uint8Array(ring.length)
  keep[0] = keep[ring.length - 1] = 1
  const stack = [[0, ring.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()
    let maxD = 0
    let idx = -1
    for (let i = first + 1; i < last; i++) {
      const d = segDist2(ring[i], ring[first], ring[last])
      if (d > maxD) { maxD = d; idx = i }
    }
    if (maxD > tol2) {
      keep[idx] = 1
      stack.push([first, idx], [idx, last])
    }
  }
  const out = ring.filter((_, i) => keep[i]).map(([x, y]) => [round(x), round(y)])
  // Buang titik ganda akibat pembulatan.
  const dedup = out.filter((c, i) => i === 0 || c[0] !== out[i - 1][0] || c[1] !== out[i - 1][1])
  return dedup
}

/**
 * Sederhanakan satu fitur. Poligon yang cincin luarnya lebih kecil dari
 * `minRingArea` dibuang — kecuali yang terbesar, supaya wilayah kecil
 * seperti Paris atau Sejong tidak ikut lenyap.
 */
function simplifyGeometry(geometry, tol, minArea) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const withArea = polys.map(poly => ({ poly, area: ringArea(poly[0]) }))
  const biggest = withArea.reduce((a, b) => (b.area > a.area ? b : a))
  const kept = withArea
    .filter(p => p === biggest || p.area >= minArea)
    .map(({ poly }) => poly
      .map(ring => simplifyRing(ring, tol))
      .filter(ring => ring.length >= 4))
    .filter(poly => poly.length > 0)
  if (!kept.length) throw new Error('Geometri habis setelah disederhanakan.')
  return kept.length === 1
    ? { type: 'Polygon', coordinates: kept[0] }
    : { type: 'MultiPolygon', coordinates: kept }
}

// ── Bangun ───────────────────────────────────────────────────────

if (!existsSync(INPUT)) {
  throw new Error(
    `Sumber tidak ada: ${INPUT}\n`
    + `Unduh dulu:\n`
    + `  curl -sL -o ${INPUT} \\\n`
    + `    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson`,
  )
}

const raw = JSON.parse(readFileSync(INPUT, 'utf8'))
mkdirSync(OUT_DIR, { recursive: true })

for (const [code, cfg] of Object.entries(PACKS)) {
  if (ONLY.length && !ONLY.includes(code)) continue

  const source = raw.features.filter(f => f.properties.admin === cfg.admin && cfg.keep(f.properties))
  if (source.length !== cfg.expect) {
    throw new Error(`${cfg.admin}: diharapkan ${cfg.expect} wilayah, dapat ${source.length}.`)
  }

  const seen = new Set()
  const features = source.map((f) => {
    const p = f.properties
    const iso = p.iso_3166_2
    if (!iso) throw new Error(`${cfg.admin}: "${p.name}" tidak punya kode ISO.`)
    if (seen.has(iso)) throw new Error(`${cfg.admin}: kode ISO ganda ${iso}.`)
    seen.add(iso)

    const name = cfg.rename?.[iso] ?? p[cfg.nameField] ?? p.name
    const nameId = cfg.renameId?.[iso] ?? (cfg.nameIdField ? p[cfg.nameIdField] : null) ?? name
    const region = cfg.region(p)
    if (!name) throw new Error(`${cfg.admin}: ${iso} tanpa nama.`)
    if (!region) throw new Error(`${cfg.admin}: ${name} (${iso}) belum punya region.`)

    return {
      type: 'Feature',
      properties: {
        id: iso,
        name,
        name_id: nameId,
        region,
        country: cfg.worldName ?? cfg.admin,
        iso_a2: iso.slice(0, 2),
      },
      geometry: simplifyGeometry(f.geometry, cfg.tolerance, cfg.minRingArea),
    }
  })

  features.sort((a, b) => a.properties.name.localeCompare(b.properties.name))

  const out = new URL(`${code}.geo.json`, OUT_DIR)
  writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', features }))

  const regions = [...new Set(features.map(f => f.properties.region))].sort()
  const bytes = readFileSync(out).length
  console.log(`${code}: ${features.length} wilayah, ${(bytes / 1024).toFixed(0)} KB · region (${regions.length}): ${regions.join(', ')}`)
}
