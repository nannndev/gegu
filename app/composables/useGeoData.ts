import type {
  DatasetScope,
  RegionCollection,
  RegionFeature,
  RegionItem,
  RegionLevel,
} from '~/types/game'

export function regionId(feature: RegionFeature): string {
  return (feature.properties as { id?: string }).id ?? feature.properties.iso_a2 ?? feature.properties.name
}

export function toRegionItem(feature: RegionFeature): RegionItem {
  const p = feature.properties as {
    id?: string
    name: string
    name_id?: string
    region: string
    iso_a2?: string | null
    province?: string
  }

  return {
    id: p.id ?? p.iso_a2 ?? p.name,
    name: p.name,
    nameId: p.name_id ?? p.name,
    region: p.region,
    iso: p.iso_a2 ?? null,
  }
}

/** Satu kabupaten/kota di indeks kecamatan. */
export interface KecamatanCity {
  id: string
  file: string
  city: string
  province: string
  count: number
}

interface KecamatanIndex {
  provinces: string[]
  cities: KecamatanCity[]
}

/** Cache per-set supaya GeoJSON hanya di-parse sekali per sesi. */
const cache = new Map<string, RegionCollection>()

/**
 * Data kecamatan dipecah satu file per kabupaten/kota (~7.000 kecamatan total),
 * jadi hanya kota yang dipilih yang diunduh. Vite meng-glob-nya jadi chunk terpisah.
 */
const kecamatanFiles = import.meta.glob<{ default: RegionCollection }>(
  '~/assets/data/kecamatan/*.geo.json',
)

function kecamatanLoader(file: string) {
  const entry = Object.entries(kecamatanFiles).find(([path]) => path.endsWith(`/${file}`))
  return entry?.[1] ?? null
}

async function loadRegionSet(
  level: RegionLevel,
  code: DatasetScope = 'world',
): Promise<RegionCollection> {
  const key = `${level}:${code}`
  const cached = cache.get(key)
  if (cached) return cached

  let data: RegionCollection
  if (code === 'id-kabupaten') {
    data = (await import('~/assets/data/indonesia-kabupaten.geo.json')).default as unknown as RegionCollection
  }
  else if (code === 'id-provinces' || level === 'province') {
    data = (await import('~/assets/data/indonesia-provinces.geo.json')).default as unknown as RegionCollection
  }
  else {
    data = (await import('~/assets/data/countries.geo.json')).default as unknown as RegionCollection
  }

  cache.set(key, data)
  return data
}

