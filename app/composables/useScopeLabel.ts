import type { DatasetScope } from '~/types/game'

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
  const { t } = useI18n()

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
    if (scope === 'id-provinces') return t('unit.province')
    if (scope === 'id-kabupaten') return t('unit.kabupaten')
    if (scope === 'id-mixed') return t('unit.region')
    return t('unit.kecamatan')
  }

  return { formatScope, unitFor, shortCity }
}
