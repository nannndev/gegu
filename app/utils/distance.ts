/**
 * Jarak tebakan dan poin nyaris-kena (near miss).
 *
 * Tanpa ini Mode A cuma punya dua hasil: kena atau nol. Mengklik provinsi
 * tetangga dihargai sama dengan mengklik benua yang salah, padahal yang
 * pertama menunjukkan pemainnya tahu wilayahnya — cuma meleset sedikit.
 */

export interface LatLngLike {
  lat: number
  lng: number
}

const EARTH_RADIUS_KM = 6371

/** Jarak lingkaran besar antara dua titik, dalam kilometer. */
export function haversineKm(a: LatLngLike, b: LatLngLike): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h
    = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Porsi poin yang didapat dari tebakan sejauh `km`, antara 0 dan 1.
 *
 * Kurvanya dipangkatkan, bukan linier: pada peluruhan linier, meleset
 * setengah radius masih membayar 50% — cukup besar untuk membuat menembak
 * asal ke tengah-tengah peta jadi strategi yang masuk akal. Dengan pangkat
 * 1,8 tebakan setengah radius tinggal ±29%, jadi yang benar-benar dibayar
 * hanya tebakan yang memang dekat.
 */
export function nearMissFraction(km: number, limitKm: number): number {
  if (!Number.isFinite(km) || km < 0 || limitKm <= 0) return 0
  if (km >= limitKm) return 0
  return (1 - km / limitKm) ** 1.8
}

/**
 * Batas atas poin nyaris-kena, sebagai pecahan dari poin jawaban benar.
 *
 * Setengah, bukan penuh: tebakan yang meleset tetap harus kalah telak dari
 * tebakan yang kena, kalau tidak streak dan akurasi kehilangan artinya.
 */
export const NEAR_MISS_CEILING = 0.5

/**
 * Poin untuk tebakan yang meleset tapi masih dalam radius.
 * `0` berarti terlalu jauh — diperlakukan sebagai salah biasa.
 */
export function nearMissPoints(fullPoints: number, km: number, limitKm: number): number {
  const fraction = nearMissFraction(km, limitKm)
  if (fraction <= 0) return 0
  return Math.round(fullPoints * NEAR_MISS_CEILING * fraction)
}

/**
 * Jarak sebagai teks pendek. Satuannya sama di kedua bahasa; yang berbeda
 * cuma pemisah ribuan, jadi `locale` diteruskan ke `Intl` alih-alih menaruh
 * angka jadinya di kamus.
 */
export function formatDistance(km: number, locale: string): string {
  if (!Number.isFinite(km) || km < 0) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1).replace('.', locale === 'id' ? ',' : '.')} km`
  return `${new Intl.NumberFormat(locale).format(Math.round(km))} km`
}
