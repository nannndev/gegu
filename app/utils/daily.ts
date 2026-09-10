/**
 * Tantangan harian. Satu konfigurasi yang sama untuk semua pemain di hari
 * yang sama, diturunkan dari tanggal — jadi tidak butuh server sama sekali.
 */

/** PRNG deterministik (mulberry32) supaya undian harian bisa direproduksi. */
function rng(seed: number) {
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

function seedFrom(key: string): number {
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

const DONE_KEY = 'geoguess_daily_done'

interface DailyRecord {
  key: string
  score: number
  accuracy: number
}

export function dailyResult(key = todayKey()): DailyRecord | null {
  if (!import.meta.client) return null
  try {
    const raw = localStorage.getItem(DONE_KEY)
    if (!raw) return null
    const rec = JSON.parse(raw) as DailyRecord
    return rec.key === key ? rec : null
  }
  catch {
    return null
  }
}

export function saveDailyResult(rec: DailyRecord) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify(rec))
  }
  catch {}
}
