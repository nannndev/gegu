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
 * Evaluates game performance and assigns a cartographic tier in Indonesian,
 * matching the game's UI language.
 */
export function getPerformanceRank(accuracy: number, score: number) {
  if (accuracy >= 90 && score >= 120) {
    return {
      title: 'Kartografer Agung',
      badge: 'Tier 1 · Master',
      desc: 'Presisi geografis luar biasa — kamu hafal peta sampai ke detail kecil.',
      icon: '🏆',
      textColor: 'text-zinc-100',
    }
  }
  if (accuracy >= 75) {
    return {
      title: 'Navigator Global',
      badge: 'Tier 2 · Expert',
      desc: 'Orientasi spasial yang kuat lintas benua dan wilayah.',
      icon: '🌍',
      textColor: 'text-zinc-100',
    }
  }
  if (accuracy >= 50) {
    return {
      title: 'Penjelajah Dunia',
      badge: 'Tier 3 · Explorer',
      desc: 'Pemahaman peta yang solid, tinggal diasah biar makin tajam.',
      icon: '🧭',
      textColor: 'text-zinc-200',
    }
  }
  return {
    title: 'Kadet Penjelajah',
    badge: 'Tier 4 · Kadet',
    desc: 'Terus latihan, batas wilayah dunia makin hafal tiap main.',
    icon: '🗺️',
    textColor: 'text-zinc-300',
  }
}
