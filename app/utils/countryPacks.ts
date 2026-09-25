import type { Locale } from '~/composables/useI18n'
import type { ScopeProfile } from '~/utils/scopeProfile'

/**
 * "Paket negara": negara yang cukup dimainkan di satu tingkat wilayah
 * (provinsi / negara bagian / departemen) tanpa pemilih kota atau level.
 *
 * Italia & Jerman ditambahkan satu per satu, dan tiap negara berarti satu
 * cabang `if` baru di belasan tempat — label cakupan, bilah soal, bendera,
 * satuan, profil kamera, filter region, kunci rekor. Di sini semuanya
 * diturunkan dari satu entri, jadi negara kesebelas cukup satu baris data
 * plus satu entri di scripts/build-packs.mjs.
 *
 * Datanya dibangun oleh scripts/build-packs.mjs dari Natural Earth (domain
 * publik), satu file per negara di app/assets/data/packs/.
 */

export type PackScope =
  | 'fr-departments'
  | 'es-provinces'
  | 'cn-provinces'
  | 'in-states'
  | 'br-states'
  | 'ca-provinces'
  | 'au-states'
  | 'kr-provinces'
  | 'mx-states'
  | 'th-provinces'

export type PackKey =
  | 'france'
  | 'spain'
  | 'china'
  | 'india'
  | 'brazil'
  | 'canada'
  | 'australia'
  | 'korea'
  | 'mexico'
  | 'thailand'

interface PackText {
  /** Nama negara. */
  country: string
  /** Satuan jamak untuk "96 departemen". */
  unit: string
  /** Satuan tunggal untuk "Departemen mana yang disorot?". */
  unitOne: string
}

type PackProfile = Pick<ScopeProfile,
  'center' | 'zoom' | 'minZoom' | 'fitRegionMaxZoom' | 'nearMissKm'>

export interface CountryPack {
  key: PackKey
  scope: PackScope
  /** Nama file di app/assets/data/packs/, tanpa ekstensi. */
  file: string
  iso: string
  flag: string
  /** Warna chip cakupan; harus salah satu aksen yang ada di main.css. */
  accent: 'sky' | 'rose' | 'blue' | 'amber' | 'emerald' | 'red'
  /** Jumlah wilayah — penjaga yang sama dengan `expect` di skrip build. */
  count: number
  /** Nama negara di countries.geo.json, untuk backdrop daratan induk. */
  country: string
  profile: PackProfile
  text: Record<Locale, PackText>
}

/**
 * Urutan di sini = urutan chip di menu. `nearMissKm` sekelas jarak antar
 * wilayah bertetangga di negara itu, sama seperti profil negara lain —
 * departemen Prancis rapat (±70 km), provinsi Kanada ribuan km.
 */
