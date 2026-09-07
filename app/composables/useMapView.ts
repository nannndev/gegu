import type { PathOptions } from 'leaflet'

/** Mode tampilan peta yang bisa dipilih pemain. */
export type MapViewMode = 'vector' | 'terrain' | 'satellite' | 'blueprint'

export interface TileConfig {
  url: string
  attribution: string
  /** Opacity ubin; diturunkan supaya poligon soal tetap kontras. */
  opacity: number
  maxNativeZoom?: number
}

export interface MapTheme {
  /** Warna latar kanvas peta (di bawah ubin/poligon). */
  canvas: string
  tiles: TileConfig | null
  /** Negara tetangga di mode Indonesia. */
  context: PathOptions
  /** Daratan Indonesia sebagai backdrop di mode kecamatan. */
  contextLand: PathOptions
  baseWorld: PathOptions
  baseId: PathOptions
  /** Wilayah yang jadi pool soal di mode lokal. */
  activeLocal: PathOptions
  /** Wilayah di luar pool soal di mode lokal. */
  contextLocal: PathOptions
  hover: PathOptions
  mark: Record<'correct' | 'wrong' | 'target', PathOptions>
}

const MARK_VIVID: MapTheme['mark'] = {
  correct: { fillColor: '#15803d', fillOpacity: 1, color: '#86efac', weight: 3 },
  wrong: { fillColor: '#b91c1c', fillOpacity: 1, color: '#fca5a5', weight: 3 },
  target: { fillColor: '#d97706', fillOpacity: 1, color: '#fde047', weight: 3 },
}

/**
 * Di atas ubin foto/relief, poligon harus lebih transparan supaya petanya
 * kelihatan, tapi garis tepinya justru dipertebal agar batas tetap terbaca.
 */
const MARK_ON_TILES: MapTheme['mark'] = {
  correct: { fillColor: '#22c55e', fillOpacity: 0.55, color: '#bbf7d0', weight: 3.5 },
  wrong: { fillColor: '#ef4444', fillOpacity: 0.55, color: '#fecaca', weight: 3.5 },
  target: { fillColor: '#f59e0b', fillOpacity: 0.55, color: '#fef08a', weight: 3.5 },
}

