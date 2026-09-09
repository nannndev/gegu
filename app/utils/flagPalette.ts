/**
 * Warna isian poligon negara di peta dunia, diambil dari warna dominan
 * bendera tiap negara. Dipakai hanya di mode vektor/cetak biru (tanpa ubin)
 * supaya peta dunia terasa hidup tanpa menutup citra di mode relief/satelit.
 *
 * Tiap warna dipilih agar masih nyaman di atas kanvas gelap: jenuh medium,
 * kecenderungan hangat, dan tidak menabrak aksen UI (brass/paper/seal/moss).
 * Negara tanpa padanan memakai fallback dari tema.
 */

export interface FlagFill {
  fill: string
  /** Warna garis luar tipis — default netral abu hangat. */
  border?: string
}

/** Warna garis luar default agar poligon tetap kebaca di antara fill bendera. */
export const FLAG_BORDER = 'rgba(20, 17, 11, 0.5)'

export const FLAG_FILLS: Record<string, FlagFill> = {
  // ── Asia Tenggara & sekitarnya ─────────────────────────────
  ID: { fill: '#a83232' }, // merah-putih
  MY: { fill: '#2b4a8c' }, // biru dengan bulan-bintang
  SG: { fill: '#c0392b' }, // merah-putih
  TH: { fill: '#9b2d3f' }, // merah-putih-biru
  VN: { fill: '#c72b2b' }, // merah bintang kuning
  PH: { fill: '#1f4e9c' }, // biru-merah
  MM: { fill: '#2e8b57' }, // hijau-kuning-merah
  KH: { fill: '#b3202c' }, // merah dengan angkor
  LA: { fill: '#b3202c' }, // merah-biru
  BN: { fill: '#f0c21e' }, // kuning hitam
  TL: { fill: '#c8102e' }, // merah-hitam

  // ── Asia Timur & Selatan ───────────────────────────────────
  CN: { fill: '#b02a2a' }, // merah bintang kuning
  JP: { fill: '#d8d2c2', border: '#c0392b' }, // putih dengan matahari merah
  KR: { fill: '#e8e0cc' }, // putih dengan taegeuk
  KP: { fill: '#2e5aa8' }, // biru-merah
  TW: { fill: '#c0392b' }, // merah dengan sudut biru
  MN: { fill: '#b23a3a' }, // merah-biru
  IN: { fill: '#e08a3c' }, // saffron-putih-hijau
  PK: { fill: '#2c5f2d' }, // hijau-putih
  BD: { fill: '#1f7a3d' }, // hijau-merah
  NP: { fill: '#a42d4c' }, // merah-biru
  LK: { fill: '#7b4a2d' }, // kuning-maroon
  AF: { fill: '#3a3a3a' }, // hitam-merah-hijau
  IR: { fill: '#3a9c4f' }, // hijau-putih-merah
  IQ: { fill: '#9c9c9c' }, // merah-putih-hitam
  IL: { fill: '#e8e0d0' }, // putih biru
  JO: { fill: '#2e3f27' }, // hitam-putih-hijau
  KW: { fill: '#2e3f27' }, // hitam-hijau
  SA: { fill: '#2b6e35' }, // hijau-putih
  YE: { fill: '#8a2f1d' }, // merah-putih-hitam
  SY: { fill: '#2e3f27' }, // merah-putih-hitam
  LB: { fill: '#2b6e35' }, // hijau-merah
  AE: { fill: '#2b6e35' }, // hijau-putih-hitam
  QA: { fill: '#8a4a3a' }, // maroon-putih
  BH: { fill: '#c0392b' }, // merah-putih
  OM: { fill: '#2b6e35' }, // hijau-putih-merah
  GE: { fill: '#e8e0d0' }, // putih dengan salib merah
  AM: { fill: '#c03a2b' }, // merah-biru-oranye
  AZ: { fill: '#2e5aa8' }, // biru-merah-hijau
  KZ: { fill: '#3b9ad9' }, // biru muda
  UZ: { fill: '#2e9ad9' }, // biru-putih-hijau
  TM: { fill: '#2b8a5a' }, // hijau
  KG: { fill: '#c0392b' }, // merah-kuning
  TJ: { fill: '#2b6e35' }, // hijau-putih-merah
  // ── Eropa ──────────────────────────────────────────────────
  GB: { fill: '#2b4a8c' }, // union jack
  FR: { fill: '#2e4f9e' }, // biru-putih-merah
  DE: { fill: '#4a4a48' }, // hitam-merah-emas
  IT: { fill: '#2e8b57' }, // hijau-putih-merah
  ES: { fill: '#c0352c' }, // merah-kuning
  PT: { fill: '#1f7a3d' }, // hijau-merah
  NL: { fill: '#c0392b' }, // merah-putih-biru
  BE: { fill: '#2e3f27' }, // hitam-kuning-merah
  LU: { fill: '#c0392b' }, // merah-putih-biru
  CH: { fill: '#c0392b' }, // merah-putih
  AT: { fill: '#c0392b' }, // merah-putih
  DK: { fill: '#c0352c' }, // merah-putih
  SE: { fill: '#2e5aa8' }, // biru-kuning
  NO: { fill: '#b0322c' }, // merah-putih-biru
  FI: { fill: '#e8e0d0' }, // putih-biru
  IS: { fill: '#2e5aa8' }, // biru-merah
  IE: { fill: '#2e8b57' }, // hijau-putih-oranye
  PL: { fill: '#e8e0d0' }, // putih-merah
  CZ: { fill: '#2e4f9e' }, // biru-putih-merah
  SK: { fill: '#c0392b' }, // putih-biru-merah
  HU: { fill: '#2e6e3f' }, // merah-putih-hijau
  SI: { fill: '#2e4f9e' }, // biru-putih-merah
  HR: { fill: '#c0392b' }, // merah-putih-biru
  BA: { fill: '#2e4f9e' }, // biru-kuning
  RS: { fill: '#c0392b' }, // merah-biru
  ME: { fill: '#c0392b' }, // merah-kuning
  MK: { fill: '#c0392b' }, // merah-kuning
  AL: { fill: '#c0392b' }, // merah-elang
  GR: { fill: '#3b6dd4' }, // biru-putih
  BG: { fill: '#2b6e35' }, // putih-hijau-merah
  RO: { fill: '#2e4f9e' }, // biru-kuning-merah
  MD: { fill: '#2e4f9e' }, // biru-kuning-merah
  UA: { fill: '#3b9ad9' }, // biru-kuning
  BY: { fill: '#c0392b' }, // merah-hijau
  RU: { fill: '#b03a3a' }, // putih-biru-merah
  EE: { fill: '#2e4f9e' }, // biru-hitam-putih
  LV: { fill: '#8a1f2d' }, // merah-putih
  LT: { fill: '#c9a24b' }, // kuning-hijau-merah
  // ── Timur Tengah / Kaukasus ────────────────────────────────
  TR: { fill: '#b02a2a' }, // merah-bulan bintang
  CY: { fill: '#e8e0d0' }, // putih-oranye

  // ── Afrika ─────────────────────────────────────────────────
  EG: { fill: '#2e2e2e' }, // hitam-putih-merah
  LY: { fill: '#2b6e35' }, // hijau
  TN: { fill: '#c0392b' }, // merah-putih
  DZ: { fill: '#2e8b57' }, // hijau-putih-merah
  MA: { fill: '#a83232' }, // merah-bintang hijau
  EH: { fill: '#2e3f27' }, // hitam-putih-hijau
  MR: { fill: '#2e8b57' }, // hijau-kuning-merah
  ML: { fill: '#c9a24b' }, // hijau-kuning-merah
  NE: { fill: '#e08a3c' }, // oranye-putih-hijau
  TD: { fill: '#2e4f9e' }, // biru-kuning-merah
  SD: { fill: '#2e3f27' }, // hitam-merah-hijau
  SS: { fill: '#2e3f27' }, // hitam-merah-hijau
  ET: { fill: '#2e8b57' }, // hijau-kuning-merah
  ER: { fill: '#2e8b57' }, // hijau-biru-merah
  DJ: { fill: '#3b9ad9' }, // biru-hijau-putih
  SO: { fill: '#3b9ad9' }, // biru-bintang putih
  KE: { fill: '#2e3f27' }, // hitam-merah-hijau
  UG: { fill: '#c9a24b' }, // kuning-hitam-merah
  TZ: { fill: '#2e8b57' }, // hijau-kuning-biru
  RW: { fill: '#3b9ad9' }, // biru-kuning-hijau
  BI: { fill: '#c0392b' }, // merah-hijau
  CM: { fill: '#2e8b57' }, // hijau-merah-kuning
  NG: { fill: '#2e8b57' }, // hijau-putih
  BF: { fill: '#2e6e3f' }, // merah-hijau
  GH: { fill: '#c0392b' }, // merah-kuning-hijau
  CI: { fill: '#e08a3c' }, // oranye-putih-hijau
  TG: { fill: '#2e8b57' }, // hijau-kuning-merah
  BJ: { fill: '#2e8b57' }, // hijau-kuning-merah
  SN: { fill: '#2e8b57' }, // hijau-kuning-merah
  GM: { fill: '#c0392b' }, // merah-biru-hijau
  GW: { fill: '#c9a24b' }, // kuning-hijau-merah
  GN: { fill: '#c0392b' }, // merah-kuning-hijau
  SL: { fill: '#2e8b57' }, // hijau-putih-biru
  LR: { fill: '#c0392b' }, // merah-putih-biru
  CF: { fill: '#2e4f9e' }, // biru-putih-hijau-kuning-merah
  GA: { fill: '#2e8b57' }, // hijau-kuning-biru
  CG: { fill: '#c9a24b' }, // kuning-hijau-merah
  CD: { fill: '#3b9ad9' }, // biru-kuning-merah
  AO: { fill: '#2e3f27' }, // hitam-merah-kuning
  ZM: { fill: '#2e8b57' }, // hijau-merah-hitam
  ZW: { fill: '#2e8b57' }, // hijau-kuning-merah
  MZ: { fill: '#2e3f27' }, // hitam-kuning-hijau
  MW: { fill: '#2e3f27' }, // hitam-merah-hijau
  ZA: { fill: '#2e8b57' }, // hijau-kuning-biru
  NA: { fill: '#2e4f9e' }, // biru-hijau-merah
  BW: { fill: '#3b9ad9' }, // biru-putih-hitam
  LS: { fill: '#2e4f9e' }, // biru-putih-hijau
  SZ: { fill: '#2e4f9e' }, // biru-kuning
  MG: { fill: '#2b6e35' }, // hijau-putih-merah
  KM: { fill: '#c9a24b' }, // kuning-putih-merah-biru
  SC: { fill: '#2e4f9e' }, // biru-kuning-merah
  MU: { fill: '#c0392b' }, // merah-biru-kuning-hijau

  // ── Amerika ────────────────────────────────────────────────
  US: { fill: '#2b4a8c' }, // biru-merah
  CA: { fill: '#c0392b' }, // merah-putih
  MX: { fill: '#2e8b57' }, // hijau-putih-merah
  GT: { fill: '#3b9ad9' }, // biru-putih
  BZ: { fill: '#c0392b' }, // merah-biru
  HN: { fill: '#3b9ad9' }, // biru-putih
  SV: { fill: '#2e4f9e' }, // biru-putih
  NI: { fill: '#3b9ad9' }, // biru-putih
  CR: { fill: '#2e4f9e' }, // biru-putih-merah
  PA: { fill: '#c0392b' }, // merah-putih-biru
  CU: { fill: '#2e4f9e' }, // biru-putih-merah
  HT: { fill: '#2e4f9e' }, // biru-merah
  DO: { fill: '#2e4f9e' }, // biru-merah-putih
  JM: { fill: '#2e8b57' }, // hijau-kuning-hitam
  TT: { fill: '#c0392b' }, // merah-putih-hitam
  CO: { fill: '#c9a24b' }, // kuning-biru-merah
  VE: { fill: '#c9a24b' }, // kuning-biru-merah
  EC: { fill: '#c9a24b' }, // kuning-biru-merah
  PE: { fill: '#c0392b' }, // merah-putih
  BO: { fill: '#c0392b' }, // merah-kuning-hijau
  PY: { fill: '#c0392b' }, // merah-putih-biru
  BR: { fill: '#2e8b57' }, // hijau-kuning
  GY: { fill: '#2e8b57' }, // hijau-kuning-merah
  SR: { fill: '#2e8b57' }, // hijau-putih-merah
  UY: { fill: '#3b9ad9' }, // biru-putih-kuning
  AR: { fill: '#7db3e6' }, // biru muda-kuning
  CL: { fill: '#c0392b' }, // merah-putih-biru
  // Karibia & lainnya
  BS: { fill: '#3b9ad9' }, // biru-kuning-hitam
  BB: { fill: '#c9a24b' }, // kuning-hitam
  GD: { fill: '#c0392b' }, // merah-kuning-hijau
  // Oseania
  AU: { fill: '#2b4a8c' }, // biru union jack
  NZ: { fill: '#2b4a8c' }, // biru union jack
  FJ: { fill: '#3b9ad9' }, // biru
  PG: { fill: '#2e3f27' }, // hitam-merah-kuning
  SB: { fill: '#2e4f9e' }, // biru-hijau-kuning
  VU: { fill: '#2e3f27' }, // hitam-kuning-hijau
  NC: { fill: '#c0392b' }, // merah-biru-kuning
  // Lainnya / wilayah
  BT: { fill: '#c9a24b' }, // kuning-oranye, naga putih
  GQ: { fill: '#2e8b57' }, // hijau-putih-merah
  GL: { fill: '#e8e0d0' }, // putih-merah
  FK: { fill: '#2b4a8c' },
  PR: { fill: '#c0392b' }, // merah-putih-biru
  PS: { fill: '#2e3f27' },
  XK: { fill: '#2e4f9e' },
}

/** Isi warna bendera untuk kode ISO; null kalau tidak dikenal. */
export function flagFillFor(iso: string | null | undefined): FlagFill | null {
  if (!iso) return null
  return FLAG_FILLS[iso.toUpperCase()] ?? null
}