export function useGeoData() {
  const currentScope = useState<DatasetScope>('geo-scope', () => 'world')
  const collection = useState<RegionCollection | null>('geo-collection', () => null)
  const worldContext = useState<RegionCollection | null>('geo-world-context', () => null)
  /**
   * Backdrop detail untuk scope yang cuma mencakup sebagian kecil Indonesia
   * (mis. kecamatan satu kota). Pakai poligon kabupaten karena garis pantainya
   * jauh lebih rapat daripada outline negara di countries.geo.json.
   */
  const localContext = useState<RegionCollection | null>('geo-local-context', () => null)
  /** Indeks ringan (±20KB) berisi daftar kabupaten/kota beserta jumlah kecamatannya. */
  const kecamatanIndex = useState<KecamatanIndex | null>('geo-kecamatan-index', () => null)
  /** Kabupaten/kota yang sedang dimuat di mode kecamatan. */
  const kecamatanCityId = useState<string | null>('geo-kecamatan-city', () => null)
  const pending = useState('geo-pending', () => false)
  const error = useState<string | null>('geo-error', () => null)

  /** Muat indeks kecamatan (daftar kota); dipanggil sebelum memilih kota. */
  async function loadKecamatanIndex() {
    if (kecamatanIndex.value) return kecamatanIndex.value
    kecamatanIndex.value = (await import('~/assets/data/kecamatan/index.json'))
      .default as unknown as KecamatanIndex
    return kecamatanIndex.value
  }

  /** Kota default kalau belum ada pilihan: Jakarta Pusat, atau kota pertama. */
  function defaultCityId(index: KecamatanIndex) {
    return index.cities.find(c => /Jakarta Pusat/i.test(c.city))?.id
      ?? index.cities[0]?.id
      ?? null
  }

  /**
   * Muat kecamatan satu kabupaten/kota. Hanya file kota itu yang diunduh,
   * jadi ukurannya tetap puluhan KB walau datanya nasional.
   */
  async function loadKecamatanCity(cityId: string) {
    const index = await loadKecamatanIndex()
    const city = index.cities.find(c => c.id === cityId) ?? null
    if (!city) throw new Error(`Kota "${cityId}" tidak ada di indeks kecamatan.`)

    const key = `district:${city.id}`
    const cached = cache.get(key)
    if (cached) {
      kecamatanCityId.value = city.id
      return cached
    }

    const loader = kecamatanLoader(city.file)
    if (!loader) throw new Error(`Data kecamatan ${city.city} tidak ditemukan.`)

    const data = (await loader()).default as unknown as RegionCollection
    cache.set(key, data)
    kecamatanCityId.value = city.id
    return data
  }

  async function load(level?: RegionLevel, code?: DatasetScope, force = false, cityId?: string) {
    const targetScope = code ?? currentScope.value ?? 'world'
    const targetLevel = level ?? (targetScope === 'id-kecamatan' ? 'district' : targetScope === 'id-kabupaten' || targetScope === 'id-provinces' ? 'province' : 'world')

    const targetCity = targetScope === 'id-kecamatan'
      ? cityId ?? kecamatanCityId.value ?? defaultCityId(await loadKecamatanIndex())
      : null

    const sameTarget = currentScope.value === targetScope
      && (targetScope !== 'id-kecamatan' || kecamatanCityId.value === targetCity)
    if (collection.value && sameTarget && !force) return collection.value

    pending.value = true
    error.value = null
    currentScope.value = targetScope
    try {
      if (!worldContext.value) {
        worldContext.value = (await import('~/assets/data/countries.geo.json')).default as unknown as RegionCollection
      }

      if (targetScope === 'id-kecamatan') {
        collection.value = await loadKecamatanCity(targetCity!)
        if (!localContext.value) {
          localContext.value = await loadRegionSet('province', 'id-kabupaten')
        }
      }
      else {
        collection.value = await loadRegionSet(targetLevel, targetScope)
        localContext.value = null
        kecamatanCityId.value = null
      }
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load map data.'
    }
    finally {
      pending.value = false
    }
    return collection.value
  }

  async function setScope(scope: DatasetScope) {
    if (currentScope.value === scope && collection.value) return
    const level: RegionLevel = scope === 'id-kecamatan' ? 'district' : scope === 'id-kabupaten' ? 'province' : scope === 'id-provinces' ? 'province' : 'world'
    await load(level, scope, true)
  }

  /** Ganti kabupaten/kota di mode kecamatan. */
  async function setKecamatanCity(cityId: string) {
    if (kecamatanCityId.value === cityId && collection.value) return
    await load('district', 'id-kecamatan', true, cityId)
  }

  /**
   * Pool untuk mode campuran: provinsi, kabupaten/kota, dan kecamatan diadu
   * dalam satu sesi. Kecamatan diambil dari beberapa kota acak saja — memuat
   * ke-514 file jelas tidak masuk akal, jadi `cityCount` membatasi berapa kota
   * yang benar-benar diunduh.
   */
  async function buildMixedPool(options: {
    levels: RegionLevel[]
    cityCount?: number
  }): Promise<RegionItem[]> {
    const { levels, cityCount = 4 } = options
    const items: RegionItem[] = []

    if (levels.includes('province')) {
      const provinces = await loadRegionSet('province', 'id-provinces')
      items.push(...provinces.features.map(f => ({ ...toRegionItem(f), level: 'province' as const })))
    }

    if (levels.includes('country')) {
      const kabupaten = await loadRegionSet('province', 'id-kabupaten')
      items.push(...kabupaten.features.map(f => ({ ...toRegionItem(f), level: 'country' as const })))
    }

    if (levels.includes('district')) {
      const index = await loadKecamatanIndex()
      // Utamakan kota yang kecamatannya banyak supaya soalnya terasa berisi.
      const candidates = [...index.cities].filter(c => c.count >= 5)
      const picked: typeof candidates = []
      while (picked.length < Math.min(cityCount, candidates.length)) {
        const i = Math.floor(Math.random() * candidates.length)
        picked.push(...candidates.splice(i, 1))
      }
      for (const city of picked) {
        const data = await loadKecamatanCity(city.id)
        items.push(...data.features.map(f => ({
          ...toRegionItem(f),
          level: 'district' as const,
          cityId: city.id,
        })))
      }
    }

    return items
  }

  /** Semua wilayah sebagai item ringan, untuk pool soal & distraktor. */
  const items = computed<RegionItem[]>(() =>
    (collection.value?.features ?? []).map(toRegionItem),
  )

  /** Daftar region unik (benua, kepulauan, kota, atau provinsi). */
  const regions = computed(() =>
    [...new Set(items.value.map(i => i.region))].sort(),
  )

  /** Khusus id-kabupaten: daftar provinsi beserta jumlah kabupaten/kota-nya */
  const availableProvinces = computed(() => {
    if (currentScope.value !== 'id-kabupaten') return []
    const counts = new Map<string, number>()
    for (const item of items.value) {
      counts.set(item.region, (counts.get(item.region) || 0) + 1)
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  /**
   * Khusus id-kecamatan: seluruh kabupaten/kota nasional dari indeks.
   * Diambil dari indeks (bukan dari `items`) karena koleksi yang dimuat
   * hanya berisi satu kota.
   */
  const availableCities = computed(() => {
    if (currentScope.value !== 'id-kecamatan') return []
    return kecamatanIndex.value?.cities ?? []
  })

  /** Daftar provinsi di indeks kecamatan, untuk filter bertingkat di UI. */
  const kecamatanProvinces = computed(() => kecamatanIndex.value?.provinces ?? [])

  /** Kota kecamatan yang sedang aktif. */
  const activeKecamatanCity = computed(() =>
    kecamatanIndex.value?.cities.find(c => c.id === kecamatanCityId.value) ?? null,
  )

  function itemsInRegion(regionFilter: string) {
    if (regionFilter === 'all') return items.value
    return items.value.filter(i => i.region === regionFilter)
  }

  return {
    currentScope,
    collection,
    worldContext,
    localContext,
    items,
    regions,
    availableProvinces,
    availableCities,
    kecamatanProvinces,
    kecamatanCityId,
    activeKecamatanCity,
    pending,
    error,
    load,
    setScope,
    setKecamatanCity,
    loadKecamatanIndex,
    buildMixedPool,
    loadKecamatanCity,
    loadRegionSet,
    itemsInRegion,
  }
}
