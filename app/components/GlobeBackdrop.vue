<script setup lang="ts">
import type { RegionCollection } from '~/types/game'
import { flagFillFor } from '~/utils/flagPalette'
import { ringArea, ringCentroid } from '~/utils/centroid'

/**
 * Latar menu berupa globe 3D berputar, tiap negara diisi warna benderanya.
 *
 * Memakai `globe.gl` (Three.js) yang dimuat lazy lewat dynamic import, jadi
 * beratnya tidak ikut memblokir render pertama. Kalau WebGL tidak tersedia
 * atau modulnya gagal dimuat, jatuh ke `WorldMapBackdrop` (SVG) — latar lama.
 *
 * GeoJSON-nya sama dengan `WorldMapBackdrop`: diambil dari `worldContext`
 * yang sudah ada di memori, jadi tidak ada unduhan tambahan.
 */
const props = withDefaults(defineProps<{
  collection: RegionCollection | null
  /** Negara yang disorot (mengikuti cakupan yang dipilih). */
  highlightIso?: string | null
}>(), {
  highlightIso: null,
})

const { isDark } = useTheme()
const container = ref<HTMLElement | null>(null)
const failed = ref(false)

let globe: any = null

function oceanColor() {
  return isDark.value ? '#0b1220' : '#dfe7f0'
}

function strokeColor() {
  return isDark.value ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.16)'
}

function sideColor() {
  return isDark.value ? 'rgba(148,163,184,0.14)' : 'rgba(100,116,139,0.10)'
}

function capColor(iso: string) {
  if (props.highlightIso && iso === props.highlightIso) return '#38bdf8'
  return flagFillFor(iso)?.fill ?? '#64748b'
}

/** Pusat negara yang disorot, dari ring terbesar di fitur-fitur yang cocok. */
function countryCentroid(iso: string): { lat: number, lng: number } | null {
  let bestRing: number[][] | null = null
  let bestArea = 0
  for (const f of props.collection?.features ?? []) {
    if (f.properties.iso_a2 !== iso) continue
    const g = f.geometry
    if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue
    const polys = g.type === 'Polygon'
      ? [g.coordinates as number[][][]]
      : (g.coordinates as number[][][][])
    for (const poly of polys) {
      const ring = poly[0]
      if (!ring || ring.length < 4) continue
      const area = Math.abs(ringArea(ring))
      if (area > bestArea) {
        bestArea = area
        bestRing = ring
      }
    }
  }
  return bestRing ? ringCentroid(bestRing) : null
}

// ── Rute terbang ──────────────────────────────────────────────
/**
 * Busur terbang antar negara, plus denyut cincin di titik mendaratnya.
 * Tujuannya bukan data — ini latar — tapi memberi kesan "perjalanan" yang
 * cocok dengan game tebak lokasi, dan membuat globe terasa hidup meski
 * pemain tidak menyentuhnya. Saat ada negara yang disorot, semua rute
 * berangkat dari negara itu, jadi pilihan cakupan terasa langsung bereaksi.
 */
interface Place { iso: string, lat: number, lng: number }
interface Arc { startLat: number, startLng: number, endLat: number, endLng: number, gap: number }
interface Ring { lat: number, lng: number }

const ARC_COUNT = 6
/** Jeda antar gelombang rute baru, ms. */
const ARC_WAVE_MS = 4200
/** Waktu satu garis putus-putus menempuh busurnya, ms. */
const ARC_FLIGHT_MS = 2600

let places: Place[] = []
let waveTimer: ReturnType<typeof setInterval> | null = null

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Satu titik per negara (ring terbesar) — dihitung sekali per koleksi. */
function buildPlaces() {
  const seen = new Set<string>()
  places = []
  for (const f of props.collection?.features ?? []) {
    const iso = f.properties.iso_a2
    if (!iso || seen.has(iso)) continue
    seen.add(iso)
    const c = countryCentroid(iso)
    if (c) places.push({ iso, ...c })
  }
}

