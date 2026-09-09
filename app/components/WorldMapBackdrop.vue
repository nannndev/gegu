<script setup lang="ts">
import type { RegionCollection } from '~/types/game'
import { flagFillFor } from '~/utils/flagPalette'

/**
 * Peta dunia sebagai latar dekoratif, tiap negara diisi warna benderanya.
 *
 * Digambar sebagai SVG inline, bukan lewat Leaflet: latar ini statis dan tidak
 * bisa diklik, jadi memuat mesin peta penuh (plus tile pane, event handler, dan
 * layer manager-nya) hanya untuk satu gambar diam jelas berlebihan.
 *
 * GeoJSON-nya sudah ada di memori — `useGeoData().worldContext` mengisinya saat
 * dataset pertama dimuat — jadi latar ini tidak menambah unduhan sama sekali.
 */
const props = withDefaults(defineProps<{
  collection: RegionCollection | null
  /** Negara yang disorot; sisanya diredupkan. */
  highlightIso?: string | null
}>(), {
  highlightIso: null,
})

/** Lebar kanvas proyeksi; tinggi selalu setengahnya (equirectangular). */
const W = 2000
const H = 1000

/**
 * Cincin dengan bbox sekecil ini hilang di ukuran latar — dibuang supaya
 * jumlah node SVG turun tanpa perubahan yang kelihatan.
 */
const MIN_BBOX_DEG = 0.6

interface Shape {
  d: string
  fill: string
  iso: string
}

/** Bujur/lintang → koordinat SVG (equirectangular sederhana). */
function project(lon: number, lat: number): [number, number] {
  return [((lon + 180) / 360) * W, ((90 - lat) / 180) * H]
}

/** Luas bounding box cincin dalam derajat persegi. */
function ringArea(ring: number[][]): number {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const c of ring) {
    const lon = c[0]!, lat = c[1]!
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return (maxLon - minLon) * (maxLat - minLat)
}

function ringToPath(ring: number[][]): string {
  // Koordinat dibulatkan ke 1 desimal: pada kanvas 2000px, 0.1 unit jauh di
  // bawah satu piksel, tapi memangkas panjang atribut path secara signifikan.
  let d = ''
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = project(ring[i]![0]!, ring[i]![1]!)
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return `${d}Z`
}

const shapes = computed<Shape[]>(() => {
  const features = props.collection?.features
  if (!features?.length) return []

  const out: Shape[] = []
  for (const f of features) {
    const iso = f.properties.iso_a2 ?? ''
    const fill = flagFillFor(iso)?.fill ?? '#64748b'
    const g = f.geometry
    if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue

    // Hanya cincin luar tiap poligon. Lubang (mis. Lesotho di Afrika Selatan)
    // tetap tergambar benar karena negara di dalamnya adalah feature sendiri
    // yang digambar setelahnya.
    const polys = g.type === 'Polygon'
      ? [g.coordinates as number[][][]]
      : (g.coordinates as number[][][][])

    const rings = polys
      .map(poly => poly[0])
      .filter((ring): ring is number[][] => Boolean(ring) && ring!.length >= 4)
    if (!rings.length) continue

    // Cincin kecil dibuang, tapi cincin terbesar tiap negara selalu ikut —
    // tanpa pengecualian ini negara mungil seperti Luxembourg (±0,55 derajat²)
    // hilang sama sekali dari peta.
    let largest = rings[0]!
    let largestArea = ringArea(largest)
    for (const ring of rings.slice(1)) {
      const area = ringArea(ring)
      if (area > largestArea) {
        largest = ring
        largestArea = area
      }
    }

    const parts = rings
      .filter(ring => ring === largest || ringArea(ring) >= MIN_BBOX_DEG)
      .map(ringToPath)

    if (parts.length) out.push({ d: parts.join(''), fill, iso })
  }
  return out
})
</script>

<template>
  <svg
    class="world-backdrop"
    :viewBox="`0 0 ${W} ${H}`"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
    focusable="false"
  >
    <g class="world-backdrop-shapes">
      <path
        v-for="s in shapes"
        :key="s.iso || s.d.slice(0, 12)"
        :d="s.d"
        :fill="s.fill"
        :class="highlightIso && s.iso === highlightIso ? 'is-highlight' : ''"
      />
    </g>
  </svg>
</template>

<style scoped>
.world-backdrop {
  position: absolute;
  inset: 0;
  height: 100%;
  width: 100%;
}

/*
 * Peta ini latar, bukan konten: opasitasnya ditahan rendah supaya teks kartu
 * di atasnya tetap kebaca. Angka terang lebih kecil karena warna bendera
 * pekat di atas kertas putih jauh lebih menonjol daripada di atas kanvas gelap.
 */
.world-backdrop-shapes {
  opacity: 0.38;
}

:global(.dark) .world-backdrop-shapes {
  opacity: 0.5;
}

.world-backdrop-shapes path {
  stroke: rgb(255 255 255 / 0.25);
  stroke-width: 0.7;
  vector-effect: non-scaling-stroke;
  transition: opacity 0.5s ease;
}

:global(.dark) .world-backdrop-shapes path {
  stroke: rgb(255 255 255 / 0.14);
}

/* Saat ada negara yang disorot, sisanya diredupkan. */
.world-backdrop-shapes:has(.is-highlight) path {
  opacity: 0.35;
}

.world-backdrop-shapes path.is-highlight {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .world-backdrop-shapes path {
    transition: none;
  }
}
</style>
