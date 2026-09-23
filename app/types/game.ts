import type { Feature, FeatureCollection, Geometry } from 'geojson'

/**
 * Mode permainan. A = cari di peta, B = tebak nama dari outline,
 * C = rantai jarak: tebak target, dikasih tahu seberapa jauh tebakannya.
 */
export type GameMode = 'A' | 'B' | 'C'

export type DatasetScope =
  | 'world'
  | 'id-provinces'
  | 'id-kabupaten'
  | 'id-kecamatan'
  | 'id-mixed'
  | 'us-states'
  | 'us-county'
  | 'my-states'
  | 'jp-prefectures'
  | 'it-provinces'
  | 'de-states'

/**
 * Tingkat kesulitan. `hardcore` melucuti semua petunjuk selain bentuk wilayah
 * itu sendiri: tetangga tidak digambar, kamera dikunci, waktunya dipotong,
 * dan label benua/bendera di bilah soal disembunyikan.
 */
export type Difficulty = 'normal' | 'hardcore'

/** Level data wilayah: world, country, province, district (kecamatan). */
export type RegionLevel = 'world' | 'country' | 'province' | 'district'

/** Properti minimum yang wajib ada di tiap feature GeoJSON. */
export interface RegionProperties {
  name: string
  name_id: string
  iso_a2: string | null
  region: string
  subregion?: string
  /** Ada di dataset kabupaten & kecamatan; dipakai untuk mewarnai backdrop peta. */
  country?: string
  /** State induk sebuah county; sejajar dengan `province` di dataset Indonesia. */
  state?: string
  /** Nama tanpa satuan ("Brooks" dari "Brooks County"); hanya di dataset US. */
  shortName?: string
  /** Singkatan state, mis. "TX". */
  abbr?: string
  /** Negeri vs wilayah persekutuan; hanya di dataset Malaysia. */
  kind?: 'state' | 'federal'
}

export type RegionFeature = Feature<Geometry, RegionProperties>
export type RegionCollection = FeatureCollection<Geometry, RegionProperties>

/** Satu wilayah yang sudah dinormalisasi untuk dipakai engine. */
export interface RegionItem {
  /** Kunci unik & stabil — dipakai untuk mencocokkan layer peta dengan jawaban. */
  id: string
  name: string
  nameId: string
  region: string
  iso?: string | null
  /**
   * Level administratif item ini. Hanya diisi di mode campuran, di mana satu
   * pool memuat provinsi, kabupaten, dan kecamatan sekaligus — peta perlu tahu
   * koleksi mana yang harus ditampilkan untuk ronde ini.
   */
  level?: RegionLevel
  /** Kota asal item kecamatan, supaya file-nya bisa dimuat ulang. */
  cityId?: string
  /** State asal item county, supaya file-nya bisa dimuat ulang. */
  stateId?: string
}

/** Satu tebakan di mode rantai jarak (C). */
export interface ChainGuess {
  item: RegionItem
  /** Jarak pusat wilayah yang ditebak ke target, km. */
  distanceKm: number
}

/** Hasil satu ronde, untuk hitung akurasi di result screen. */
export interface RoundResult {
  round: number
  targetId: string
  targetName: string
  targetIso?: string | null
  answerId: string | null
  answerName: string | null
  correct: boolean
  pointsEarned: number
  /** Jarak tebakan ke target, km. Hanya terisi di Mode A yang meleset. */
  distanceKm?: number
  /** Ronde ini dijawab setelah memakai petunjuk. */
  usedHint?: boolean
  /** Level target; dipakai layar hasil di mode campuran. */
  level?: RegionLevel
}

/**
 * `near` = meleset tapi masih dalam radius nyaris-kena, jadi dibayar
 * sebagian. Dipisah dari `wrong` supaya umpan baliknya bisa bilang
 * "hampir" alih-alih memperlakukannya sama dengan meleset jauh.
 */
export type FeedbackKind = 'correct' | 'near' | 'wrong' | 'timeout'

export interface Feedback {
  kind: FeedbackKind
  targetName: string
  targetIso?: string | null
  answerName: string | null
  points: number
  /** Jarak tebakan ke target, km; hanya di Mode A yang meleset. */
  distanceKm?: number
}
