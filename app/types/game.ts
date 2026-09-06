import type { Feature, FeatureCollection, Geometry } from 'geojson'

/** Mode permainan. A = cari di peta, B = tebak nama dari outline. */
export type GameMode = 'A' | 'B'

/** Level data wilayah. MVP hanya 'world'; sisanya disiapkan untuk fase 2. */
export type RegionLevel = 'world' | 'country' | 'province'

/** Properti minimum yang wajib ada di tiap feature GeoJSON. */
export interface RegionProperties {
  name: string
  name_id: string
  iso_a2: string | null
  region: string
  subregion?: string
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
}

export type FeedbackKind = 'correct' | 'wrong' | 'timeout'

export interface Feedback {
  kind: FeedbackKind
  targetName: string
  targetIso?: string | null
  answerName: string | null
  points: number
}
