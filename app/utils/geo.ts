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

/**
 * Evaluates game performance and assigns a clean cartographic tier and description.
 */
export function getPerformanceRank(accuracy: number, score: number) {
  if (accuracy >= 90 && score >= 120) {
    return {
      title: 'Grand Cartographer',
      badge: 'Tier 1 • Master',
      desc: 'Exceptional geographic precision across global borders.',
      textColor: 'text-zinc-100',
    }
  }
  if (accuracy >= 75) {
    return {
      title: 'Global Navigator',
      badge: 'Tier 2 • Expert',
      desc: 'Strong spatial orientation across multiple continents.',
      textColor: 'text-zinc-100',
    }
  }
  if (accuracy >= 50) {
    return {
      title: 'World Explorer',
      badge: 'Tier 3 • Explorer',
      desc: 'Solid grasp of global territories with room to expand.',
      textColor: 'text-zinc-200',
    }
  }
  return {
    title: 'Apprentice Scout',
    badge: 'Tier 4 • Cadet',
    desc: 'Keep practicing to master sovereign nations and territories.',
    textColor: 'text-zinc-300',
  }
}