/** Jarak sudut kasar dua titik, derajat — cukup untuk menyaring rute. */
function spanDeg(a: Place, b: Place) {
  const dLat = a.lat - b.lat
  const dLng = Math.abs(a.lng - b.lng) % 360
  return Math.hypot(dLat, Math.min(dLng, 360 - dLng))
}

/**
 * Rute satu gelombang. Rute yang terlalu pendek hampir tak terlihat,
 * yang terlalu panjang melengkung ke sisi belakang globe — keduanya
 * dibuang, jadi yang tersisa busur yang jelas terbaca di sisi depan.
 */
function nextArcs(): Arc[] {
  if (places.length < 2) return []
  const pick = () => places[Math.floor(Math.random() * places.length)]!
  const hub = props.highlightIso ? places.find(p => p.iso === props.highlightIso) : undefined
  const arcs: Arc[] = []
  for (let tries = 0; arcs.length < ARC_COUNT && tries < 200; tries++) {
    const from = hub ?? pick()
    const to = pick()
    const span = spanDeg(from, to)
    // Dengan hub, kamera sudah menatap negara itu — tujuan di atas ~70°
    // sudah di balik tepi globe, jadi batasnya diperketat.
    if (from.iso === to.iso || span < 15 || span > (hub ? 70 : 95)) continue
    arcs.push({
      startLat: from.lat,
      startLng: from.lng,
      endLat: to.lat,
      endLng: to.lng,
      // Gelombang tidak berangkat serentak — tiap busur mulai di fase berbeda.
      gap: Math.random() * 2,
    })
  }
  return arcs
}

function arcColors(): [string, string] {
  return isDark.value
    ? ['rgba(56,189,248,0.15)', 'rgba(186,230,253,1)']
    : ['rgba(2,132,199,0.2)', 'rgba(3,105,161,1)']
}

function ringColor() {
  const rgb = isDark.value ? '125,211,252' : '3,105,161'
  return (t: number) => `rgba(${rgb},${Math.max(0, 1 - t) * 0.8})`
}

/**
 * Pasang gelombang rute baru. Cincin berdenyut di tiap tujuan, dengan
 * periode sama dengan waktu terbang, jadi denyutnya terbaca sebagai
 * "mendarat" alih-alih kedip acak.
 */
function launchWave() {
  if (!globe) return
  const arcs = nextArcs()
  globe.arcsData(arcs)
  globe.ringsData(arcs.map((a): Ring => ({ lat: a.endLat, lng: a.endLng })))
}

function startRoutes() {
  stopRoutes()
  if (!globe || reducedMotion()) return
  buildPlaces()
  launchWave()
  waveTimer = setInterval(launchWave, ARC_WAVE_MS)
}

function stopRoutes() {
  if (waveTimer) clearInterval(waveTimer)
  waveTimer = null
  globe?.arcsData([]).ringsData([])
}

/**
 * Arahkan globe ke negara yang disorot. Tanpa sorotan (cakupan dunia) globe
 * berputar bebas; dengan sorotan, auto-rotate dihentikan supaya negara itu
 * tidak hilang berputar ke sisi belakang.
 */
function focusCountry(iso: string | null) {
  if (!globe) return
  const controls = globe.controls()
  if (!iso) {
    controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return
  }
  controls.autoRotate = false
  const center = countryCentroid(iso)
  if (center) {
    globe.pointOfView({ lat: center.lat, lng: center.lng, altitude: 1.7 }, 900)
  }
}

/** Paksa globe mengolah ulang poligonnya (untuk highlight / tema). */
function refresh() {
  if (!globe || !props.collection?.features?.length) return
  globe.polygonsData([...props.collection.features])
}

function resize() {
  if (!globe || !container.value) return
  globe
    .width(container.value.clientWidth || 600)
    .height(container.value.clientHeight || 600)
}

