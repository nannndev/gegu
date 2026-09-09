/**
 * Statistik pemain, disimpan di localStorage.
 *
 * Rekor dipecah per cakupan soal. Satu angka "skor tertinggi" global tidak
 * berarti apa-apa di game ini: sesi 8 kecamatan Jakarta Barat dan sesi 20
 * negara dunia menghasilkan skor di skala yang sama sekali berbeda, jadi
 * yang satu selalu menutupi yang lain.
 */

export interface ScopeStats {
  bestScore: number
  bestStreak: number
  bestAccuracy: number
  gamesPlayed: number
}

export interface StatsBlob {
  overall: ScopeStats
  byScope: Record<string, ScopeStats>
}

const KEY = 'geoguess_stats_v2'

/** Kunci lama dari versi pertama; dibaca sekali lalu ditinggalkan. */
const LEGACY_KEYS = {
  score: 'geoguess_best_score',
  streak: 'geoguess_best_streak',
  games: 'geoguess_games_played',
}

export function emptyStats(): ScopeStats {
  return { bestScore: 0, bestStreak: 0, bestAccuracy: 0, gamesPlayed: 0 }
}

function emptyBlob(): StatsBlob {
  return { overall: emptyStats(), byScope: {} }
}

function normalize(raw: unknown): ScopeStats {
  const r = (raw ?? {}) as Partial<ScopeStats>
  return {
    bestScore: Number(r.bestScore) || 0,
    bestStreak: Number(r.bestStreak) || 0,
    bestAccuracy: Number(r.bestAccuracy) || 0,
    gamesPlayed: Number(r.gamesPlayed) || 0,
  }
}

export function loadStats(): StatsBlob {
  if (!import.meta.client) return emptyBlob()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StatsBlob>
      const byScope: Record<string, ScopeStats> = {}
      for (const [k, v] of Object.entries(parsed.byScope ?? {})) {
        byScope[k] = normalize(v)
      }
      return { overall: normalize(parsed.overall), byScope }
    }

    // Migrasi dari kunci v1 supaya rekor lama tidak hilang.
    const legacy = normalize({
      bestScore: Number(localStorage.getItem(LEGACY_KEYS.score)) || 0,
      bestStreak: Number(localStorage.getItem(LEGACY_KEYS.streak)) || 0,
      gamesPlayed: Number(localStorage.getItem(LEGACY_KEYS.games)) || 0,
    })
    return { overall: legacy, byScope: {} }
  }
  catch {
    return emptyBlob()
  }
}

function save(blob: StatsBlob) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(KEY, JSON.stringify(blob))
  }
  catch {}
}

export interface SessionOutcome {
  scopeKey: string
  score: number
  bestStreak: number
  accuracy: number
}

function merge(prev: ScopeStats, s: SessionOutcome): ScopeStats {
  return {
    bestScore: Math.max(prev.bestScore, s.score),
    bestStreak: Math.max(prev.bestStreak, s.bestStreak),
    bestAccuracy: Math.max(prev.bestAccuracy, s.accuracy),
    gamesPlayed: prev.gamesPlayed + 1,
  }
}

/** Catat hasil satu sesi ke rekor global dan rekor cakupannya. */
export function recordSession(s: SessionOutcome): StatsBlob {
  const blob = loadStats()
  blob.overall = merge(blob.overall, s)
  blob.byScope[s.scopeKey] = merge(blob.byScope[s.scopeKey] ?? emptyStats(), s)
  save(blob)
  return blob
}

export function statsForScope(blob: StatsBlob, scopeKey: string): ScopeStats {
  return blob.byScope[scopeKey] ?? emptyStats()
}
