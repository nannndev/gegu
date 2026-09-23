import type { Map as LeafletMap, GeoJSON, Layer, PathOptions, TileLayer } from 'leaflet'
import type { RegionCollection, RegionFeature, RegionItem } from '~/types/game'
import type { MapViewMode } from '~/composables/useMapView'
import { FLAG_BORDER, flagFillFor } from '~/utils/flagPalette'
import { scopeProfile } from '~/utils/scopeProfile'
import { haversineKm } from '~/utils/distance'

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

/**
 * Wilayah yang disembunyikan di hardcore. Layernya tetap dibuat — `mark()`
 * masih harus bisa memunculkannya kembali saat jawaban terungkap — jadi yang
 * dinolkan cuma tampilannya, bukan keberadaannya.
 */
const HIDDEN: PathOptions = { fillOpacity: 0, opacity: 0, weight: 0 }

/**
 * Wilayah di luar region yang diungkap petunjuk Mode A. Diredupkan, bukan
 * disembunyikan: yang dibeli pemain adalah penyempitan pencarian, dan itu
 * hanya terbaca kalau wilayah yang dikesampingkan masih terlihat samar.
 * Tetap bisa diklik — petunjuk mempersempit tebakan, bukan melarangnya.
 */
const DIMMED: PathOptions = { fillOpacity: 0.12, opacity: 0.25 }

interface Options {
  /**
   * `distanceKm` adalah jarak pusat wilayah yang diklik ke pusat target
   * ronde ini; `undefined` kalau tidak ada target atau salah satu pusatnya
   * tidak bisa dihitung. Diukur di sini, bukan di pemanggil, karena hanya
   * layer Leaflet yang tahu geometri tiap wilayah.
   */
  onRegionClick?: (item: RegionItem, distanceKm?: number) => void
  onMissClick?: () => void
  /** Target ronde berjalan; dipakai mengukur jarak tebakan yang meleset. */
  targetId?: Ref<string | null>
  /**
   * Wilayah yang tetap menyala setelah petunjuk Mode A dipakai. Saat set ini
   * tidak kosong, wilayah di luarnya diredupkan supaya pencarian menyempit
   * tanpa langsung menunjuk jawabannya.
   */
  spotlightIds?: Ref<Set<string> | null>
  scope?: Ref<string>
  worldContext?: Ref<RegionCollection | null>
  /** Backdrop beresolusi lebih tinggi untuk scope yang cuma menutupi sebagian kecil negara. */
  localContext?: Ref<RegionCollection | null>
  activePoolIds?: Ref<Set<string> | null>
  /** Mode tampilan peta (vektor/relief/satelit/cetak biru). */
  viewMode?: Ref<MapViewMode>
  /** Tema aplikasi; mode vektor punya padanan terang & gelap. */
  isDark?: Ref<boolean>
  /** Mode hardcore: konteks dilucuti dan kamera dikunci. */
  hardcore?: Ref<boolean>
  /**
   * Satu-satunya wilayah yang boleh terlihat. Diisi hanya di hardcore Mode B,
   * di mana wilayah lain murni petunjuk: soalnya menyorot satu bentuk dan
   * pemain memilih namanya, jadi tidak ada yang perlu diklik di peta.
   */
  soloTargetId?: Ref<string | null>
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
  const hardcore = options.hardcore ?? ref(false)
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

  /**
   * Wilayah ini boleh terlihat? Di luar hardcore semuanya boleh; di hardcore
   * hanya pool soal — dan di Mode B, hanya target rondenya.
   */
  function isVisible(id: string): boolean {
    if (!hardcore.value) return true
    const solo = options.soloTargetId?.value
    if (solo) return id === solo
    const poolIds = options.activePoolIds?.value
    return !poolIds || poolIds.has(id)
  }

  function styleFor(layer: Layer, style: PathOptions) {
    ;(layer as unknown as { setStyle: (s: PathOptions) => void }).setStyle(style)
  }

  /**
   * Pusat sebuah wilayah, dari bounding box layer-nya.
   *
   * Bukan sentroid poligon: negara berbentuk cekung atau berkepulauan bisa
   * punya sentroid di laut, dan itu tidak lebih benar daripada titik tengah
   * bbox untuk keperluan di sini — yang diukur adalah "seberapa jauh
   * melesetnya", bukan koordinat resmi sebuah wilayah.
   */
  function centerOf(id: string): { lat: number, lng: number } | null {
    const layer = layerById.get(id) as unknown as {
      getBounds?: () => import('leaflet').LatLngBounds
    } | undefined
    if (!layer?.getBounds) return null
    const bounds = layer.getBounds()
    if (!bounds.isValid()) return null
    const c = bounds.getCenter()
    return { lat: c.lat, lng: c.lng }
  }

  /** Jarak pusat sebuah wilayah ke pusat target ronde ini, km. */
  function distanceToTarget(id: string): number | undefined {
    const targetId = options.targetId?.value
    if (!targetId || targetId === id) return undefined
    const from = centerOf(id)
    const to = centerOf(targetId)
    if (!from || !to) return undefined
    return haversineKm(from, to)
  }

