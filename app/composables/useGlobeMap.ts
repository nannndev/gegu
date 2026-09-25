import type { RegionCollection, RegionFeature, RegionItem } from '~/types/game'
import { regionId, toRegionItem } from '~/composables/useGeoData'
import { flagFillFor } from '~/utils/flagPalette'
import { haversineKm } from '~/utils/distance'
import { featureCentroid } from '~/utils/centroid'

type MarkKind = 'correct' | 'wrong' | 'target'

const MARK_CAP: Record<MarkKind, string> = {
  correct: '#059669',
  wrong: '#dc2626',
  target: '#0284c7',
}

/**
 * Tanda di atas foto satelit. Sedikit tembus supaya daratan di bawahnya masih
 * terbaca, tapi cukup pekat untuk jadi satu-satunya warna mencolok di globe.
 */
const MARK_FILL: Record<MarkKind, string> = {
  correct: 'rgba(16, 185, 129, 0.82)',
  wrong: 'rgba(244, 63, 94, 0.82)',
  target: 'rgba(56, 189, 248, 0.85)',
}

/** Foto bumi NASA Blue Marble (domain publik), dari contoh three-globe. */
const EARTH_TEXTURE = '/textures/earth-blue-marble.jpg'

interface Options {
  onRegionClick?: (item: RegionItem, distanceKm?: number) => void
  onMissClick?: () => void
  /** Target ronde berjalan; dipakai mengukur jarak tebakan yang meleset. */
  targetId?: Ref<string | null>
  isDark?: Ref<boolean>
  /** Hardcore: konteks dilucuti, kamera dikunci, wilayah non-pool disembunyikan. */
  hardcore?: Ref<boolean>
  /** Satu-satunya wilayah yang boleh terlihat (hardcore Mode B). */
  soloTargetId?: Ref<string | null>
  /** Wilayah yang boleh diklik; null = semua. */
  activePoolIds?: Ref<Set<string> | null>
  /** Wilayah yang tetap menyala setelah petunjuk Mode A dipakai. */
  spotlightIds?: Ref<Set<string> | null>
}

