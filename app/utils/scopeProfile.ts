import type { DatasetScope } from '~/types/game'
import { type CountryPack, type PackScope, packForScope } from '~/utils/countryPacks'

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
  /**
   * Radius poin nyaris-kena, dalam kilometer: sejauh mana tebakan Mode A
   * masih dianggap "hampir" dan dibayar sebagian.
   *
   * Nilainya harus sekelas jarak antar wilayah tetangga di cakupan itu,
   * bukan satu angka global. 200 km di peta dunia berarti negara sebelah;
   * di peta kecamatan Jakarta itu menjangkau seluruh Jawa Barat, jadi
   * mengklik asal di mana pun selalu dibayar.
   */
  nearMissKm: number
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
  // Sekelas "negara tetangga di benua yang sama".
  nearMissKm: 1500,
}

/** Kamera default Indonesia: seluruh kepulauan terlihat pada zoom 5. */
const ID_BASE = { country: 'Indonesia', center: [-2.2, 118] as [number, number], zoom: 5, minZoom: 3.5 }

/**
 * Kamera default AS: pusatnya digeser ke daratan utama, bukan titik tengah
 * geometris — Alaska & Hawaii menarik titik tengah jauh ke barat laut sampai
 * peta awal memperlihatkan Pasifik, bukan negaranya.
 */
const US_BASE = { country: 'United States of America', center: [39.5, -98] as [number, number], zoom: 4, minZoom: 2.5 }

/**
 * Kamera default Malaysia. Semenanjung dan Borneo terpisah ±600 km Laut China
 * Selatan, jadi pusatnya diletakkan di laut di antara keduanya — memusatkan ke
 * salah satu daratan membuat separuh negaranya keluar layar pada zoom awal.
 */
const MY_BASE = { country: 'Malaysia', center: [3.5, 109.5] as [number, number], zoom: 5, minZoom: 4 }

/**
 * Kamera default Jepang. Kepulauannya memanjang ±3.000 km dari Hokkaido ke
 * Okinawa, jadi seperti Malaysia kameranya difit ke isi koleksi (`local`),
 * bukan dipasang tetap — nilai ini cuma jadi titik awal sebelum fit.
 */
const JP_BASE = { country: 'Japan', center: [37.5, 138] as [number, number], zoom: 5, minZoom: 3.5 }

/** Kamera default Italia: seluruh semenanjung plus Sisilia & Sardinia. */
const IT_BASE = { country: 'Italy', center: [42.5, 12.5] as [number, number], zoom: 5, minZoom: 4 }

/**
 * Kamera default Jerman. Negaranya kompak, jadi nilai ini cuma titik awal —
 * seperti Italia, kameranya difit ke isi koleksi (`local`) saat peta dimuat.
 */
const DE_BASE = { country: 'Germany', center: [51.1, 10.4] as [number, number], zoom: 5, minZoom: 4 }

