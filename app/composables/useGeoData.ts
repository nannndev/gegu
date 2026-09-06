import type {
  RegionCollection,
  RegionFeature,
  RegionItem,
  RegionLevel,
} from '~/types/game'

export type DatasetScope = 'world' | 'id-provinces' | 'id-kabupaten'

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

/** Cache per-set supaya GeoJSON hanya di-parse sekali per sesi. */
const cache = new Map<string, RegionCollection>()

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
  const pending = useState('geo-pending', () => false)
  const error = useState<string | null>('geo-error', () => null)

  async function load(level?: RegionLevel, code?: DatasetScope, force = false) {
    const targetScope = code ?? currentScope.value ?? 'world'
    const targetLevel = level ?? (targetScope === 'id-kabupaten' || targetScope === 'id-provinces' ? 'province' : 'world')

    if (collection.value && currentScope.value === targetScope && !force) return collection.value
    pending.value = true
    error.value = null
    currentScope.value = targetScope
    try {
      if (!worldContext.value) {
        worldContext.value = (await import('~/assets/data/countries.geo.json')).default as unknown as RegionCollection
      }
      collection.value = await loadRegionSet(targetLevel, targetScope)
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
    const level: RegionLevel = scope === 'id-kabupaten' ? 'province' : scope === 'id-provinces' ? 'province' : 'world'
    await load(level, scope, true)
  }

  /** Semua wilayah sebagai item ringan, untuk pool soal & distraktor. */
  const items = computed<RegionItem[]>(() =>
    (collection.value?.features ?? []).map(toRegionItem),
  )

  /** Daftar region unik (benua, kepulauan, atau provinsi). */
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

  function itemsInRegion(regionFilter: string) {
    if (regionFilter === 'all') return items.value
    return items.value.filter(i => i.region === regionFilter)
  }

  return {
    currentScope,
    collection,
    worldContext,
    items,
    regions,
    availableProvinces,
    pending,
    error,
    load,
    setScope,
    itemsInRegion,
  }
}
