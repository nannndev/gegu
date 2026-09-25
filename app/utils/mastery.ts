import type { DatasetScope, RegionItem, RoundResult } from '~/types/game'

/**
 * Penguasaan per wilayah, disimpan di localStorage.
 *
 * Rekor sesi cuma bilang "seberapa bagus sesi terbaikmu"; ini yang bilang
 * wilayah mana yang sudah benar-benar hafal. Satu wilayah dianggap dikuasai
 * setelah dijawab benar dua kali berturut-turut tanpa petunjuk — sekali benar
 * bisa kebetulan, dua kali jarang.
 */

export interface RegionMastery {
  seen: number
  correct: number
  /** Benar berturut-turut tanpa petunjuk; salah mengembalikannya ke nol. */
  run: number
}

type MasteryBlob = Record<string, Record<string, RegionMastery>>

const KEY = 'geoguess_mastery_v1'
export const MASTERY_RUN = 2

/**
 * Kunci penyimpanan. Id wilayah unik di dalam satu dataset, jadi penguasaan
 * dikelompokkan per dataset — bukan per `scopeKey`, supaya kabupaten yang
 * dihafal lewat filter satu provinsi tetap terhitung saat main se-Indonesia.
 */
export function masteryBucket(scope: DatasetScope, level?: RoundResult['level']): string {
  if (scope !== 'id-mixed') return scope
  if (level === 'district') return 'id-kecamatan'
  if (level === 'country') return 'id-kabupaten'
  return 'id-provinces'
}

function load(): MasteryBlob {
  if (!import.meta.client) return {}
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as MasteryBlob) : {}
  }
  catch {
    return {}
  }
}

function save(blob: MasteryBlob) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(KEY, JSON.stringify(blob))
  }
  catch {}
}

export function isMastered(m?: RegionMastery): boolean {
  return (m?.run ?? 0) >= MASTERY_RUN
}

/**
 * Catat hasil satu sesi. Mengembalikan banyak wilayah yang baru dikuasai di
 * sesi ini, untuk dirayakan di layar hasil.
 */
export function recordMastery(scope: DatasetScope, history: RoundResult[]): number {
  const blob = load()
  let newlyMastered = 0
  for (const row of history) {
    const bucket = (blob[masteryBucket(scope, row.level)] ??= {})
    const prev = bucket[row.targetId] ?? { seen: 0, correct: 0, run: 0 }
    const wasMastered = isMastered(prev)
    const next: RegionMastery = {
      seen: prev.seen + 1,
      correct: prev.correct + (row.correct ? 1 : 0),
      // Benar berbantuan petunjuk tidak menambah run, tapi juga tidak
      // menghapusnya — pemain tetap menemukan jawabannya sendiri.
      run: row.correct ? (row.usedHint ? prev.run : prev.run + 1) : 0,
    }
    bucket[row.targetId] = next
    if (!wasMastered && isMastered(next)) newlyMastered++
  }
  save(blob)
  return newlyMastered
}

export interface MasterySummary {
  mastered: number
  learning: number
  total: number
}

/** Ringkasan penguasaan untuk sekumpulan wilayah di satu dataset. */
export function masterySummary(scope: DatasetScope, items: RegionItem[]): MasterySummary {
  const bucket = load()[scope] ?? {}
  let mastered = 0
  let learning = 0
  for (const item of items) {
    const m = bucket[item.id]
    if (isMastered(m)) mastered++
    else if (m?.seen) learning++
  }
  return { mastered, learning, total: items.length }
}

/**
 * Bobot undian per wilayah: yang pernah salah keluar paling sering, yang
 * belum pernah muncul berikutnya, yang sudah dikuasai paling jarang. Tetap
 * bukan nol, supaya wilayah yang sudah hafal masih sesekali diuji ulang.
 */
export function masteryWeights(scope: DatasetScope, items: RegionItem[]): Map<string, number> {
  const blob = load()
  const weights = new Map<string, number>()
  for (const item of items) {
    const m = blob[masteryBucket(scope, item.level)]?.[item.id]
    weights.set(item.id, !m ? 2 : isMastered(m) ? 1 : 3)
  }
  return weights
}

/**
 * Wilayah yang terakhir kali dijawab salah (run kembali ke nol). Yang sudah
 * sekali benar tidak ikut — ia sedang di jalur dikuasai, bukan "masih
 * meleset". Urut dari yang paling sering meleset, jadi latihan pendek pun
 * menyentuh yang paling bermasalah lebih dulu.
 *
 * Id dideduplikasi: beberapa dataset (mis. provinsi pemekaran Papua) punya
 * fitur yang berbagi id, dan tanpa ini satu wilayah bisa terhitung dua kali.
 */
export function weakItems(scope: DatasetScope, items: RegionItem[]): RegionItem[] {
  const bucket = load()[scope] ?? {}
  const seen = new Set<string>()
  return items
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      const m = bucket[item.id]
      return Boolean(m?.seen) && m!.run === 0 && m!.correct < m!.seen
    })
    .map(item => ({ item, misses: bucket[item.id]!.seen - bucket[item.id]!.correct }))
    .sort((a, b) => b.misses - a.misses)
    .map(({ item }) => item)
}

export type MasteryStatus = 'mastered' | 'learning' | 'new'

/** Status satu wilayah, untuk label di mode belajar. */
export function masteryStatus(scope: DatasetScope, id: string): MasteryStatus {
  const m = load()[scope]?.[id]
  if (isMastered(m)) return 'mastered'
  return m?.seen ? 'learning' : 'new'
}
