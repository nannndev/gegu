import type { Map as LeafletMap, GeoJSON, Layer, PathOptions } from 'leaflet'
import type { RegionCollection, RegionFeature, RegionItem } from '~/types/game'

export type RegionMark = 'correct' | 'wrong' | 'target'

const STYLE_CONTEXT: PathOptions = {
  fillColor: '#111726',
  fillOpacity: 0.85,
  color: '#1e293b',
  weight: 0.75,
}

const STYLE_BASE_WORLD: PathOptions = {
  fillColor: '#182032',
  fillOpacity: 0.95,
  color: '#334155',
  weight: 0.85,
}

const STYLE_BASE_ID: PathOptions = {
  fillColor: '#182032',
  fillOpacity: 0.95,
  color: '#0284c7',
  weight: 1.2,
}

const STYLE_ACTIVE_KAB: PathOptions = {
  fillColor: '#1a2744',
  fillOpacity: 0.95,
  color: '#38bdf8',
  weight: 2,
}

const STYLE_CONTEXT_KAB: PathOptions = {
  fillColor: '#0b0f19',
  fillOpacity: 0.75,
  color: '#1e293b',
  weight: 0.75,
}

const STYLE_HOVER: PathOptions = {
  fillColor: '#0369a1',
  fillOpacity: 1,
  color: '#7dd3fc',
  weight: 2.5,
}

const STYLE_MARK: Record<RegionMark, PathOptions> = {
  correct: { fillColor: '#15803d', fillOpacity: 1, color: '#86efac', weight: 3 },
  wrong: { fillColor: '#b91c1c', fillOpacity: 1, color: '#fca5a5', weight: 3 },
  target: { fillColor: '#d97706', fillOpacity: 1, color: '#fde047', weight: 3 },
}

interface Options {
  onRegionClick?: (item: RegionItem) => void
  onMissClick?: () => void
  scope?: Ref<string>
  worldContext?: Ref<RegionCollection | null>
  activePoolIds?: Ref<Set<string> | null>
}

