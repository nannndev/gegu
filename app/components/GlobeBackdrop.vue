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
})

// Perubahan tema cukup warnai ulang; jangan ulangi animasi kamera.
watch(isDark, () => {
  applyTheme()
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
