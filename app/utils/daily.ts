/**
 * Tantangan harian. Satu konfigurasi yang sama untuk semua pemain di hari
 * yang sama, diturunkan dari tanggal — jadi tidak butuh server sama sekali.
 */

/** PRNG deterministik (mulberry32) supaya undian harian bisa direproduksi. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Tanggal lokal sebagai `YYYY-MM-DD`; dipakai sebagai kunci hari. */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function seedFrom(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type DailyKind = 'world' | 'id-provinces' | 'id-kabupaten' | 'id-kecamatan'

export interface DailyChallenge {
  key: string
  kind: DailyKind
  mode: 'A' | 'B'
  rounds: number
  timer: boolean
}

/**
 * Racik tantangan hari ini. Levelnya diputar berdasarkan hari supaya seminggu
 * terasa bervariasi, sementara mode & timer diundi dari seed tanggal.
 */
export function dailyChallenge(key = todayKey()): DailyChallenge {
  const rand = rng(seedFrom(key))
  const kinds: DailyKind[] = ['world', 'id-provinces', 'id-kabupaten', 'id-kecamatan']
  const kind = kinds[Math.floor(rand() * kinds.length)] ?? 'world'
  const mode = rand() > 0.5 ? 'B' : 'A'
  const timer = rand() > 0.55
  const rounds = 10

  // Tanpa label teks: penamaan cakupan dirakit di UI supaya ikut bahasa aktif.
  return { key, kind, mode, rounds, timer }
}

/**
 * Riwayat tantangan harian: satu entri per tanggal.
 *
 * Versi pertama cuma menyimpan satu rekor (`geoguess_daily_done`) yang
 * ditimpa setiap hari — pemain yang sudah main 30 hari berturut-turut tidak
 * punya jejak apa pun. Riwayat ini yang membuat streak bisa dihitung.
 */
const HISTORY_KEY = 'geoguess_daily_history_v1'
/** Kunci lama; dibaca sekali saat migrasi supaya hari itu tidak hilang. */
const LEGACY_DONE_KEY = 'geoguess_daily_done'
/** Batas entri: setahun lebih sedikit sudah cukup untuk rekor streak mana pun yang realistis. */
const HISTORY_MAX = 400

export interface DailyRecord {
  key: string
  score: number
  accuracy: number
}

type DailyHistory = Record<string, { score: number, accuracy: number }>

function loadHistory(): DailyHistory {
  if (!import.meta.client) return {}
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const history: DailyHistory = raw ? JSON.parse(raw) : {}
    const legacy = localStorage.getItem(LEGACY_DONE_KEY)
    if (legacy) {
      const rec = JSON.parse(legacy) as DailyRecord
      if (rec?.key && !history[rec.key]) history[rec.key] = { score: rec.score, accuracy: rec.accuracy }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
      localStorage.removeItem(LEGACY_DONE_KEY)
    }
    return history
  }
  catch {
    return {}
  }
}

export function dailyResult(key = todayKey()): DailyRecord | null {
  const rec = loadHistory()[key]
  return rec ? { key, ...rec } : null
}

/**
 * Simpan hasil hari itu. "Coba lagi" di hari yang sama boleh, tapi yang
 * tersimpan skor terbaiknya — main ulang tidak boleh menurunkan hasil hari
 * yang sudah bagus.
 */
export function saveDailyResult(rec: DailyRecord) {
  if (!import.meta.client) return
  try {
    const history = loadHistory()
    const prev = history[rec.key]
    if (!prev || rec.score > prev.score) history[rec.key] = { score: rec.score, accuracy: rec.accuracy }
    const keys = Object.keys(history).sort()
    for (const old of keys.slice(0, Math.max(0, keys.length - HISTORY_MAX))) delete history[old]
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }
  catch {}
}

/** Kunci hari sebelumnya/sesudahnya, dihitung di kalender lokal. */
function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return todayKey(new Date(y!, m! - 1, d! + days))
}

export interface DailyDay {
  key: string
  played: boolean
  accuracy: number | null
  isToday: boolean
}

export interface DailyStreak {
  /** Hari berturut-turut sampai hari ini (atau kemarin, kalau hari ini belum main). */
  current: number
  best: number
  playedToday: boolean
  /** Streak masih hidup tapi hari ini belum dimainkan — besok sudah putus. */
  atRisk: boolean
  /** Tujuh hari terakhir, paling lama di kiri. */
  week: DailyDay[]
}

/**
 * Streak harian. Hari ini yang belum dimainkan tidak memutus streak — pemain
 * masih punya sisa hari untuk menyambungnya — jadi hitungannya mundur dari
 * kemarin dalam kasus itu.
 */
export function dailyStreak(today = todayKey()): DailyStreak {
  const history = loadHistory()
  const playedToday = Boolean(history[today])

  let current = 0
  for (let key = playedToday ? today : shiftKey(today, -1); history[key]; key = shiftKey(key, -1)) current++

  let best = 0
  let run = 0
  let prev: string | null = null
  for (const key of Object.keys(history).sort()) {
    run = prev && shiftKey(prev, 1) === key ? run + 1 : 1
    best = Math.max(best, run)
    prev = key
  }

  const week: DailyDay[] = []
  for (let i = 6; i >= 0; i--) {
    const key = shiftKey(today, -i)
    week.push({ key, played: Boolean(history[key]), accuracy: history[key]?.accuracy ?? null, isToday: i === 0 })
  }

  return { current, best, playedToday, atRisk: !playedToday && current > 0, week }
}
