<script setup lang="ts">
import type { RegionCollection, RoundResult } from '~/types/game'
import { regionId } from '~/composables/useGeoData'
import { featureCentroid } from '~/utils/centroid'

/**
 * Rekap sesi di globe 3D: satu titik per ronde di lokasi targetnya, diwarnai
 * hasilnya, dan busur yang menyambung ronde demi ronde — rute "perjalanan"
 * yang baru saja ditempuh pemain. Tabel di bawahnya bilang *apa* yang salah;
 * globe ini bilang *di mana*, dan pola seperti "semua yang meleset ada di
 * Afrika" langsung terbaca tanpa membaca satu baris pun.
 *
 * Globe-nya bisa diputar (drag) tapi tidak di-zoom: halaman ini digulir, dan
 * zoom lewat roda mouse akan membajak guliran itu.
 */
const props = defineProps<{
  collection: RegionCollection | null
  history: RoundResult[]
}>()

const { isDark } = useTheme()
const { t } = useI18n()
const container = ref<HTMLElement | null>(null)
/** WebGL tidak ada / modul gagal: sembunyikan kartunya sepenuhnya. */
const failed = ref(false)

type Outcome = 'correct' | 'near' | 'wrong'

interface Stop {
  round: number
  name: string
  lat: number
  lng: number
  outcome: Outcome
}

const COLORS: Record<Outcome, string> = {
  correct: '#10b981',
  near: '#f59e0b',
  wrong: '#f43f5e',
}

function outcomeOf(row: RoundResult): Outcome {
  if (row.correct) return 'correct'
  return row.pointsEarned > 0 ? 'near' : 'wrong'
}

/** Titik tiap ronde, urut ronde. Ronde yang targetnya tak ada di koleksi dilewati. */
const stops = computed<Stop[]>(() => {
  const byId = new Map<string, { lat: number, lng: number }>()
  for (const f of props.collection?.features ?? []) {
    const id = regionId(f)
    if (byId.has(id)) continue
    const c = featureCentroid(f.geometry)
    if (c) byId.set(id, c)
  }
  return props.history.flatMap((row) => {
    const c = byId.get(row.targetId)
    return c ? [{ round: row.round, name: row.targetName, ...c, outcome: outcomeOf(row) }] : []
  })
})

const legend = computed(() => {
  const count = { correct: 0, near: 0, wrong: 0 }
  for (const s of stops.value) count[s.outcome]++
  return count
})

/**
 * Kamera: arahkan ke rata-rata vektor semua titik (bukan rata-rata lat/lng,
 * yang rusak di sekitar garis tanggal), lalu mundur sejauh sebaran titiknya.
 */
function framing(list: Stop[]) {
  const rad = Math.PI / 180
  let x = 0, y = 0, z = 0
  for (const s of list) {
    x += Math.cos(s.lat * rad) * Math.cos(s.lng * rad)
    y += Math.cos(s.lat * rad) * Math.sin(s.lng * rad)
    z += Math.sin(s.lat * rad)
  }
  const lat = Math.atan2(z, Math.hypot(x, y)) / rad
  const lng = Math.atan2(y, x) / rad
  // Sudut terjauh dari pusat, derajat.
  let spread = 0
  for (const s of list) {
    const cos = Math.sin(lat * rad) * Math.sin(s.lat * rad)
      + Math.cos(lat * rad) * Math.cos(s.lat * rad) * Math.cos((s.lng - lng) * rad)
    spread = Math.max(spread, Math.acos(Math.min(1, Math.max(-1, cos))) / rad)
  }
  // Plafon 1,9: lebih jauh dari itu globe mengecil jadi bola kecil di
  // tengah kartu. Titik di sisi belakang tetap bisa dilihat dengan diputar.
  const altitude = Math.min(1.9, Math.max(0.35, spread / 32))
  return { lat, lng, altitude }
}

let globe: any = null
let ro: ResizeObserver | null = null
/** Ukuran label ikut jarak kamera — ukuran tetap tak terbaca saat globe jauh. */
let labelSize = 1.6

function oceanColor() {
  return isDark.value ? '#0b1220' : '#e2e8f0'
}

function landColor() {
  return isDark.value ? 'rgba(148,163,184,0.34)' : 'rgba(100,116,139,0.34)'
}

function applyTheme() {
  if (!globe) return
  globe.globeMaterial().color.set(oceanColor())
  globe.polygonCapColor(() => landColor())
  globe.polygonsData([...(props.collection?.features ?? [])])
}

