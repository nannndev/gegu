import type { Map as LeafletMap, GeoJSON, Layer, PathOptions, TileLayer } from 'leaflet'
import type { RegionCollection, RegionFeature, RegionItem } from '~/types/game'
import type { MapViewMode } from '~/composables/useMapView'
import { FLAG_BORDER, flagFillFor } from '~/utils/flagPalette'
import { scopeProfile } from '~/utils/scopeProfile'

export type RegionMark = 'correct' | 'wrong' | 'target'

/**
 * Scope yang terkurung dalam satu negara: petanya digambar dengan gaya polos
 * plus negara sekitar sebagai konteks, bukan isian warna bendera seperti
 * mode dunia.
 */
function isCountryScope(scope: string) {
  return scopeProfile(scope).country !== null
}

function isLocalScope(scope: string) {
  return scopeProfile(scope).local
}

/**
 * Scope yang koleksi aktifnya hanya mencakup sebagian kecil negaranya
 * (kecamatan cuma satu kota), jadi daratan negaranya perlu digambar sebagai backdrop.
 */
function needsCountryBackdrop(scope: string) {
  return scopeProfile(scope).countryBackdrop
}

interface Options {
  onRegionClick?: (item: RegionItem) => void
  onMissClick?: () => void
  scope?: Ref<string>
  worldContext?: Ref<RegionCollection | null>
  /** Backdrop beresolusi lebih tinggi untuk scope yang cuma menutupi sebagian kecil negara. */
  localContext?: Ref<RegionCollection | null>
  activePoolIds?: Ref<Set<string> | null>
  /** Mode tampilan peta (vektor/relief/satelit/cetak biru). */
  viewMode?: Ref<MapViewMode>
  /** Tema aplikasi; mode vektor punya padanan terang & gelap. */
  isDark?: Ref<boolean>
}

