import type { DatasetScope } from '~/types/game'

/**
 * Profil per cakupan soal: satu tempat untuk semua yang dulu tersebar sebagai
 * cabang `if (isIdScope) … else …` di logika peta.
 *
 * Sebelum ini, Indonesia hardcode di belasan titik (`ID_SCOPES`, center
 * `[-2.2, 118]`, maxZoom per scope). Menambah negara kedua dengan pola itu
 * berarti menambah `isUsScope` di setiap titik yang sama, dan negara ketiga
 * melipatgandakannya lagi. Di sini negara baru cukup menambah satu entri.
 */
export interface ScopeProfile {
  /** Negara induk; `null` untuk cakupan dunia. */
  country: string | null
  /** Kamera awal & batas zoom saat scope ini aktif. */
  center: [number, number]
  zoom: number
  minZoom: number
  maxZoom: number
  /**
   * Koleksi aktif hanya menutupi sebagian kecil negara (mis. kecamatan satu
   * kota, county satu state), jadi kamera difit ke koleksi dan wilayah di luar
   * pool digambar sebagai konteks yang tidak bisa diklik.
   */
  local: boolean
  /** Butuh daratan negara induk sebagai backdrop beresolusi tinggi. */
  countryBackdrop: boolean
  /** Batas zoom saat memfokus satu wilayah (Mode B) dan saat fit ke pool. */
  fitRegionMaxZoom: number
  fitPoolMaxZoom: number
}

const WORLD: ScopeProfile = {
  country: null,
  center: [20, 0],
  zoom: 2,
  minZoom: 1.8,
  maxZoom: 7,
  local: false,
  countryBackdrop: false,
  fitRegionMaxZoom: 5,
  fitPoolMaxZoom: 12,
}

/** Kamera default Indonesia: seluruh kepulauan terlihat pada zoom 5. */
const ID_BASE = { country: 'Indonesia', center: [-2.2, 118] as [number, number], zoom: 5, minZoom: 3.5 }

/**
 * Kamera default AS: pusatnya digeser ke daratan utama, bukan titik tengah
 * geometris — Alaska & Hawaii menarik titik tengah jauh ke barat laut sampai
 * peta awal memperlihatkan Pasifik, bukan negaranya.
 */
const US_BASE = { country: 'United States of America', center: [39.5, -98] as [number, number], zoom: 4, minZoom: 2.5 }

const PROFILES: Record<DatasetScope, ScopeProfile> = {
  'world': WORLD,

  'id-provinces': {
    ...ID_BASE,
    maxZoom: 10,
    local: false,
    countryBackdrop: false,
    fitRegionMaxZoom: 8,
    fitPoolMaxZoom: 12,
  },
  'id-kabupaten': {
    ...ID_BASE,
    maxZoom: 16,
    local: true,
    countryBackdrop: false,
    fitRegionMaxZoom: 12,
    fitPoolMaxZoom: 12,
  },
  'id-kecamatan': {
    ...ID_BASE,
    maxZoom: 16,
    local: true,
    // Kecamatan satu kota hanya seujung Indonesia; tanpa backdrop kabupaten,
    // peta di luar kota tampak kosong.
    countryBackdrop: true,
    fitRegionMaxZoom: 14,
    fitPoolMaxZoom: 13,
  },
  'id-mixed': {
    ...ID_BASE,
    maxZoom: 16,
    local: false,
    countryBackdrop: false,
    fitRegionMaxZoom: 12,
    fitPoolMaxZoom: 12,
  },

  'us-states': {
    ...US_BASE,
    maxZoom: 10,
    local: false,
    countryBackdrop: false,
    fitRegionMaxZoom: 7,
    fitPoolMaxZoom: 10,
  },
  'us-county': {
    ...US_BASE,
    maxZoom: 16,
    local: true,
    countryBackdrop: true,
    // County satu state jauh lebih luas daripada kecamatan satu kota, jadi
    // zoom maksimumnya lebih rendah.
    fitRegionMaxZoom: 11,
    fitPoolMaxZoom: 11,
  },
}

export function scopeProfile(scope: string): ScopeProfile {
  return PROFILES[scope as DatasetScope] ?? WORLD
}

/** Nama negara induk sebuah scope; `null` di cakupan dunia. */
export function scopeCountry(scope: string): string | null {
  return scopeProfile(scope).country
}
