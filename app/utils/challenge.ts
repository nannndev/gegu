import type { PersistedSetup } from '~/composables/useGameSetup'

/**
 * Tautan tantangan: konfigurasi sesi, daftar target, dan seed opsi, dikemas
 * ke satu parameter URL. Tidak butuh server — penerima memuat file data yang
 * sama, memainkan target yang sama dengan urutan yang sama, dan seed-nya
 * menjamin opsi pilihan gandanya pun sama.
 *
 * Targetnya dibawa langsung, bukan diundi ulang dari seed: undian biasa
 * dibobot oleh riwayat penguasaan pemain, jadi dua orang dengan seed yang
 * sama tetap akan mendapat soal berbeda.
 */

export interface Challenge {
  setup: PersistedSetup
  seed: string
  targets: string[]
  /** Skor si pengirim, untuk ditampilkan sebagai target yang harus dikalahkan. */
  score?: number
}

export const CHALLENGE_PARAM = 'c'

/** Seed acak pendek; cukup unik untuk dibagikan antarteman. */
export function newSeed(): string {
  return Math.random().toString(36).slice(2, 10)
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)))
}

export function encodeChallenge(c: Challenge): string {
  return toBase64Url(JSON.stringify(c))
}

/** `null` untuk kode rusak — tautan bisa terpotong saat disalin di chat. */
export function decodeChallenge(code: string): Challenge | null {
  try {
    const c = JSON.parse(fromBase64Url(code)) as Partial<Challenge>
    if (!c || typeof c.seed !== 'string' || !c.seed || typeof c.setup !== 'object' || !c.setup) return null
    const targets = Array.isArray(c.targets) ? c.targets.filter((t): t is string => typeof t === 'string') : []
    if (!targets.length) return null
    return {
      setup: c.setup as PersistedSetup,
      seed: c.seed.slice(0, 32),
      targets: targets.slice(0, 50),
      score: typeof c.score === 'number' && c.score >= 0 ? Math.round(c.score) : undefined,
    }
  }
  catch {
    return null
  }
}

export function challengeUrl(c: Challenge): string {
  const url = new URL('/', window.location.origin)
  url.searchParams.set(CHALLENGE_PARAM, encodeChallenge(c))
  return url.toString()
}
