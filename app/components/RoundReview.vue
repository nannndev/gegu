<script setup lang="ts">
import type { Position } from 'geojson'
import type { RegionCollection, RegionFeature } from '~/types/game'
import { regionId } from '~/composables/useGeoData'
import { featureCentroid } from '~/utils/centroid'

/**
 * Peta mini satu ronde di layar hasil: target, tebakan, dan garis di
 * antaranya. SVG polos, bukan Leaflet — layar hasil bisa menampilkannya
 * berkali-kali saat baris tabel diganti, dan memasang ulang peta tile
 * untuk tiap klik terasa berat dan berkedip.
 */
const props = defineProps<{
  collection: RegionCollection
  targetId: string
  answerId: string | null
}>()

const { t } = useI18n()

const W = 320
const H = 200
const PAD = 14

type Ring = Position[]

function ringsOf(f: RegionFeature): Ring[] {
  const g = f.geometry
  if (g.type === 'Polygon') return g.coordinates
  if (g.type === 'MultiPolygon') return g.coordinates.flat()
  return []
}

interface Box { minX: number, minY: number, maxX: number, maxY: number }

function boxOf(rings: Ring[]): Box {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x! < b.minX) b.minX = x!
      if (x! > b.maxX) b.maxX = x!
      if (y! < b.minY) b.minY = y!
      if (y! > b.maxY) b.maxY = y!
    }
  }
  return b
}

/**
 * Koleksinya berasal dari `useState`, jadi tiap koordinat dibungkus proxy
 * reaktif. Geometrinya tidak pernah diubah di sini — membacanya lewat proxy
 * cuma membuat ribuan titik jadi berlipat-lipat lebih lambat dibaca.
 */
const raw = computed(() => toRaw(props.collection))

const target = computed(() => raw.value.features.find(f => regionId(f) === props.targetId) ?? null)
const answer = computed(() =>
  props.answerId ? raw.value.features.find(f => regionId(f) === props.answerId) ?? null : null,
)

const view = computed(() => {
  const tgt = target.value
  if (!tgt) return null
  const focus = [...ringsOf(tgt), ...(answer.value ? ringsOf(answer.value) : [])]
  const b = boxOf(focus)
  // Beri ruang di sekitar fokus supaya tetangga ikut terlihat sebagai konteks.
  const spanX = Math.max(b.maxX - b.minX, 0.05)
  const spanY = Math.max(b.maxY - b.minY, 0.05)
  const margin = Math.max(spanX, spanY) * 0.35
  const frame = { minX: b.minX - margin, maxX: b.maxX + margin, minY: b.minY - margin, maxY: b.maxY + margin }

  // Proyeksi equirectangular dengan koreksi lintang tengah: cukup akurat
  // untuk bingkai sekecil ini, dan bentuk wilayah di lintang tinggi tidak
  // tampil gepeng melebar.
  const kx = Math.cos((((frame.minY + frame.maxY) / 2) * Math.PI) / 180)
  const fw = (frame.maxX - frame.minX) * kx
  const fh = frame.maxY - frame.minY
  const scale = Math.min((W - PAD * 2) / fw, (H - PAD * 2) / fh)
  const ox = (W - fw * scale) / 2
  const oy = (H - fh * scale) / 2
  const project = (x: number, y: number) => [
    ox + (x - frame.minX) * kx * scale,
    oy + (frame.maxY - y) * scale,
  ] as const

  const toPath = (rings: Ring[]) =>
    rings
      .map(ring => ring.map(([x, y], i) => {
        const [px, py] = project(x!, y!)
        return `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`
      }).join('') + 'Z')
      .join('')

  const context = raw.value.features
    .filter(f => f !== tgt && f !== answer.value)
    .map((f) => {
      const rings = ringsOf(f)
      const fb = boxOf(rings)
      const visible = fb.maxX >= frame.minX && fb.minX <= frame.maxX && fb.maxY >= frame.minY && fb.minY <= frame.maxY
      return visible ? toPath(rings) : ''
    })
    .filter(Boolean)

  const tc = featureCentroid(tgt.geometry)
  const ac = answer.value ? featureCentroid(answer.value.geometry) : null
  const line = tc && ac
    ? { a: project(ac.lng, ac.lat), b: project(tc.lng, tc.lat) }
    : null

  return {
    context,
    target: toPath(ringsOf(tgt)),
    answer: answer.value ? toPath(ringsOf(answer.value)) : '',
    line,
  }
})

const label = computed(() => {
  const tgt = target.value?.properties.name ?? ''
  const ans = answer.value?.properties.name
  return ans
    ? t('review.aria', { target: tgt, answer: ans })
    : t('review.ariaTarget', { target: tgt })
})
</script>

<template>
  <svg
    v-if="view"
    :viewBox="`0 0 ${W} ${H}`"
    class="round-review mx-auto h-auto max-h-56 w-full"
    role="img"
    :aria-label="label"
  >
    <path v-for="(d, i) in view.context" :key="i" :d="d" class="rr-context" />
    <path v-if="view.answer" :d="view.answer" class="rr-answer" />
    <path :d="view.target" class="rr-target" />
    <template v-if="view.line">
      <line
        :x1="view.line.a[0]" :y1="view.line.a[1]"
        :x2="view.line.b[0]" :y2="view.line.b[1]"
        class="rr-line"
      />
      <circle :cx="view.line.a[0]" :cy="view.line.a[1]" r="3.5" class="rr-dot-answer" />
      <circle :cx="view.line.b[0]" :cy="view.line.b[1]" r="3.5" class="rr-dot-target" />
    </template>
  </svg>
  <p v-else class="py-6 text-center text-xs text-slate-500 dark:text-slate-400">{{ t('review.unavailable') }}</p>
</template>

<style scoped>
.round-review {
  --rr-land: rgb(148 163 184 / 0.22);
  --rr-edge: rgb(100 116 139 / 0.45);
}
:global(.dark .round-review) {
  --rr-land: rgb(51 65 85 / 0.45);
  --rr-edge: rgb(100 116 139 / 0.5);
}
.rr-context {
  fill: var(--rr-land);
  stroke: var(--rr-edge);
  stroke-width: 0.6;
}
.rr-target {
  fill: color-mix(in srgb, var(--color-correct) 55%, transparent);
  stroke: var(--color-correct);
  stroke-width: 1.4;
}
/* Tebakan salah diberi arsir, bukan cuma merah — beda hijau/merah saja
   hilang bagi pemain buta warna merah-hijau. */
.rr-answer {
  fill: color-mix(in srgb, var(--color-wrong) 35%, transparent);
  stroke: var(--color-wrong);
  stroke-width: 1.4;
  stroke-dasharray: 3 2;
}
.rr-line {
  stroke: var(--color-target);
  stroke-width: 1.6;
  stroke-dasharray: 4 3;
}
.rr-dot-answer { fill: var(--color-wrong); }
.rr-dot-target { fill: var(--color-correct); }
</style>
