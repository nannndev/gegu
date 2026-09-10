/**
 * Converts a 2-letter ISO country code (e.g., "ID", "US", "FR") to its Unicode flag emoji.
 */
export function isoToFlag(iso: string | null | undefined): string {
  if (!iso || iso.length !== 2) return ''
  try {
    const codePoints = [...iso.toUpperCase()].map(char => 127397 + char.charCodeAt(0))
    return String.fromCodePoint(...codePoints)
  }
  catch {
    return ''
  }
}

/**
 * Returns a clean shadcn badge styling config for continents.
 */
export function getRegionColor(region: string): { bg: string; text: string; border: string } {
  switch (region.toLowerCase()) {
    case 'europe':
      return { bg: 'bg-zinc-800', text: 'text-blue-400', border: 'border-zinc-700/60' }
    case 'asia':
      return { bg: 'bg-zinc-800', text: 'text-amber-400', border: 'border-zinc-700/60' }
    case 'africa':
      return { bg: 'bg-zinc-800', text: 'text-orange-400', border: 'border-zinc-700/60' }
    case 'americas':
    case 'north america':
    case 'south america':
      return { bg: 'bg-zinc-800', text: 'text-emerald-400', border: 'border-zinc-700/60' }
    case 'oceania':
      return { bg: 'bg-zinc-800', text: 'text-teal-400', border: 'border-zinc-700/60' }
    default:
      return { bg: 'bg-zinc-800', text: 'text-zinc-400', border: 'border-zinc-700/60' }
  }
}

/** Tingkatan performa; teksnya diambil dari kamus bahasa saat render. */
export type PerformanceTier = 'master' | 'expert' | 'explorer' | 'cadet'

/**
 * Evaluates game performance and assigns a cartographic tier.
 *
 * Returns a tier id plus its icon — never the copy itself, so the result
 * screen can render it in whichever language the player picked, even if they
 * switch after the session ends.
 */
export function getPerformanceRank(accuracy: number, score: number): {
  tier: PerformanceTier
  icon: string
  textColor: string
} {
  if (accuracy >= 90 && score >= 120) {
    return { tier: 'master', icon: '🏆', textColor: 'text-zinc-100' }
  }
  if (accuracy >= 75) {
    return { tier: 'expert', icon: '🌍', textColor: 'text-zinc-100' }
  }
  if (accuracy >= 50) {
    return { tier: 'explorer', icon: '🧭', textColor: 'text-zinc-200' }
  }
  return { tier: 'cadet', icon: '🗺️', textColor: 'text-zinc-300' }
}
