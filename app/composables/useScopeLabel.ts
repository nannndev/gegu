import type { DatasetScope } from '~/types/game'
import { type CountryPack, packForScope } from '~/utils/countryPacks'

export type MixedPart = 'province' | 'kabupaten' | 'kecamatan'

/** Bagian-bagian penyusun label cakupan, bebas bahasa. */
export interface ScopeParts {
  scope: DatasetScope
  /** Filter benua/kepulauan; 'all' berarti tanpa filter. */
  regionFilter?: string
  provinceName?: string
  /** Nama kota; boleh masih berawalan "Kota"/"Kabupaten". */
  cityName?: string
  /** Nama state AS; untuk mode county. */
  stateName?: string
  mixedParts?: MixedPart[]
}

/**
 * Label cakupan yang dirakit saat render, bukan disimpan sebagai teks.
 *
 * Ini yang membuat pengalih bahasa tetap benar di tengah sesi: kalau label
 * jadinya ikut tersimpan di store saat sesi dimulai, layar hasil akan
 * menampilkan bahasa yang dipakai saat tombol mulai ditekan.
 */
export function useScopeLabel() {
  const { t, locale } = useI18n()

  /** Teks paket negara dalam bahasa aktif. */
  function packText(pack: CountryPack) {
    return pack.text[locale.value]
  }

  /** Huruf besar di awal — "provinsi" → "Provinsi" untuk awal kalimat. */
  function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  /** Buang awalan administratif supaya labelnya ringkas. */
  function shortCity(city: string) {
    return city.replace(/^(Kota|Kabupaten)( Administrasi)? /, '')
  }

  function formatScope(parts: ScopeParts): string {
    const { scope, regionFilter = 'all' } = parts

    if (scope === 'world') {
      return regionFilter === 'all' ? t('scope.worldAll') : regionFilter
    }
    if (scope === 'us-states') {
      return regionFilter === 'all'
        ? t('scope.usStates')
        : t('scope.usStatesFiltered', { region: regionFilter })
    }
    if (scope === 'us-county') {
      return t('scope.usCounty', {
        state: parts.stateName || t('scope.stateFallback'),
      })
    }
    if (scope === 'my-states') {
      return regionFilter === 'all'
        ? t('scope.myStates')
        : t('scope.myStatesFiltered', { region: regionFilter })
    }
    if (scope === 'jp-prefectures') {
      return regionFilter === 'all'
        ? t('scope.jpPrefectures')
        : t('scope.jpPrefecturesFiltered', { region: regionFilter })
    }
    if (scope === 'it-provinces') {
      return regionFilter === 'all'
        ? t('scope.itProvinces')
        : t('scope.itProvincesFiltered', { region: regionFilter })
    }
    if (scope === 'de-states') {
      return regionFilter === 'all'
        ? t('scope.deStates')
        : t('scope.deStatesFiltered', { region: regionFilter })
    }
    const pack = packForScope(scope)
    if (pack) {
      const txt = packText(pack)
      return regionFilter === 'all'
        ? t('pack.scope', { country: txt.country, n: pack.count, unit: txt.unit })
        : t('pack.scopeFiltered', { country: txt.country, region: regionFilter })
    }
    if (scope === 'id-provinces') {
      return regionFilter === 'all'
        ? t('scope.idProvinces')
        : t('scope.idProvincesFiltered', { region: regionFilter })
    }
    if (scope === 'id-kabupaten') {
      return t('scope.idKabupaten', {
        province: parts.provinceName || t('scope.provinceFallback'),
      })
    }
    if (scope === 'id-mixed') {
      const labels: Record<MixedPart, string> = {
        province: t('setup.mixed.province'),
        kabupaten: t('setup.mixed.kabupaten'),
        kecamatan: t('setup.mixed.kecamatan'),
      }
      const chosen = (parts.mixedParts ?? []).map(p => labels[p])
      return t('scope.idMixed', { parts: chosen.join(' + ') })
    }
    return t('scope.idKecamatan', {
      city: shortCity(parts.cityName ?? '') || t('scope.cityFallback'),
    })
  }

  /** Satuan wilayah untuk teks seperti "8 / 267 kecamatan". */
  function unitFor(scope: DatasetScope): string {
    if (scope === 'world') return t('unit.country')
    if (scope === 'us-states') return t('unit.state')
    if (scope === 'us-county') return t('unit.county')
    if (scope === 'my-states') return t('unit.negeri')
    if (scope === 'jp-prefectures') return t('unit.prefecture')
    if (scope === 'it-provinces') return t('unit.provincia')
    if (scope === 'de-states') return t('unit.bundesland')
    const pack = packForScope(scope)
    if (pack) return packText(pack).unit
    if (scope === 'id-provinces') return t('unit.province')
    if (scope === 'id-kabupaten') return t('unit.kabupaten')
    if (scope === 'id-mixed') return t('unit.region')
    return t('unit.kecamatan')
  }

  return { formatScope, unitFor, shortCity, packText, capitalize }
}