export function useLeafletMap(
  container: Ref<HTMLElement | null>,
  collection: Ref<RegionCollection | null>,
  options: Options = {},
) {
  const ready = ref(false)
  const interactive = ref(true)
  const scope = options.scope ?? ref('world')
  const viewMode = options.viewMode ?? ref<MapViewMode>('vector')
  const isDark = options.isDark ?? ref(true)
  /** Tema aktif; semua style poligon dibaca dari sini. */
  const theme = () => mapTheme(viewMode.value, isDark.value)

  let L: typeof import('leaflet') | null = null
  let map: LeafletMap | null = null
  let contextLayer: GeoJSON | null = null
  let geoLayer: GeoJSON | null = null
  let tileLayer: TileLayer | null = null
  const layerById = new Map<string, Layer>()
  const itemById = new Map<string, RegionItem>()
  const marked = new Set<string>()
  /** Jenis tanda per wilayah, supaya bisa digambar ulang setelah tema berganti. */
  const markKindById = new Map<string, RegionMark>()

  function styleFor(layer: Layer, style: PathOptions) {
    ;(layer as unknown as { setStyle: (s: PathOptions) => void }).setStyle(style)
  }

  /**
   * Style dasar sebuah wilayah. Scope dunia memakai isian warna bendera
   * (mode tanpa ubin); mode lain memakai tema polos.
   */
  function baseStyleFor(item: RegionItem): PathOptions {
    const t = theme()
    const isCountry = isCountryScope(scope.value)
    const isLocalMode = isLocalScope(scope.value)
    const isTargetPool = !options.activePoolIds?.value || options.activePoolIds.value.has(item.id)

    if (isLocalMode) {
      return isTargetPool ? { ...t.activeLocal } : { ...t.contextLocal }
    }
    if (isCountry) return { ...t.baseId }

    if (t.flagWorld) {
      const flag = flagFillFor(item.iso ?? item.id)
      if (flag) {
        return {
          fillColor: flag.fill,
          fillOpacity: 1,
          color: flag.border ?? FLAG_BORDER,
          weight: 0.6,
        }
      }
    }
    return { ...t.baseWorld }
  }

  function setupLayers() {
    if (!L || !map || !collection.value) return

    // Clean up previous layers
    if (contextLayer) {
      contextLayer.remove()
      contextLayer = null
    }
    if (geoLayer) {
      geoLayer.remove()
      geoLayer = null
      layerById.clear()
      itemById.clear()
      marked.clear()
      markKindById.clear()
    }

    const t = theme()
    const isCountry = isCountryScope(scope.value)
    const isLocalMode = isLocalScope(scope.value)
    const country = scopeProfile(scope.value).country

    // Ubin peta (relief/satelit). Mode vektor & cetak biru tidak pakai ubin.
    if (tileLayer) {
      tileLayer.remove()
      tileLayer = null
    }
    if (t.tiles) {
      tileLayer = L.tileLayer(t.tiles.url, {
        attribution: t.tiles.attribution,
        opacity: t.tiles.opacity,
        maxNativeZoom: t.tiles.maxNativeZoom,
        // Ubin harus di bawah poligon soal.
        pane: 'tilePane',
      }).addTo(map)
    }
    // Warna kanvas & grid diatur lewat CSS variable di MapView, bukan di sini,
    // supaya aturan .leaflet-container di main.css tidak saling menimpa.

    // Mode satu negara: gambar negara sekitar sebagai latar. Kalau koleksi aktif
    // hanya menutupi sebagian kecil negaranya (kecamatan satu kota), daratan
    // negaranya ikut digambar supaya peta tidak tampak kosong di luar wilayah soal.
    if (isCountry && country && options.worldContext?.value) {
      // Daratan negara digambar dari dataset yang lebih rapat kalau tersedia:
      // garis pantainya jauh lebih detail daripada outline negara, yang pada
      // zoom sekelas kota terlihat sebagai garis lurus.
      const backdrop = needsCountryBackdrop(scope.value)
        ? options.localContext?.value ?? null
        : null

      const neighbours = options.worldContext.value.features.filter(
        f => f.properties.name !== country,
      )
      const contextFeatures = backdrop
        ? [...neighbours, ...backdrop.features]
        : needsCountryBackdrop(scope.value)
          ? options.worldContext.value.features
          : neighbours

      contextLayer = L.geoJSON({ type: 'FeatureCollection', features: contextFeatures } as never, {
        style: (feature) => {
          const p = (feature as RegionFeature | undefined)?.properties
          const isHomeLand = p?.country === country || p?.name === country
          return isHomeLand ? { ...t.contextLand } : { ...t.context }
        },
        interactive: false,
      }).addTo(map)
    }

    geoLayer = L.geoJSON(collection.value, {
      style: (feature) => {
        const f = feature as RegionFeature
        const item = toRegionItem(f)
        return baseStyleFor(item)
      },
      onEachFeature: (feature, layer) => {
        const f = feature as RegionFeature
        const item = toRegionItem(f)
        layerById.set(item.id, layer)
        itemById.set(item.id, item)

        const baseStyle = baseStyleFor(item)
        const isTargetPool = !options.activePoolIds?.value || options.activePoolIds.value.has(item.id)

        layer.on({
          mouseover: () => {
            if (!interactive.value || marked.has(item.id) || (isLocalMode && !isTargetPool)) return
            styleFor(layer, { ...baseStyle, ...t.hover })
            ;(layer as unknown as { bringToFront: () => void }).bringToFront()
          },
          mouseout: () => {
            if (marked.has(item.id)) return
            styleFor(layer, { ...baseStyle })
          },
          click: (e: { originalEvent?: Event }) => {
            if (!interactive.value) return
            e.originalEvent?.stopPropagation()
            if (isLocalMode && !isTargetPool) {
              options.onMissClick?.()
              return
            }
            options.onRegionClick?.(item)
          },
        })
      },
    }).addTo(map)
  }

  async function init() {
    if (!container.value || !collection.value || map) return
    L = await import('leaflet')

    const profile = scopeProfile(scope.value)
    const isLocalMode = profile.local

    map = L.map(container.value, {
      center: profile.center,
      zoom: profile.zoom,
      minZoom: profile.minZoom,
      maxZoom: profile.maxZoom,
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: profile.country === null,
    })

    setupLayers()
    if (isLocalMode) fitCollection(false)

    map.on('click', () => {
      if (interactive.value) options.onMissClick?.()
    })

    ready.value = true
  }

  function mark(id: string, kind: RegionMark) {
    const layer = layerById.get(id)
    if (!layer) return
    marked.add(id)
    markKindById.set(id, kind)
    const item = itemById.get(id)
    const baseStyle = item ? baseStyleFor(item) : { ...theme().baseWorld }
    styleFor(layer, { ...baseStyle, ...theme().mark[kind] })
    ;(layer as unknown as { bringToFront: () => void }).bringToFront()
  }

  function resetStyles() {
    marked.clear()
    markKindById.clear()
    for (const [id, layer] of layerById.entries()) {
      const item = itemById.get(id)
      const baseStyle = item ? baseStyleFor(item) : { ...theme().baseWorld }
      styleFor(layer, { ...baseStyle })
    }
  }

  /**
   * Fit kamera ke cakupan dataset lokal: utamakan wilayah pool aktif,
   * jatuh ke seluruh koleksi kalau pool belum siap.
   */
  function fitCollection(animate = true) {
    if (!map || !L || !geoLayer) return false

    const poolIds = options.activePoolIds?.value
    let bounds: import('leaflet').LatLngBounds | null = null

    if (poolIds?.size) {
      const poolBounds = L.latLngBounds([])
      for (const id of poolIds) {
        const layer = layerById.get(id) as unknown as { getBounds?: () => import('leaflet').LatLngBounds } | undefined
        if (layer?.getBounds) poolBounds.extend(layer.getBounds())
      }
      if (poolBounds.isValid()) bounds = poolBounds
    }

    if (!bounds) {
      const all = geoLayer.getBounds()
      if (all.isValid()) bounds = all
    }
    if (!bounds) return false

    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: scopeProfile(scope.value).fitPoolMaxZoom,
      animate,
    })
    return true
  }

  function fitRegion(id: string) {
    const layer = layerById.get(id) as unknown as { getBounds?: () => never } | undefined
    if (!map || !layer?.getBounds) return
    map.fitBounds(layer.getBounds(), {
      padding: [60, 60],
      maxZoom: scopeProfile(scope.value).fitRegionMaxZoom,
      animate: true,
    })
  }

  function fitPool(items: RegionItem[]) {
    if (!map || !L || !items.length) return
    const bounds = L.latLngBounds([])
    for (const item of items) {
      const layer = layerById.get(item.id) as unknown as { getBounds?: () => import('leaflet').LatLngBounds } | undefined
      if (layer?.getBounds) {
        bounds.extend(layer.getBounds())
      }
    }
    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: scopeProfile(scope.value).fitPoolMaxZoom,
        animate: true,
      })
    }
  }

  /**
   * Mode campuran: framing untuk Mode A. Kamera dipasang ke gabungan wilayah
   * pool yang selevel target dan sudah punya layer di koleksi yang aktif —
   * kalau pakai fitRegion, target langsung terlihat sendirian dan soalnya
   * hilang; kalau pakai fitPool, level lain ikut membuat zoom keluar jauh.
   */
  function fitSameLevel(target: RegionItem) {
    if (!map || !L) return
    const bounds = L.latLngBounds([])
    for (const [id, layer] of layerById.entries()) {
      if (!options.activePoolIds?.value?.has(id)) continue
      const withBounds = layer as unknown as { getBounds?: () => import('leaflet').LatLngBounds }
      if (withBounds.getBounds) bounds.extend(withBounds.getBounds())
    }
    if (!bounds.isValid()) {
      fitRegion(target.id)
      return
    }
    const maxZoom = target.level === 'district' ? 12 : target.level === 'country' ? 9 : 6
    map.fitBounds(bounds, { padding: [60, 60], maxZoom, animate: true })
  }

  function resetView() {
    if (isLocalScope(scope.value) && fitCollection()) return
    const profile = scopeProfile(scope.value)
    map?.setView(profile.center, profile.zoom, { animate: true })
  }

  function zoomIn() {
    map?.zoomIn()
  }

  function zoomOut() {
    map?.zoomOut()
  }

  function invalidate() {
    map?.invalidateSize()
  }

  watch([collection, scope, () => options.activePoolIds?.value, () => options.localContext?.value], () => {
    if (ready.value) {
      setupLayers()
      if (isLocalScope(scope.value)) {
        fitCollection()
      }
      else {
        resetView()
      }
    }
  })

  // Ganti view mode atau tema hanya menukar ubin & warna — kamera dibiarkan di
  // tempatnya supaya pemain tidak kehilangan posisi di tengah ronde.
  watch([viewMode, isDark], () => {
    if (!ready.value) return
    // `setupLayers` mengosongkan `marked`, jadi jenis tandanya disalin dulu —
    // tanpa ini wilayah yang sudah dijawab kehilangan warna hijau/merahnya
    // begitu pemain mengganti tema di tengah ronde.
    const previous = [...markKindById.entries()]
    setupLayers()
    for (const [id, kind] of previous) mark(id, kind)
  })

  onMounted(() => {
    if (collection.value) void init()
    else {
      const stop = watch(collection, (c) => {
        if (!c) return
        stop()
        void init()
      })
    }
  })

  onBeforeUnmount(() => {
    map?.remove()
    map = null
    contextLayer = null
    geoLayer = null
    tileLayer = null
    layerById.clear()
    itemById.clear()
    marked.clear()
    markKindById.clear()
    ready.value = false
  })

  return { ready, interactive, mark, resetStyles, fitRegion, fitPool, fitCollection, fitSameLevel, resetView, zoomIn, zoomOut, invalidate }
}