function applyTheme() {
  if (!globe) return
  globe.globeMaterial().color.set(oceanColor())
  globe.polygonStrokeColor(() => strokeColor())
  globe.polygonSideColor(() => sideColor())
  globe.arcColor(() => arcColors()).ringColor(() => ringColor())
  refresh()
}

onMounted(async () => {
  try {
    const Globe: any = (await import('globe.gl')).default

    // Globe butuh WebGL; kalau tidak ada, pakai latar SVG lama.
    const probe = document.createElement('canvas')
    const gl = probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl')
    if (!gl) {
      failed.value = true
      return
    }
    if (!container.value) return

    globe = Globe()(container.value)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#38bdf8')
      .atmosphereAltitude(0.18)
      .showGraticules(false)
      .polygonsData(props.collection?.features ?? [])
      .polygonAltitude(f => (props.highlightIso && f.properties.iso_a2 === props.highlightIso ? 0.02 : 0.008))
      .polygonCapColor((f: { properties: { iso_a2?: string } }) => capColor(f.properties.iso_a2 ?? ''))
      .polygonSideColor(() => sideColor())
      .polygonStrokeColor(() => strokeColor())
      .arcStartLat((a: Arc) => a.startLat)
      .arcStartLng((a: Arc) => a.startLng)
      .arcEndLat((a: Arc) => a.endLat)
      .arcEndLng((a: Arc) => a.endLng)
      .arcColor(() => arcColors())
      .arcStroke(0.9)
      .arcAltitudeAutoScale(0.42)
      .arcDashLength(0.5)
      .arcDashGap(1.5)
      .arcDashInitialGap((a: Arc) => a.gap)
      .arcDashAnimateTime(ARC_FLIGHT_MS)
      .arcsTransitionDuration(0)
      .ringColor(() => ringColor())
      .ringMaxRadius(5)
      .ringPropagationSpeed(2.2)
      .ringRepeatPeriod(ARC_FLIGHT_MS)
      .width(container.value.clientWidth || 600)
      .height(container.value.clientHeight || 600)

    globe.globeMaterial().color.set(oceanColor())

    const controls = globe.controls()
    controls.autoRotateSpeed = 0.35
    controls.enableZoom = false
    controls.enablePan = false
    controls.enableDamping = true

    globe.pointOfView({ lat: 18, lng: 12, altitude: 2.4 }, 0)
    // Terapkan sorotan awal (mis. cakupan yang dipulihkan saat reload) sekaligus
    // matikan auto-rotate bila pengguna meminta gerakan diminimalkan.
    focusCountry(props.highlightIso)
    startRoutes()
    window.addEventListener('resize', resize)
  }
  catch {
    failed.value = true
  }
})

// Perubahan cakupan: warnai ulang + arahkan globe ke negara terpilih.
watch([() => props.collection, () => props.highlightIso], () => {
  applyTheme()
  focusCountry(props.highlightIso)
  // Gelombang baru langsung, jangan tunggu interval: rute harus terlihat
  // berangkat dari negara yang baru dipilih saat itu juga.
  startRoutes()
})

// Perubahan tema cukup warnai ulang; jangan ulangi animasi kamera.
watch(isDark, () => {
  applyTheme()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  stopRoutes()
  if (!globe) return
  try {
    globe.pauseAnimation()
    globe.renderer()?.dispose()
    globe.renderer()?.forceContextLoss()
  }
  catch {}
  globe = null
})
</script>

<template>
  <WorldMapBackdrop v-if="failed" :collection="collection" :highlight-iso="highlightIso" />
  <div v-else ref="container" class="globe-backdrop" aria-hidden="true" />
</template>

<style scoped>
.globe-backdrop {
  position: absolute;
  top: 50%;
  right: -12vmin;
  transform: translateY(-50%);
  width: min(92vmin, 860px);
  height: min(92vmin, 860px);
  pointer-events: none;
}
</style>
