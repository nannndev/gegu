/**
 * Penanda "panduan sudah dilihat". Cukup satu bendera: panduannya pendek dan
 * selalu bisa dibuka lagi dari tombol "Cara main", jadi tidak perlu melacak
 * langkah mana yang sudah dibaca.
 */
const KEY = 'geoguess_onboarded_v1'

export function isOnboarded(): boolean {
  if (!import.meta.client) return true
  try {
    return localStorage.getItem(KEY) === '1'
  }
  catch {
    return true
  }
}

export function markOnboarded() {
  try {
    localStorage.setItem(KEY, '1')
  }
  catch {
    // Mode privat / penyimpanan penuh: panduan akan muncul lagi, tidak apa-apa.
  }
}