export function useLeafletMap(
  container: Ref<HTMLElement | null>,
  collection: Ref<RegionCollection | null>,
  options: Options = {},
) {
  const ready = ref(false)
  const interactive = ref(true)
  const scope = options.scope ?? ref('world')

  let L: typeof import('leaflet') | null = null
  let map: LeafletMap | null = null
  let contextLayer: GeoJSON | null = null
  let geoLayer: GeoJSON | null = null
  const layerById = new Map<string, Layer>()
  const marked = new Set<string>()

  function styleFor(layer: Layer, style: PathOptions) {
    ;(layer as unknown as { setStyle: (s: PathOptions) => void }).setStyle(style)
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
      marked.clear()
    }

    const isId = scope.value === 'id' || scope.value === 'id-provinces' || scope.value === 'id-kabupaten'
    const isKabMode = scope.value === 'id-kabupaten'

    // If in Indonesia mode, render neighboring countries as background context
    if (isId && options.worldContext?.value) {
      const neighborFeatures = options.worldContext.value.features.filter(
        f => f.properties.name !== 'Indonesia',
      )
      contextLayer = L.geoJSON({ type: 'FeatureCollection', features: neighborFeatures } as never, {
        style: () => ({ ...STYLE_CONTEXT }),
        interactive: false,
      }).addTo(map)
    }

    geoLayer = L.geoJSON(collection.value, {
      style: (feature) => {
        const f = feature as RegionFeature
        const item = toRegionItem(f)
        const isTargetPool = !options.activePoolIds?.value || options.activePoolIds.value.has(item.id)
        if (isKabMode) {
          return isTargetPool ? { ...STYLE_ACTIVE_KAB } : { ...STYLE_CONTEXT_KAB }
        }
        return isId ? { ...STYLE_BASE_ID } : { ...STYLE_BASE_WORLD }
      },
      onEachFeature: (feature, layer) => {
        const f = feature as RegionFeature
        const item = toRegionItem(f)
        layerById.set(item.id, layer)

        const isTargetPool = !options.activePoolIds?.value || options.activePoolIds.value.has(item.id)
        const baseStyle = isKabMode
          ? (isTargetPool ? STYLE_ACTIVE_KAB : STYLE_CONTEXT_KAB)
          : (isId ? STYLE_BASE_ID : STYLE_BASE_WORLD)

        layer.on({
          mouseover: () => {
            if (!interactive.value || marked.has(item.id) || (isKabMode && !isTargetPool)) return
            styleFor(layer, { ...baseStyle, ...STYLE_HOVER })
            ;(layer as unknown as { bringToFront: () => void }).bringToFront()
          },
          mouseout: () => {
            if (marked.has(item.id)) return
            styleFor(layer, { ...baseStyle })
          },
          click: (e: { originalEvent?: Event }) => {
            if (!interactive.value) return
            e.originalEvent?.stopPropagation()
            if (isKabMode && !isTargetPool) {
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

    const isId = scope.value === 'id' || scope.value === 'id-provinces' || scope.value === 'id-kabupaten'
    const initialCenter: [number, number] = isId ? [-2.2, 118] : [20, 0]
    const initialZoom = isId ? 5 : 2
    const minZoom = isId ? 3.5 : 1.8
    const maxZoom = scope.value === 'id-kabupaten' ? 16 : isId ? 10 : 7

    map = L.map(container.value, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom,
      maxZoom,
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: !isId,
    })

    setupLayers()

    map.on('click', () => {
      if (interactive.value) options.onMissClick?.()
    })

    ready.value = true
  }

  function mark(id: string, kind: RegionMark) {
    const layer = layerById.get(id)
    if (!layer) return
    marked.add(id)
    const isId = scope.value === 'id' || scope.value === 'id-provinces' || scope.value === 'id-kabupaten'
    const isKabMode = scope.value === 'id-kabupaten'
    const isTargetPool = !options.activePoolIds?.value || options.activePoolIds.value.has(id)
    const baseStyle = isKabMode
      ? (isTargetPool ? STYLE_ACTIVE_KAB : STYLE_CONTEXT_KAB)
      : (isId ? STYLE_BASE_ID : STYLE_BASE_WORLD)
    styleFor(layer, { ...baseStyle, ...STYLE_MARK[kind] })
    ;(layer as unknown as { bringToFront: () => void }).bringToFront()
  }

  function resetStyles() {
    marked.clear()
    const isId = scope.value === 'id' || scope.value === 'id-provinces' || scope.value === 'id-kabupaten'
    const isKabMode = scope.value === 'id-kabupaten'
    for (const [id, layer] of layerById.entries()) {
      const isTargetPool = !options.activePoolIds?.value || options.activePoolIds.value.has(id)
      const baseStyle = isKabMode
        ? (isTargetPool ? STYLE_ACTIVE_KAB : STYLE_CONTEXT_KAB)
        : (isId ? STYLE_BASE_ID : STYLE_BASE_WORLD)
      styleFor(layer, { ...baseStyle })
    }
  }

  function fitRegion(id: string) {
    const layer = layerById.get(id) as unknown as { getBounds?: () => never } | undefined
    if (!map || !layer?.getBounds) return
    const maxZoom = scope.value === 'id-kabupaten' ? 12 : scope.value === 'id-provinces' ? 8 : 5
    map.fitBounds(layer.getBounds(), { padding: [60, 60], maxZoom, animate: true })
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
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12, animate: true })
    }
  }

  function resetView() {
    const isId = scope.value === 'id' || scope.value === 'id-provinces' || scope.value === 'id-kabupaten'
    if (isId) {
      map?.setView([-2.2, 118], 5, { animate: true })
    }
    else {
      map?.setView([20, 0], 2, { animate: true })
    }
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

  watch([collection, scope, () => options.activePoolIds?.value], () => {
    if (ready.value) {
      setupLayers()
      if (scope.value !== 'id-kabupaten') {
        resetView()
      }
    }
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
    layerById.clear()
    marked.clear()
    ready.value = false
  })

  return { ready, interactive, mark, resetStyles, fitRegion, fitPool, resetView, zoomIn, zoomOut, invalidate }
}