export const COUNTRY_PACKS: CountryPack[] = [
  {
    key: 'france', scope: 'fr-departments', file: 'fr', iso: 'FR', flag: '🇫🇷', accent: 'blue', count: 96,
    country: 'France',
    profile: { center: [46.6, 2.5], zoom: 5, minZoom: 4, fitRegionMaxZoom: 9, nearMissKm: 120 },
    text: {
      id: { country: 'Prancis', unit: 'departemen', unitOne: 'departemen' },
      en: { country: 'France', unit: 'departments', unitOne: 'department' },
    },
  },
  {
    key: 'spain', scope: 'es-provinces', file: 'es', iso: 'ES', flag: '🇪🇸', accent: 'amber', count: 52,
    country: 'Spain',
    profile: { center: [40, -3.7], zoom: 5, minZoom: 4, fitRegionMaxZoom: 9, nearMissKm: 150 },
    text: {
      id: { country: 'Spanyol', unit: 'provinsi', unitOne: 'provinsi' },
      en: { country: 'Spain', unit: 'provinces', unitOne: 'province' },
    },
  },
  {
    key: 'china', scope: 'cn-provinces', file: 'cn', iso: 'CN', flag: '🇨🇳', accent: 'red', count: 31,
    country: 'People\'s Republic of China',
    profile: { center: [35, 104], zoom: 4, minZoom: 3, fitRegionMaxZoom: 7, nearMissKm: 700 },
    text: {
      id: { country: 'Tiongkok', unit: 'provinsi', unitOne: 'provinsi' },
      en: { country: 'China', unit: 'provinces', unitOne: 'province' },
    },
  },
  {
    key: 'india', scope: 'in-states', file: 'in', iso: 'IN', flag: '🇮🇳', accent: 'amber', count: 36,
    country: 'India',
    profile: { center: [22, 79], zoom: 4, minZoom: 3, fitRegionMaxZoom: 7, nearMissKm: 450 },
    text: {
      id: { country: 'India', unit: 'negara bagian & wilayah', unitOne: 'negara bagian' },
      en: { country: 'India', unit: 'states & territories', unitOne: 'state' },
    },
  },
  {
    key: 'brazil', scope: 'br-states', file: 'br', iso: 'BR', flag: '🇧🇷', accent: 'emerald', count: 27,
    country: 'Brazil',
    profile: { center: [-14, -52], zoom: 4, minZoom: 3, fitRegionMaxZoom: 7, nearMissKm: 600 },
    text: {
      id: { country: 'Brasil', unit: 'negara bagian', unitOne: 'negara bagian' },
      en: { country: 'Brazil', unit: 'states', unitOne: 'state' },
    },
  },
  {
    key: 'canada', scope: 'ca-provinces', file: 'ca', iso: 'CA', flag: '🇨🇦', accent: 'red', count: 13,
    country: 'Canada',
    profile: { center: [60, -96], zoom: 3, minZoom: 2, fitRegionMaxZoom: 6, nearMissKm: 1000 },
    text: {
      id: { country: 'Kanada', unit: 'provinsi & teritori', unitOne: 'provinsi' },
      en: { country: 'Canada', unit: 'provinces & territories', unitOne: 'province' },
    },
  },
  {
    key: 'australia', scope: 'au-states', file: 'au', iso: 'AU', flag: '🇦🇺', accent: 'sky', count: 8,
    country: 'Australia',
    profile: { center: [-26, 134], zoom: 4, minZoom: 3, fitRegionMaxZoom: 6, nearMissKm: 1000 },
    text: {
      id: { country: 'Australia', unit: 'negara bagian & teritori', unitOne: 'negara bagian' },
      en: { country: 'Australia', unit: 'states & territories', unitOne: 'state' },
    },
  },
  {
    key: 'korea', scope: 'kr-provinces', file: 'kr', iso: 'KR', flag: '🇰🇷', accent: 'sky', count: 17,
    country: 'South Korea',
    profile: { center: [36, 127.8], zoom: 6, minZoom: 5, fitRegionMaxZoom: 10, nearMissKm: 90 },
    text: {
      id: { country: 'Korea Selatan', unit: 'provinsi & kota', unitOne: 'provinsi' },
      en: { country: 'South Korea', unit: 'provinces & cities', unitOne: 'province' },
    },
  },
  {
    key: 'mexico', scope: 'mx-states', file: 'mx', iso: 'MX', flag: '🇲🇽', accent: 'emerald', count: 32,
    country: 'Mexico',
    profile: { center: [23.5, -102], zoom: 5, minZoom: 4, fitRegionMaxZoom: 8, nearMissKm: 300 },
    text: {
      id: { country: 'Meksiko', unit: 'negara bagian', unitOne: 'negara bagian' },
      en: { country: 'Mexico', unit: 'states', unitOne: 'state' },
    },
  },
  {
    key: 'thailand', scope: 'th-provinces', file: 'th', iso: 'TH', flag: '🇹🇭', accent: 'blue', count: 77,
    country: 'Thailand',
    profile: { center: [13, 101], zoom: 5, minZoom: 4, fitRegionMaxZoom: 9, nearMissKm: 110 },
    text: {
      id: { country: 'Thailand', unit: 'provinsi', unitOne: 'provinsi' },
      en: { country: 'Thailand', unit: 'provinces', unitOne: 'province' },
    },
  },
]

const BY_SCOPE = new Map<string, CountryPack>(COUNTRY_PACKS.map(p => [p.scope, p]))
const BY_KEY = new Map<string, CountryPack>(COUNTRY_PACKS.map(p => [p.key, p]))

/** Paket untuk sebuah scope; `undefined` kalau scope itu bukan paket negara. */
export function packForScope(scope: string): CountryPack | undefined {
  return BY_SCOPE.get(scope)
}

export function packForKey(key: string): CountryPack | undefined {
  return BY_KEY.get(key)
}

export function isPackScope(scope: string): scope is PackScope {
  return BY_SCOPE.has(scope)
}