const PROFILES: Record<Exclude<DatasetScope, PackScope>, ScopeProfile> = {
  'world': WORLD,

  'id-provinces': {
    ...ID_BASE,
    maxZoom: 10,
    local: false,
    countryBackdrop: false,
    fitRegionMaxZoom: 8,
    fitPoolMaxZoom: 12,
    // Provinsi tetangga di pulau yang sama.
    nearMissKm: 400,
  },
  'id-kabupaten': {
    ...ID_BASE,
    maxZoom: 16,
    local: true,
    countryBackdrop: false,
    fitRegionMaxZoom: 12,
    fitPoolMaxZoom: 12,
    nearMissKm: 120,
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
    // Kecamatan sebelah; di kota padat jaraknya cuma beberapa kilometer.
    nearMissKm: 15,
  },
  'id-mixed': {
    ...ID_BASE,
    maxZoom: 16,
    local: false,
    countryBackdrop: false,
    fitRegionMaxZoom: 12,
    fitPoolMaxZoom: 12,
    // Pool-nya lintas tingkat, jadi radiusnya diambil di tengah-tengah.
    nearMissKm: 150,
  },

  'us-states': {
    ...US_BASE,
    maxZoom: 10,
    local: false,
    countryBackdrop: false,
    fitRegionMaxZoom: 7,
    fitPoolMaxZoom: 10,
    // State tetangga; AS jauh lebih lebar daripada Jawa.
    nearMissKm: 700,
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
    // County tetangga; ukurannya jauh lebih besar daripada kecamatan.
    nearMissKm: 90,
  },

  'my-states': {
    ...MY_BASE,
    maxZoom: 10,
    /**
     * `local`, tidak seperti provinsi Indonesia atau state AS.
     *
     * Bukan karena cakupannya sebagian negara — pool ini justru seluruh
     * Malaysia — tapi karena bentuk negaranya: Semenanjung dan Borneo
     * terpisah ±600 km laut, jadi kotak pembatasnya jauh lebih lebar
     * daripada daratannya. Zoom tetap dari `MY_BASE` menyisakan laut di
     * kiri-kanan dan membuat negerinya mengecil sampai bentuknya tidak
     * terbaca; `fitCollection` memasang kamera ke isi sebenarnya.
     */
    local: true,
    // Peta negeri terlalu sepi tanpa daratan sekitar: Thailand, Indonesia,
    // dan Brunei yang mengapitnya justru patokan posisi utama di sini.
    countryBackdrop: true,
    fitRegionMaxZoom: 7,
    fitPoolMaxZoom: 10,
    // Negeri tetangga di Semenanjung; skalanya mirip provinsi Indonesia,
    // jauh lebih kecil daripada state AS.
    nearMissKm: 250,
  },

  'jp-prefectures': {
    ...JP_BASE,
    maxZoom: 10,
    // Alasan sama dengan Malaysia: kepulauan memanjang membuat kotak
    // pembatasnya jauh lebih besar daripada daratannya, jadi zoom tetap
    // menyisakan laut kosong dan mengecilkan prefekturnya.
    local: true,
    // Korea dan pesisir Asia jadi patokan posisi; tanpa itu kepulauannya
    // mengambang di laut kosong.
    countryBackdrop: true,
    fitRegionMaxZoom: 8,
    fitPoolMaxZoom: 10,
    /**
     * Jarak antar prefektur bertetangga: median 65 km, terdekat 45 km.
     * 150 km berarti kira-kira "satu sampai dua prefektur meleset" — lebih
     * ketat daripada provinsi Indonesia karena prefektur jauh lebih rapat.
     */
    nearMissKm: 150,
  },

  'it-provinces': {
    ...IT_BASE,
    maxZoom: 11,
    // Semenanjung memanjang plus dua pulau besar; sama seperti Jepang,
    // kamera difit ke isi koleksi, bukan dipasang tetap.
    local: true,
    // Alpen dan Laut Tengah jadi patokan; tanpa itu Italia mengambang.
    countryBackdrop: true,
    fitRegionMaxZoom: 9,
    fitPoolMaxZoom: 11,
    /**
     * Provinsi Italia rapat: median jarak antar tetangga 39 km, terdekat
     * 9 km. 90 km berarti kira-kira "satu sampai dua provinsi meleset".
     */
    nearMissKm: 90,
  },

  'de-states': {
    ...DE_BASE,
    maxZoom: 11,
    // Sama seperti Italia: koleksinya menutupi seluruh negara, tapi kamera
    // difit ke isi koleksi supaya framingnya tepat di tiap rasio layar.
    local: true,
    // Denmark, Polandia, Ceko, Austria, Swiss, Prancis, dan Benelux jadi
    // patokan posisi; tanpa itu Jerman tampak mengambang.
    countryBackdrop: true,
    fitRegionMaxZoom: 9,
    fitPoolMaxZoom: 11,
    /**
     * Jarak antar negara bagian bertetangga: median 91 km, terdekat 28 km
     * (Berlin–Brandenburg), terjauh 178 km (Bayern–Baden-Württemberg).
     * 180 km berarti kira-kira "satu sampai dua negara bagian meleset".
     */
    nearMissKm: 180,
  },
}

/**
 * Profil paket negara. Polanya sama dengan Italia & Jerman: koleksinya
 * menutupi seluruh negara, kamera difit ke isi koleksi, dan daratan negara
 * tetangga digambar sebagai patokan posisi.
 */
function packProfile(pack: CountryPack): ScopeProfile {
  return {
    country: pack.country,
    ...pack.profile,
    maxZoom: Math.max(11, pack.profile.fitRegionMaxZoom + 2),
    local: true,
    countryBackdrop: true,
    fitPoolMaxZoom: 11,
  }
}

export function scopeProfile(scope: string): ScopeProfile {
  const pack = packForScope(scope)
  if (pack) return packProfile(pack)
  return PROFILES[scope as Exclude<DatasetScope, PackScope>] ?? WORLD
}

/** Nama negara induk sebuah scope; `null` di cakupan dunia. */
export function scopeCountry(scope: string): string | null {
  return scopeProfile(scope).country
}
