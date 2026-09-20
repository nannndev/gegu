/**
 * Petunjuk berbayar.
 *
 * Jatahnya dibatasi per sesi, bukan per ronde: petunjuk yang selalu tersedia
 * berhenti jadi keputusan — pemain tinggal menekannya tiap ronde dan soalnya
 * berubah jadi latihan mengklik. Dengan jatah sesi, memakai satu di ronde
 * mudah berarti tidak punya cadangan saat ronde sulit datang.
 */

import type { Difficulty, GameMode } from '~/types/game'

import type { RegionItem } from '~/types/game'

/** Jenis petunjuk; yang tersedia berbeda per mode. */
export type HintKind = 'fifty' | 'region'

/**
 * Wilayah yang tetap menyala setelah petunjuk Mode A dipakai; sisanya
 * diredupkan peta.
 *
 * Penyempitannya dipilih menurut bentuk pool, bukan selalu lewat region.
 * Di cakupan satu kota, `region` tiap kecamatan adalah kotanya sendiri —
 * seluruh pool punya nilai yang sama, jadi menyaring dengannya tidak
 * membuang apa pun dan petunjuknya terasa tidak berfungsi. Di cakupan
 * dunia sebaliknya: "benuanya Afrika" adalah penyempitan yang nyata dan
 * jauh lebih mendidik daripada membuang separuh negara secara acak.
 */
export function spotlightFor(target: RegionItem, pool: RegionItem[]): string[] {
  const sameRegion = pool.filter(i => i.region === target.region)

  // Region berguna hanya kalau benar-benar memangkas. Ambangnya 70%:
  // menyisakan hampir seluruh pool bukan petunjuk, itu cuma jeda.
  if (sameRegion.length > 1 && sameRegion.length <= pool.length * 0.7) {
    return sameRegion.map(i => i.id)
  }

  // Jatuh ke pemangkasan separuh, sejajar dengan 50:50 di Mode B.
  const others = pool.filter(i => i.id !== target.id)
  const keep = Math.max(1, Math.floor(others.length / 2))
  const shuffled = [...others]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  return [target.id, ...shuffled.slice(0, keep).map(i => i.id)]
}

/** Jatah petunjuk satu sesi, menurut panjang sesinya. */
export function hintBudget(rounds: number, difficulty: Difficulty): number {
  // Hardcore tidak dapat petunjuk sama sekali: seluruh mode itu ada untuk
  // melucuti petunjuk, jadi menjualnya kembali membatalkan maksudnya.
  if (difficulty === 'hardcore') return 0
  if (rounds <= 5) return 1
  if (rounds <= 10) return 2
  return 3
}

/** Petunjuk yang berlaku di sebuah mode. */
export function hintKindFor(mode: GameMode): HintKind {
  // Mode B punya empat opsi, jadi 50:50 membuang dua yang salah. Mode A
  // tidak punya opsi sama sekali — yang bisa dipersempit cuma petanya.
  return mode === 'B' ? 'fifty' : 'region'
}

/**
 * Potongan poin saat ronde diselesaikan dengan bantuan petunjuk.
 *
 * Setengah, bukan nol: kalau petunjuk menihilkan poin, memakainya jadi sama
 * saja dengan menyerah, dan tidak ada yang menyentuhnya. Setengah membuatnya
 * pilihan yang masuk akal saat buntu, tapi tetap kalah dari menjawab bersih.
 */
export const HINT_PENALTY = 0.5

export function applyHintPenalty(points: number): number {
  return Math.round(points * HINT_PENALTY)
}