const THEMES: Record<MapViewMode, MapTheme> = {
  /** Default: vektor gelap, tanpa ubin — paling cepat dan paling kontras. */
  vector: {
    canvas: '#09090b',
    tiles: null,
    context: { fillColor: '#111726', fillOpacity: 0.85, color: '#1e293b', weight: 0.75 },
    contextLand: { fillColor: '#141b2b', fillOpacity: 0.9, color: '#243247', weight: 0.9 },
    baseWorld: { fillColor: '#182032', fillOpacity: 0.95, color: '#334155', weight: 0.85 },
    baseId: { fillColor: '#182032', fillOpacity: 0.95, color: '#0284c7', weight: 1.2 },
    activeLocal: { fillColor: '#1a2744', fillOpacity: 0.95, color: '#38bdf8', weight: 2 },
    contextLocal: { fillColor: '#0b0f19', fillOpacity: 0.75, color: '#1e293b', weight: 0.75 },
    hover: { fillColor: '#0369a1', fillOpacity: 1, color: '#7dd3fc', weight: 2.5 },
    mark: MARK_VIVID,
  },

  /** Relief teduh: bentuk daratan terlihat, isian poligon ditipiskan. */
  terrain: {
    canvas: '#1b2430',
    tiles: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri — Source: Esri',
      opacity: 0.85,
      maxNativeZoom: 13,
    },
    context: { fillColor: '#0f172a', fillOpacity: 0.25, color: '#334155', weight: 0.6 },
    contextLand: { fillColor: '#0f172a', fillOpacity: 0.15, color: '#475569', weight: 0.8 },
    baseWorld: { fillColor: '#1e293b', fillOpacity: 0.3, color: '#64748b', weight: 1 },
    baseId: { fillColor: '#1e293b', fillOpacity: 0.3, color: '#0ea5e9', weight: 1.3 },
    activeLocal: { fillColor: '#0ea5e9', fillOpacity: 0.22, color: '#38bdf8', weight: 2.2 },
    contextLocal: { fillColor: '#0f172a', fillOpacity: 0.3, color: '#475569', weight: 0.8 },
    hover: { fillColor: '#0284c7', fillOpacity: 0.6, color: '#7dd3fc', weight: 3 },
    mark: MARK_ON_TILES,
  },

  /** Citra satelit: paling realistis, poligon jadi overlay tipis. */
  satellite: {
    canvas: '#0b1020',
    tiles: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
      opacity: 1,
      maxNativeZoom: 18,
    },
    context: { fillColor: '#000000', fillOpacity: 0.35, color: '#1e293b', weight: 0.6 },
    contextLand: { fillColor: '#000000', fillOpacity: 0.12, color: '#94a3b8', weight: 0.8 },
    baseWorld: { fillColor: '#0f172a', fillOpacity: 0.18, color: '#cbd5e1', weight: 1 },
    baseId: { fillColor: '#0f172a', fillOpacity: 0.18, color: '#38bdf8', weight: 1.4 },
    activeLocal: { fillColor: '#38bdf8', fillOpacity: 0.18, color: '#7dd3fc', weight: 2.4 },
    contextLocal: { fillColor: '#000000', fillOpacity: 0.45, color: '#64748b', weight: 0.8 },
    hover: { fillColor: '#38bdf8', fillOpacity: 0.5, color: '#e0f2fe', weight: 3.2 },
    mark: MARK_ON_TILES,
  },

  /** Cetak biru: garis tegas di latar terang, enak untuk membaca bentuk batas. */
  blueprint: {
    canvas: '#eef2f7',
    tiles: null,
    context: { fillColor: '#dde5ee', fillOpacity: 1, color: '#c3cfdd', weight: 0.7 },
    contextLand: { fillColor: '#e3eaf3', fillOpacity: 0.95, color: '#aab9cb', weight: 0.9 },
    baseWorld: { fillColor: '#f7fafc', fillOpacity: 1, color: '#7c8ea4', weight: 0.9 },
    baseId: { fillColor: '#f2f7fd', fillOpacity: 1, color: '#1d4ed8', weight: 1.2 },
    activeLocal: { fillColor: '#dbeafe', fillOpacity: 1, color: '#1d4ed8', weight: 2 },
    contextLocal: { fillColor: '#e6ebf2', fillOpacity: 0.95, color: '#aab9cb', weight: 0.8 },
    hover: { fillColor: '#93c5fd', fillOpacity: 1, color: '#1e3a8a', weight: 2.6 },
    mark: {
      correct: { fillColor: '#16a34a', fillOpacity: 0.9, color: '#14532d', weight: 3 },
      wrong: { fillColor: '#dc2626', fillOpacity: 0.9, color: '#7f1d1d', weight: 3 },
      target: { fillColor: '#f59e0b', fillOpacity: 0.9, color: '#78350f', weight: 3 },
    },
  },
}

export const MAP_VIEW_MODES: { id: MapViewMode, label: string, icon: string, hint: string }[] = [
  { id: 'vector', label: 'Vektor', icon: '◈', hint: 'Gelap & kontras tinggi' },
  { id: 'terrain', label: 'Relief', icon: '⛰', hint: 'Bentuk permukaan terlihat' },
  { id: 'satellite', label: 'Satelit', icon: '🛰', hint: 'Citra asli dari udara' },
  { id: 'blueprint', label: 'Cetak Biru', icon: '⬡', hint: 'Latar terang, garis tegas' },
]

export function mapTheme(mode: MapViewMode): MapTheme {
  return THEMES[mode] ?? THEMES.vector
}

const STORAGE_KEY = 'geoguess_map_view'

/** Pilihan view mode, dipertahankan antar sesi. */
export function useMapViewMode() {
  const mode = useState<MapViewMode>('map-view-mode', () => 'vector')

  onMounted(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as MapViewMode | null
      if (saved && saved in THEMES) mode.value = saved
    }
    catch {}
  })

  function setMode(next: MapViewMode) {
    mode.value = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    }
    catch {}
  }

  return { mode, setMode, modes: MAP_VIEW_MODES }
}
