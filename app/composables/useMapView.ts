import type { PathOptions } from 'leaflet'

/** Mode tampilan peta yang bisa dipilih pemain. */
export type MapViewMode = 'vector' | 'terrain' | 'satellite' | 'blueprint'

/** Termasuk varian internal yang dipilih otomatis mengikuti tema aplikasi. */
export type MapThemeKey = MapViewMode | 'vector-light'

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
  /** Scope dunia memakai isian warna bendera per negara (mode tanpa ubin). */
  flagWorld?: boolean
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

/** Mark map on dark / cool canvas — emerald correct, crimson wrong, electric sky target. */
const MARK_VIVID: MapTheme['mark'] = {
  correct: { fillColor: '#059669', fillOpacity: 1, color: '#34d399', weight: 3 },
  wrong: { fillColor: '#dc2626', fillOpacity: 1, color: '#f87171', weight: 3 },
  target: { fillColor: '#0284c7', fillOpacity: 1, color: '#38bdf8', weight: 3 },
}

/**
 * Di atas ubin foto/relief, poligon lebih transparan supaya petanya kelihatan,
 * tapi garis tepinya dipertebal agar batas tetap terbaca jelas.
 */
const MARK_ON_TILES: MapTheme['mark'] = {
  correct: { fillColor: '#059669', fillOpacity: 0.55, color: '#34d399', weight: 3.5 },
  wrong: { fillColor: '#dc2626', fillOpacity: 0.55, color: '#f87171', weight: 3.5 },
  target: { fillColor: '#0284c7', fillOpacity: 0.55, color: '#e0f2fe', weight: 3.5 },
}