/** Ubah hex `#rrggbb` jadi rgba dengan alpha rendah, untuk wilayah yang diredupkan. */
function dimHex(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return 'rgba(148, 163, 184, 0.25)'
  const n = Number.parseInt(m[1]!, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, 0.25)`
}

/**
 * Globe 3D sebagai permukaan tebak untuk cakupan dunia.
 *
 * Semua interaksi yang dibutuhkan engine game (klik negara, hover, tanda
 * benar/salah/target, heat map rantai, fit kamera, kunci hardcore) punya
 * padanan langsung di globe.gl. Yang sengaja tidak disalin dari `useLeafletMap`
 * adalah ubin foto/relief — globe tidak punya proyeksi datar, jadi mode
 * tampilannya tunggal.
 *
 * Permukaannya foto satelit, negaranya tanpa isi — hanya garis batas. Dulu
 * tiap negara diisi warna benderanya, dan tanda benar/salah (hijau/merah)
 * tenggelam di antara ratusan negara yang sudah hijau & merah duluan.
 * Sekarang tanda jawaban adalah satu-satunya warna pekat di globe.
 *
 * Hardcore tetap memakai bola polos: foto satelit memperlihatkan garis pantai
 * seluruh dunia, dan itu persis petunjuk yang mode itu lucuti.
 */
export function useGlobeMap(
  container: Ref<HTMLElement | null>,
  collection: Ref<RegionCollection | null>,
  options: Options = {},
) {
  const ready = ref(false)
  const failed = ref(false)
  const interactive = ref(true)
  const hardcore = options.hardcore ?? ref(false)
  const isDark = options.isDark ?? ref(true)

  let globe: any = null
  /** Tekstur foto; null sampai selesai dimuat. */
  let photoTexture: unknown = null
  const photoReady = ref(false)
  let features: RegionFeature[] = []
  const centroidByKey = new Map<string, { lat: number, lng: number }>()
  const marked = new Set<string>()
  const markKindById = new Map<string, MarkKind>()
  const heatById = new Map<string, number>()
  const hoverKey = ref<string | null>(null)

  function oceanColor() {
    return isDark.value ? '#0b1220' : '#dfe7f0'
  }

  function strokeColor() {
    return isDark.value ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.22)'
  }

  function sideColor() {
    return isDark.value ? 'rgba(148,163,184,0.16)' : 'rgba(100,116,139,0.12)'
  }

  function fallbackCap() {
    return isDark.value ? '#334155' : '#cbd5e1'
  }

  function heatColor(t: number): string {
    const clamped = Math.min(1, Math.max(0, t))
    const hue = 120 * (1 - clamped)
    return `hsl(${hue} 65% 45%)`
  }

  /** Foto satelit aktif: teksturnya sudah ada dan bukan hardcore. */
  function photo(): boolean {
    return photoReady.value && !hardcore.value
  }

  /**
   * Pasang permukaan globe: foto atau warna laut polos. three-globe
   * mengosongkan `material.color` begitu teksturnya dimuat, jadi warnanya
   * dibuat ulang di sini kalau perlu, bukan sekadar di-`set`.
   */
  function applySurface() {
    if (!globe) return
    const mat = globe.globeMaterial()
    const usePhoto = photo()
    mat.map = usePhoto ? photoTexture : null
    // Di tema gelap fotonya diredam sedikit supaya tidak menyilaukan.
    const tint = usePhoto ? (isDark.value ? '#c3cbd9' : '#ffffff') : oceanColor()
    if (mat.color) mat.color.set(tint)
    else mat.color = mat.emissive.clone().set(tint)
    mat.needsUpdate = true
  }

  /** Wilayah ini boleh terlihat? Hardcore menyembunyikan yang di luar soal. */
  function isVisible(key: string): boolean {
    if (!hardcore.value) return true
    const solo = options.soloTargetId?.value
    if (solo) return key === solo
    const poolIds = options.activePoolIds?.value
    return !poolIds || poolIds.has(key)
  }

  function capColorFor(f: RegionFeature): string {
    const key = regionId(f)

    // Tanda jawaban & heat selalu menang — termasuk wilayah yang disembunyikan
    // hardcore, supaya jawaban benar tetap muncul saat ronde terungkap.
    if (heatById.has(key)) return heatColor(heatById.get(key)!)
    const mark = markKindById.get(key)
    if (mark) return photo() ? MARK_FILL[mark] : MARK_CAP[mark]

    if (!isVisible(key)) return 'rgba(0,0,0,0)'

    if (photo()) {
      // Wilayah yang dikesampingkan petunjuk digelapkan, bukan disembunyikan.
      const spotlight = options.spotlightIds?.value
      if (spotlight?.size && !spotlight.has(key)) return 'rgba(2, 6, 23, 0.55)'
      if (hoverKey.value === key) return 'rgba(255, 255, 255, 0.3)'
      return 'rgba(0, 0, 0, 0)'
    }

    const base = flagFillFor(f.properties.iso_a2 ?? '')?.fill ?? fallbackCap()
    const spotlight = options.spotlightIds?.value
    if (spotlight?.size && !spotlight.has(key)) return dimHex(base)
    return base
  }

  function altitudeFor(f: RegionFeature): number {
    const key = regionId(f)
    if (marked.has(key)) return 0.03
    if (hoverKey.value === key) return 0.02
    if (!isVisible(key)) return 0
    return 0.006
  }

  function strokeColorFor(f: RegionFeature): string {
    const key = regionId(f)
    if (!isVisible(key) && !marked.has(key) && !heatById.has(key)) return 'rgba(0,0,0,0)'
    if (photo()) return marked.has(key) ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)'
    return strokeColor()
  }

  /** Dinding samping wilayah yang ditandai ikut berwarna, supaya terlihat "terangkat". */
  function sideColorFor(f: RegionFeature): string {
    const mark = markKindById.get(regionId(f))
    if (photo() && mark) return MARK_FILL[mark]
    return photo() ? 'rgba(0,0,0,0)' : sideColor()
  }

  /**
   * Cincin berdenyut di pusat wilayah yang ditandai. Negara kecil (UEA,
   * Luksemburg, Singapura) cuma beberapa piksel di globe — tanpa cincin,
   * pemain tidak akan tahu di mana jawaban yang benar muncul.
   */
  function updateRings() {
    if (!globe) return
    const rings = [...markKindById].flatMap(([id, kind]) => {
      const c = centroidByKey.get(id)
      return c ? [{ ...c, kind }] : []
    })
    globe.ringsData(rings)
  }

  /** Paksa globe mengolah ulang poligonnya (re-warna setelah state berubah). */
  function rerender() {
    if (!globe || !features.length) return
    globe.polygonsData([...features])
    updateRings()
  }

  function distanceToTarget(id: string): number | undefined {
    const targetId = options.targetId?.value
    if (!targetId || targetId === id) return undefined
    const from = centroidByKey.get(id)
    const to = centroidByKey.get(targetId)
    if (!from || !to) return undefined
    return haversineKm(from, to)
  }

  function applyCameraLock() {
    if (!globe) return
    const controls = globe.controls()
    const lock = hardcore.value
    controls.enableRotate = !lock
    controls.enableZoom = !lock
  }

  function resize() {
    if (!globe || !container.value) return
    globe
      .width(container.value.clientWidth || 800)
      .height(container.value.clientHeight || 600)
  }

  async function init() {
    if (!container.value || !collection.value || globe) return
    try {
      const Globe: any = (await import('globe.gl')).default

      const probe = document.createElement('canvas')
      const gl = probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl')
      if (!gl) {
        failed.value = true
        return
      }
      if (!container.value) return

      features = collection.value.features as RegionFeature[]
      for (const f of features) {
        const c = featureCentroid(f.geometry)
        if (c) centroidByKey.set(regionId(f), c)
      }

      globe = Globe()(container.value)
        .backgroundColor('rgba(0,0,0,0)')
        .showAtmosphere(true)
        .atmosphereColor('#38bdf8')
        .atmosphereAltitude(0.16)
        .showGraticules(false)
        .polygonsData(features)
        .polygonsTransitionDuration(0)
        .polygonAltitude((f: RegionFeature) => altitudeFor(f))
        .polygonCapColor((f: RegionFeature) => capColorFor(f))
        .polygonSideColor((f: RegionFeature) => sideColorFor(f))
        .ringColor((r: { kind: MarkKind }) => {
          const rgb = r.kind === 'correct' ? '16,185,129' : r.kind === 'wrong' ? '244,63,94' : '56,189,248'
          return (t: number) => `rgba(${rgb},${(1 - t) * 0.9})`
        })
        .ringMaxRadius(4)
        .ringPropagationSpeed(3)
        .ringRepeatPeriod(900)
        .globeImageUrl(EARTH_TEXTURE)
        .onGlobeReady(() => {
          // Ambil teksturnya dari material, lalu atur sendiri kapan dipakai.
          photoTexture = globe?.globeMaterial().map ?? null
          photoReady.value = Boolean(photoTexture)
          applySurface()
          rerender()
        })
        .polygonStrokeColor((f: RegionFeature) => strokeColorFor(f))
        .showPointerCursor((type: string) => type === 'polygon')
        .onPolygonClick((polygon: object, event: MouseEvent) => {
          if (!interactive.value) return
          event.stopPropagation()
          const item = toRegionItem(polygon as RegionFeature)
          options.onRegionClick?.(item, distanceToTarget(item.id))
        })
        .onGlobeClick(() => {
          if (interactive.value) options.onMissClick?.()
        })
        .onPolygonHover((polygon: object | null) => {
          const key = polygon ? regionId(polygon as RegionFeature) : null
          if (key !== hoverKey.value) {
            hoverKey.value = key
            rerender()
          }
        })
        .width(container.value.clientWidth || 800)
        .height(container.value.clientHeight || 600)

      applySurface()

      const controls = globe.controls()
      controls.autoRotate = false
      controls.autoRotateSpeed = 0.35
      controls.enableDamping = true
      controls.enablePan = false
      applyCameraLock()

      resetView()
      window.addEventListener('resize', resize)
      ready.value = true
    }
    catch {
      failed.value = true
    }
  }

  function mark(id: string, kind: MarkKind) {
    marked.add(id)
    markKindById.set(id, kind)
    heatById.delete(id)
    rerender()
  }

  function heat(id: string, t: number) {
    marked.add(id)
    heatById.set(id, Math.min(1, Math.max(0, t)))
    markKindById.delete(id)
    rerender()
  }

  function resetStyles() {
    marked.clear()
    markKindById.clear()
    heatById.clear()
    hoverKey.value = null
    rerender()
  }

  function fitRegion(id: string) {
    const c = centroidByKey.get(id)
    if (!globe || !c) return
    globe.pointOfView({ lat: c.lat, lng: c.lng, altitude: 1.4 }, 800)
  }

  /** Fit kamera ke gabungan wilayah (hanya dipakai cakupan dunia di globe). */
  function fitPool(items: RegionItem[]) {
    if (!globe || !items.length) return
    let minLat = 90
    let maxLat = -90
    let minLng = 180
    let maxLng = -180
    let any = false
    for (const it of items) {
      const c = centroidByKey.get(it.id)
      if (!c) continue
      any = true
      minLat = Math.min(minLat, c.lat)
      maxLat = Math.max(maxLat, c.lat)
      minLng = Math.min(minLng, c.lng)
      maxLng = Math.max(maxLng, c.lng)
    }
    if (!any) {
      resetView()
      return
    }
    const lat = (minLat + maxLat) / 2
    const lng = (minLng + maxLng) / 2
    const spread = Math.max(maxLat - minLat, maxLng - minLng)
    const altitude = Math.min(2.6, Math.max(1.2, spread / 70 + 1.1))
    globe.pointOfView({ lat, lng, altitude }, 800)
  }

  /** Mode campuran tidak pernah sampai ke globe; jaga agar antarmukanya tetap sama. */
  function fitSameLevel(target: RegionItem) {
    fitRegion(target.id)
  }

  function resetView() {
    if (!globe) return
    globe.pointOfView({ lat: 20, lng: 0, altitude: 2.4 }, 800)
  }

  function zoomIn() {
    if (!globe || hardcore.value) return
    const pov = globe.pointOfView()
    globe.pointOfView({ altitude: Math.max(0.6, pov.altitude * 0.72) }, 200)
  }

  function zoomOut() {
    if (!globe || hardcore.value) return
    const pov = globe.pointOfView()
    globe.pointOfView({ altitude: Math.min(3.5, pov.altitude * 1.4) }, 200)
  }

  function invalidate() {
    resize()
  }

  function setInteractive(v: boolean) {
    interactive.value = v
  }

  watch([isDark, hardcore, () => options.soloTargetId?.value, () => options.activePoolIds?.value, () => options.spotlightIds?.value], () => {
    if (!ready.value || !globe) return
    applySurface()
    applyCameraLock()
    rerender()
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
    window.removeEventListener('resize', resize)
    if (!globe) return
    try {
      globe.pauseAnimation()
      globe.renderer()?.dispose()
      globe.renderer()?.forceContextLoss()
    }
    catch {}
    globe = null
    ready.value = false
  })

  return {
    ready,
    failed,
    interactive,
    mark,
    heat,
    resetStyles,
    fitRegion,
    fitPool,
    fitSameLevel,
    resetView,
    zoomIn,
    zoomOut,
    invalidate,
    setInteractive,
    /** Cakupan dunia selalu siap; tidak ada koleksi yang dimuat per ronde. */
    roundReady: true,
  }
}