function render() {
  if (!globe) return
  const list = stops.value
  const legs = list.slice(1).map((s, i) => ({ from: list[i]!, to: s }))
  const view = list.length ? framing(list) : null
  if (view) labelSize = Math.max(1, view.altitude * 2.2)
  globe
    .pointsData(list)
    .arcsData(legs)
    .ringsData(list.filter(s => s.outcome !== 'correct'))
    .labelsData(list)
  if (view) globe.pointOfView(view, 1200)
}

onMounted(async () => {
  if (stops.value.length < 2) return
  try {
    const probe = document.createElement('canvas')
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) {
      failed.value = true
      return
    }
    const Globe: any = (await import('globe.gl')).default
    if (!container.value) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    globe = Globe()(container.value)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#38bdf8')
      .atmosphereAltitude(0.15)
      .polygonsData(props.collection?.features ?? [])
      .polygonAltitude(0.004)
      .polygonCapColor(() => landColor())
      .polygonSideColor(() => 'rgba(0,0,0,0)')
      .polygonStrokeColor(() => (isDark.value ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.18)'))
      .pointLat((s: Stop) => s.lat)
      .pointLng((s: Stop) => s.lng)
      .pointColor((s: Stop) => COLORS[s.outcome])
      .pointAltitude(0.03)
      .pointRadius(0.9)
      .pointLabel((s: Stop) => `<b>#${s.round}</b> ${s.name}`)
      .arcStartLat((a: { from: Stop }) => a.from.lat)
      .arcStartLng((a: { from: Stop }) => a.from.lng)
      .arcEndLat((a: { to: Stop }) => a.to.lat)
      .arcEndLng((a: { to: Stop }) => a.to.lng)
      .arcColor((a: { from: Stop, to: Stop }) => [COLORS[a.from.outcome], COLORS[a.to.outcome]])
      .arcStroke(0.5)
      .arcAltitudeAutoScale(0.35)
      .arcDashLength(reduced ? 1 : 0.6)
      .arcDashGap(reduced ? 0 : 0.4)
      .arcDashAnimateTime(reduced ? 0 : 3000)
      // Nomor ronde di samping titik, supaya urutan rutenya terbaca tanpa
      // harus mengarahkan kursor ke tiap titik.
      .labelLat((s: Stop) => s.lat)
      .labelLng((s: Stop) => s.lng)
      .labelText((s: Stop) => String(s.round))
      .labelSize(() => labelSize)
      .labelDotRadius(0)
      .labelAltitude(0.035)
      .labelColor(() => (isDark.value ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.9)'))
      .labelResolution(3)
      .ringLat((s: Stop) => s.lat)
      .ringLng((s: Stop) => s.lng)
      .ringColor((s: Stop) => (tt: number) => `${COLORS[s.outcome]}${Math.round((1 - tt) * 200).toString(16).padStart(2, '0')}`)
      .ringMaxRadius(3)
      .ringPropagationSpeed(1.5)
      .ringRepeatPeriod(reduced ? 0 : 1600)
      .width(container.value.clientWidth)
      .height(container.value.clientHeight)

    globe.globeMaterial().color.set(oceanColor())
    const controls = globe.controls()
    controls.enableZoom = false
    controls.enablePan = false
    controls.enableDamping = true
    controls.autoRotate = false

    globe.pointOfView({ lat: 0, lng: 0, altitude: 3 }, 0)
    render()

    ro = new ResizeObserver(() => {
      if (!globe || !container.value) return
      globe.width(container.value.clientWidth).height(container.value.clientHeight)
    })
    ro.observe(container.value)
  }
  catch {
    failed.value = true
  }
})

watch(isDark, applyTheme)
watch(stops, render)

onBeforeUnmount(() => {
  ro?.disconnect()
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
  <section
    v-if="stops.length >= 2 && !failed"
    class="raycast-card overflow-hidden rounded-2xl shadow-xl"
    :aria-label="t('journey.title')"
  >
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 px-5 py-3.5">
      <div>
        <h2 class="font-mono text-xs font-bold uppercase tracking-[0.16em] text-slate-900 dark:text-slate-200">
          {{ t('journey.title') }}
        </h2>
        <p class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{{ t('journey.hint') }}</p>
      </div>
      <div class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-emerald-500" />{{ t('common.correct') }} {{ legend.correct }}</span>
        <span v-if="legend.near" class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-amber-500" />{{ t('common.near') }} {{ legend.near }}</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-rose-500" />{{ t('common.wrong') }} {{ legend.wrong }}</span>
      </div>
    </div>
    <div ref="container" class="journey-globe" />
  </section>
</template>

<style scoped>
.journey-globe {
  height: min(72vw, 400px);
  cursor: grab;
}

.journey-globe:active {
  cursor: grabbing;
}
</style>