const THEMES: Record<MapThemeKey, MapTheme> = {
  /** Default: vektor gelap modern bernuansa midnight slate & electric sky — paling kontras & cool. */
  vector: {
    canvas: '#080b11',
    tiles: null,
    flagWorld: true,
    context: { fillColor: '#0c1017', fillOpacity: 0.9, color: '#1e293b', weight: 0.75 },
    contextLand: { fillColor: '#0f172a', fillOpacity: 0.92, color: '#334155', weight: 0.9 },
    baseWorld: { fillColor: '#0f172a', fillOpacity: 0.96, color: '#334155', weight: 0.85 },
    baseId: { fillColor: '#0f172a', fillOpacity: 0.96, color: '#0ea5e9', weight: 1.2 },
    activeLocal: { fillColor: '#1e293b', fillOpacity: 0.96, color: '#38bdf8', weight: 2 },
    contextLocal: { fillColor: '#080b11', fillOpacity: 0.8, color: '#1e293b', weight: 0.75 },
    hover: { fillColor: '#0369a1', fillOpacity: 0.95, color: '#38bdf8', weight: 2.5 },
    mark: MARK_VIVID,
  },

  /**
   * Padanan terang dari mode vektor. Tidak bisa dipilih pemain — dipakai
   * otomatis saat tema aplikasi terang, karena poligon `#0f172a` di atas
   * kanvas putih membuat peta terlihat seperti gambar rusak.
   */
  'vector-light': {
    canvas: '#eef2f7',
    tiles: null,
    flagWorld: true,
    context: { fillColor: '#dde4ed', fillOpacity: 1, color: '#c2ccd9', weight: 0.75 },
    contextLand: { fillColor: '#e6ecf3', fillOpacity: 1, color: '#a9b6c6', weight: 0.9 },
    baseWorld: { fillColor: '#ffffff', fillOpacity: 1, color: '#b6c2d1', weight: 0.85 },
    baseId: { fillColor: '#f8fbff', fillOpacity: 1, color: '#0284c7', weight: 1.2 },
    activeLocal: { fillColor: '#e0f2fe', fillOpacity: 1, color: '#0284c7', weight: 2 },
    contextLocal: { fillColor: '#e2e8f0', fillOpacity: 0.95, color: '#c2ccd9', weight: 0.75 },
    hover: { fillColor: '#7dd3fc', fillOpacity: 0.9, color: '#0369a1', weight: 2.5 },
    mark: {
      correct: { fillColor: '#059669', fillOpacity: 0.95, color: '#065f46', weight: 3 },
      wrong: { fillColor: '#e11d48', fillOpacity: 0.95, color: '#9f1239', weight: 3 },
      target: { fillColor: '#0284c7', fillOpacity: 0.95, color: '#075985', weight: 3 },
    },
  },

  /** Relief teduh: bentuk daratan terlihat, isian poligon ditipiskan. */
  terrain: {
    canvas: '#0f172a',
    tiles: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri — Source: Esri',
      opacity: 0.85,
      maxNativeZoom: 13,
    },
    context: { fillColor: '#080b11', fillOpacity: 0.25, color: '#334155', weight: 0.6 },
    contextLand: { fillColor: '#080b11', fillOpacity: 0.15, color: '#475569', weight: 0.8 },
    baseWorld: { fillColor: '#1e293b', fillOpacity: 0.3, color: '#64748b', weight: 1 },
    baseId: { fillColor: '#1e293b', fillOpacity: 0.3, color: '#0ea5e9', weight: 1.3 },
    activeLocal: { fillColor: '#0ea5e9', fillOpacity: 0.22, color: '#38bdf8', weight: 2.2 },
    contextLocal: { fillColor: '#080b11', fillOpacity: 0.3, color: '#334155', weight: 0.8 },
    hover: { fillColor: '#0284c7', fillOpacity: 0.6, color: '#38bdf8', weight: 3 },
    mark: MARK_ON_TILES,
  },

  /** Citra satelit: realistis, poligon jadi overlay bercahaya tipis. */
  satellite: {
    canvas: '#080b11',
    tiles: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
      opacity: 1,
      maxNativeZoom: 18,
    },
    context: { fillColor: '#000000', fillOpacity: 0.35, color: '#1e293b', weight: 0.6 },
    contextLand: { fillColor: '#000000', fillOpacity: 0.12, color: '#64748b', weight: 0.8 },
    baseWorld: { fillColor: '#080b11', fillOpacity: 0.18, color: '#0ea5e9', weight: 1 },
    baseId: { fillColor: '#080b11', fillOpacity: 0.18, color: '#38bdf8', weight: 1.4 },
    activeLocal: { fillColor: '#0ea5e9', fillOpacity: 0.18, color: '#38bdf8', weight: 2.4 },
    contextLocal: { fillColor: '#000000', fillOpacity: 0.45, color: '#334155', weight: 0.8 },
    hover: { fillColor: '#0284c7', fillOpacity: 0.5, color: '#e0f2fe', weight: 3.2 },
    mark: MARK_ON_TILES,
  },

  /** Cetak biru: garis tegas di latar terang perak/porselen. */
  blueprint: {
    canvas: '#f1f5f9',
    tiles: null,
    flagWorld: true,
    context: { fillColor: '#e2e8f0', fillOpacity: 1, color: '#cbd5e1', weight: 0.7 },
    contextLand: { fillColor: '#e2e8f0', fillOpacity: 0.95, color: '#94a3b8', weight: 0.9 },
    baseWorld: { fillColor: '#ffffff', fillOpacity: 1, color: '#cbd5e1', weight: 0.9 },
    baseId: { fillColor: '#f8fafc', fillOpacity: 1, color: '#0284c7', weight: 1.2 },
    activeLocal: { fillColor: '#e0f2fe', fillOpacity: 1, color: '#0284c7', weight: 2 },
    contextLocal: { fillColor: '#f1f5f9', fillOpacity: 0.95, color: '#cbd5e1', weight: 0.8 },
    hover: { fillColor: '#bae6fd', fillOpacity: 0.85, color: '#0284c7', weight: 2.6 },
    mark: {
      correct: { fillColor: '#10b981', fillOpacity: 0.9, color: '#047857', weight: 3 },
      wrong: { fillColor: '#ef4444', fillOpacity: 0.9, color: '#b91c1c', weight: 3 },
      target: { fillColor: '#0ea5e9', fillOpacity: 0.9, color: '#0369a1', weight: 3 },
    },
  },
}

export const MAP_VIEW_MODES: { id: MapViewMode, label: string, icon: string, hint: string }[] = [
  { id: 'vector', label: 'Vektor', icon: '◈', hint: 'Ikut tema, kontras tinggi' },
  { id: 'terrain', label: 'Relief', icon: '⛰', hint: 'Bentuk permukaan terlihat' },
  { id: 'satellite', label: 'Satelit', icon: '🛰', hint: 'Citra asli dari udara' },
  { id: 'blueprint', label: 'Cetak Biru', icon: '⬡', hint: 'Latar terang, garis tegas' },
]

/**
 * Tema poligon untuk satu mode tampilan.
 *
 * `isDark` hanya berpengaruh di mode vektor: mode relief & satelit punya ubin
 * fotonya sendiri (selalu gelap), dan cetak biru memang sengaja selalu terang.
 */
export function mapTheme(mode: MapThemeKey, isDark = true): MapTheme {
  if (mode === 'vector' && !isDark) return THEMES['vector-light']!
  return THEMES[mode] ?? THEMES.vector!
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