  /**
   * Style dasar sebuah wilayah. Scope dunia memakai isian warna bendera
   * (mode tanpa ubin); mode lain memakai tema polos.
   */
  function baseStyleFor(item: RegionItem, revealed = false): PathOptions {
    const t = theme()
    // `revealed` dipakai untuk wilayah yang sudah dijawab: penyembunyian
    // hardcore dilewati supaya pemain melihat letak yang benar.
    const hidden = hardcore.value && !revealed
    if (hidden && !isVisible(item.id)) return { ...HIDDEN }
    const isCountry = isCountryScope(scope.value)
    const isLocalMode = isLocalScope(scope.value)
    const isTargetPool = !options.activePoolIds?.value || options.activePoolIds.value.has(item.id)

    // Petunjuk Mode A: wilayah di luar sorotan diredupkan. Dilewati untuk
    // wilayah yang sudah dijawab, supaya jawaban benar tetap menyala penuh
    // saat ronde terungkap.
    const spotlight = options.spotlightIds?.value
    const dim = !revealed && Boolean(spotlight?.size) && !spotlight!.has(item.id)

    if (isLocalMode) {
      const style = isTargetPool ? { ...t.activeLocal } : { ...t.contextLocal }
      return dim ? { ...style, ...DIMMED } : style
    }
    if (isCountry) return dim ? { ...t.baseId, ...DIMMED } : { ...t.baseId }
    if (dim) return { ...t.baseWorld, ...DIMMED }

    // Warna bendera praktis menyebut nama negaranya, jadi hardcore memakai
    // isian polos meskipun temanya menyediakan bendera.
    if (t.flagWorld && (!hardcore.value || revealed)) {
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
    // Hardcore melewati seluruh layer konteks: daratan tetangga adalah
    // petunjuk posisi terbesar yang tersisa setelah bendera dimatikan.
    if (!hardcore.value && isCountry && country && options.worldContext?.value) {
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
            // Wilayah tersembunyi tidak boleh menyala saat disentuh kursor:
            // kalau boleh, menyapu mouse ke seluruh peta jadi cara gratis
            // menemukan wilayah yang justru sedang disembunyikan.
            if (!isVisible(item.id)) return
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
            // Wilayah tersembunyi diperlakukan seperti laut — klik di situ
            // meleset, bukan menjawab sesuatu yang tidak terlihat pemain.
            if ((isLocalMode && !isTargetPool) || !isVisible(item.id)) {
              options.onMissClick?.()
              return
            }
            options.onRegionClick?.(item, distanceToTarget(item.id))
          },
        })
      },
    }).addTo(map)
  }

  /**
   * Kunci kamera saat hardcore. Yang dimatikan hanya kendali pemain —
   * `fitBounds` dan `setView` tetap jalan, jadi framing tiap ronde masih
   * bisa memposisikan peta; pemain cuma tidak bisa menggesernya sendiri.
   */
  function applyCameraLock() {
    if (!map) return
    const lock = hardcore.value
    const handlers = [
      map.dragging,
      map.scrollWheelZoom,
      map.doubleClickZoom,
      map.touchZoom,
      map.boxZoom,
      map.keyboard,
    ]
    for (const h of handlers) {
      if (lock) h?.disable()
      else h?.enable()
    }
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
      /**
       * Zoom pecahan.
       *
       * Default Leaflet (`zoomSnap: 1`) membulatkan tiap `fitBounds` ke
       * tingkat zoom bulat terdekat ke bawah. Karena satu tingkat zoom
       * berarti 2× skala, pembulatan itu bisa menyisakan wilayah soal cuma
       * mengisi separuh layar — paling parah di cakupan yang bentuknya tidak
       * sebangun dengan layar, seperti kepulauan Jepang yang memanjang.
       * Profil cakupan di `scopeProfile` pun sudah menulis minZoom pecahan
       * (1,8 · 2,5 · 3,5), yang tanpa ini tidak pernah benar-benar berlaku.
       */
      zoomSnap: 0.1,
    })

    applyCameraLock()

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
    // Tanda dibangun di atas style normal, bukan style hardcore: begitu ronde
    // terjawab, wilayahnya justru harus muncul supaya pemain melihat letak
    // yang benar. `HIDDEN` menolkan opacity, jadi menumpuknya di sini akan
    // membuat jawaban benar tetap tak terlihat.
    const baseStyle = item ? baseStyleFor(item, true) : { ...theme().baseWorld }
    styleFor(layer, { ...baseStyle, ...theme().mark[kind] })
    ;(layer as unknown as { bringToFront: () => void }).bringToFront()
  }

  /**
   * Warnai satu wilayah dengan gradasi panas-dingin untuk mode rantai jarak.
   * `t` di [0,1]: 0 = hijau (dekat), 1 = merah (jauh). Berbeda dari `mark`
   * yang cuma punya tiga warna tetap — di sini tiap tebakan diwarnai sesuai
   * jaraknya, sehingga peta berangsur jadi peta panas.
   */
  function heat(id: string, t: number) {
    const layer = layerById.get(id)
    if (!layer) return
    const clamped = Math.min(1, Math.max(0, t))
    const hue = 120 * (1 - clamped)
    marked.add(id)
    styleFor(layer, {
      fillColor: `hsl(${hue} 65% 45%)`,
      fillOpacity: 0.9,
      color: `hsl(${hue} 65% 30%)`,
      weight: 1.5,
    })
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
   * Padding fitBounds yang menyisakan ruang untuk bilah soal di bawah layar.
   *
   * Di mode normal wilayah yang tertutup bilah itu bisa digeser keluar oleh
   * pemain, jadi padding simetris sudah cukup. Di hardcore kameranya terkunci:
   * bentuk yang tertutup bilah tidak bisa diselamatkan, padahal bentuk itulah
   * seluruh soalnya. Jadi ruang bawahnya dipesan di muka.
   */
  /**
   * Tinggi yang ditempati bilah soal di bawah layar, dalam piksel.
   *
   * Diukur dari DOM, bukan ditebak: tingginya berubah menurut mode (Mode B
   * punya empat tombol pilihan, Mode A tidak) dan menurut lebar layar. Angka
   * tetap yang terlalu kecil membuat wilayah soal tetap tertutup — persis
   * masalah yang fungsi ini ada untuk mencegahnya. Fallback 230px dipakai
   * kalau bilahnya belum ter-render, dan hasilnya dibatasi 45% tinggi peta
   * supaya wilayahnya tidak terdesak jadi titik kecil di layar pendek.
   */
  function promptReserve(): number {
    const height = map?.getSize().y ?? 0
    if (!height) return 0
    const bar = document.querySelector('[data-prompt-bar]')
    const measured = bar ? Math.round(bar.getBoundingClientRect().height) + 24 : 230
    return Math.min(measured, Math.round(height * 0.45))
  }

  function fitPadding(base: number): { paddingTopLeft: [number, number], paddingBottomRight: [number, number] } {
    const topLeft: [number, number] = [base, base]
    if (!hardcore.value) return { paddingTopLeft: topLeft, paddingBottomRight: topLeft }
    return { paddingTopLeft: topLeft, paddingBottomRight: [base, Math.max(base, promptReserve())] }
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
      ...fitPadding(50),
      maxZoom: scopeProfile(scope.value).fitPoolMaxZoom,
      animate,
    })
    return true
  }

  function fitRegion(id: string) {
    const layer = layerById.get(id) as unknown as { getBounds?: () => never } | undefined
    if (!map || !layer?.getBounds) return
    map.fitBounds(layer.getBounds(), {
      ...fitPadding(60),
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
        ...fitPadding(50),
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
    map.fitBounds(bounds, { ...fitPadding(60), maxZoom, animate: true })
  }

  function resetView() {
    if (isLocalScope(scope.value) && fitCollection()) return
    const profile = scopeProfile(scope.value)
    map?.setView(profile.center, profile.zoom, { animate: true })
    // Kamera terkunci: peta digeser naik setengah tinggi bilah soal supaya
    // wilayah di lintang selatan tidak berakhir di balik bilah itu — di mode
    // normal pemain tinggal menggesernya sendiri, di hardcore tidak bisa.
    if (hardcore.value) map?.panBy([0, promptReserve() / 2], { animate: false })
  }

  function zoomIn() {
    if (hardcore.value) return
    map?.zoomIn()
  }

  function zoomOut() {
    if (hardcore.value) return
    map?.zoomOut()
  }

  function invalidate() {
    map?.invalidateSize()
  }

  /**
   * Sorotan petunjuk berubah: gambar ulang gaya dasar tiap wilayah.
   *
   * Cukup `styleFor`, bukan `setupLayers` — layernya tidak berubah, hanya
   * warnanya, dan membangun ulang layer di tengah ronde akan menghapus
   * tanda jawaban yang sudah terpasang.
   */
  watch(() => options.spotlightIds?.value, () => {
    if (!ready.value) return
    for (const [id, layer] of layerById.entries()) {
      if (marked.has(id)) continue
      const item = itemById.get(id)
      if (item) styleFor(layer, baseStyleFor(item))
    }
  })

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

  // Ganti view mode, tema, atau kesulitan hanya menukar ubin & warna — kamera
  // dibiarkan di tempatnya supaya pemain tidak kehilangan posisi di tengah ronde.
  watch([viewMode, isDark, hardcore, () => options.soloTargetId?.value], () => {
    if (!ready.value) return
    // `setupLayers` mengosongkan `marked`, jadi jenis tandanya disalin dulu —
    // tanpa ini wilayah yang sudah dijawab kehilangan warna hijau/merahnya
    // begitu pemain mengganti tema di tengah ronde.
    const previous = [...markKindById.entries()]
    setupLayers()
    applyCameraLock()
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

  return { ready, interactive, cameraLocked: hardcore, mark, heat, resetStyles, fitRegion, fitPool, fitCollection, fitSameLevel, resetView, zoomIn, zoomOut, invalidate }
}
