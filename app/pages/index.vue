<script setup lang="ts">
import type { GameMode, DatasetScope, RegionItem, RegionLevel } from '~/types/game'
import type { SearchOption } from '~/components/SearchSelect.vue'

const {
  regions,
  items,
  availableProvinces,
  availableCities,
  kecamatanProvinces,
  activeKecamatanCity,
  pending,
  error,
  load,
  setScope,
  setKecamatanCity,
  itemsInRegion,
  buildMixedPool,
} = useGeoData()
const game = useGameStore()
const { soundEnabled, toggleSound, playClick } = useAudio()
const { isDark, toggleTheme } = useTheme()

const primaryScope = ref<'world' | 'indonesia'>('indonesia')
const indonesiaLevel = ref<'provinces' | 'kabupaten' | 'kecamatan' | 'mixed'>('kecamatan')
const selectedProvince = ref('DKI Jakarta')
/** Nama kota kecamatan yang aktif; dipakai sebagai regionFilter pool. */
const selectedCity = ref('')
const regionFilter = ref('Jakarta Barat')
const selectedMode = ref<GameMode>('A')
const timerEnabled = ref(false)
const selectedRounds = ref(8)
const showRules = ref(false)

const stats = reactive({
  bestScore: 0,
  bestStreak: 0,
  gamesPlayed: 0,
})

const quickProvinces = ['DKI Jakarta', 'Bali', 'Jawa Barat', 'DI Yogyakarta', 'Jawa Timur', 'Sumatera Utara']

/** Pintasan kota populer untuk akses 1-klik */
const quickCities = computed(() => {
  const dki = availableCities.value.filter(c => /Daerah Khusus|Jakarta/i.test(c.province))
  if (dki.length) return dki
  return availableCities.value.slice(0, 5)
})

const popularMajorCities = computed(() => {
  const targets = ['Surabaya', 'Bandung', 'Medan', 'Denpasar', 'Semarang', 'Makassar']
  return availableCities.value.filter(c =>
    targets.some(t => c.city.toLowerCase().includes(t.toLowerCase())),
  )
})

const activeScope = computed<DatasetScope>(() => {
  if (primaryScope.value === 'world') return 'world'
  if (indonesiaLevel.value === 'provinces') return 'id-provinces'
  if (indonesiaLevel.value === 'kabupaten') return 'id-kabupaten'
  if (indonesiaLevel.value === 'mixed') return 'id-mixed'
  return 'id-kecamatan'
})

// Preload mode kecamatan: indeks nasional + satu kota default siap dipakai.
await load('district', 'id-kecamatan')

/** Provinsi terpilih di mode kecamatan; menyaring daftar kota di bawahnya. */
const kecamatanProvince = ref(activeKecamatanCity.value?.province ?? 'Daerah Khusus Ibukota Jakarta')
selectedCity.value = activeKecamatanCity.value?.city ?? ''
regionFilter.value = 'all'
selectedRounds.value = Math.min(10, activeKecamatanCity.value?.count ?? 8)

/**
 * Pindah provinsi lewat dropdown: muat kota pertama di provinsi itu.
 */
watch(kecamatanProvince, async (prov) => {
  if (activeScope.value !== 'id-kecamatan') return
  if (activeKecamatanCity.value?.province === prov) return
  const first = availableCities.value.find(c => c.province === prov)
  if (first) await selectCity(first.id)
})

async function selectPrimaryScope(scope: 'world' | 'indonesia') {
  if (primaryScope.value === scope) return
  primaryScope.value = scope
  playClick()
  await syncScope()
}

async function selectIndonesiaLevel(lvl: 'provinces' | 'kabupaten' | 'kecamatan' | 'mixed') {
  if (indonesiaLevel.value === lvl) return
  indonesiaLevel.value = lvl
  playClick()
  await syncScope()
}

async function syncScope() {
  const scope = activeScope.value
  if (scope !== 'id-mixed') await setScope(scope)

  if (scope === 'id-mixed') {
    regionFilter.value = 'all'
    selectedRounds.value = 10
  }
  else if (scope === 'id-kecamatan') {
    selectedCity.value = activeKecamatanCity.value?.city ?? ''
    regionFilter.value = 'all'
    selectedRounds.value = Math.min(10, poolSize.value || 8)
  }
  else if (scope === 'id-kabupaten') {
    regionFilter.value = selectedProvince.value
    selectedRounds.value = Math.min(10, poolSize.value || 5)
  }
  else {
    regionFilter.value = 'all'
    selectedRounds.value = 10
  }
}

function selectProvince(prov: string) {
  selectedProvince.value = prov
  if (activeScope.value === 'id-kabupaten') {
    regionFilter.value = prov
    selectedRounds.value = Math.min(10, itemsInRegion(prov).length || 5)
  }
  playClick()
}

/** Ganti kota: unduh kota spesifik */
async function selectCity(cityId: string) {
  playClick()
  await setKecamatanCity(cityId)
  selectedCity.value = activeKecamatanCity.value?.city ?? ''
  if (activeKecamatanCity.value) kecamatanProvince.value = activeKecamatanCity.value.province
  regionFilter.value = 'all'
  selectedRounds.value = Math.min(10, poolSize.value || 8)
}

function selectMode(mode: GameMode) {
  if (selectedMode.value === mode) return
  selectedMode.value = mode
  playClick()
}

function toggleTimer() {
  timerEnabled.value = !timerEnabled.value
  playClick()
}

watch(selectedProvince, (prov) => {
  if (activeScope.value === 'id-kabupaten') {
    regionFilter.value = prov
    selectedRounds.value = Math.min(10, itemsInRegion(prov).length || 5)
  }
})

/** Opsi untuk SearchSelect: provinsi di panel kecamatan. */
const provinceOptions = computed<SearchOption[]>(() =>
  kecamatanProvinces.value.map(prov => ({
    value: prov,
    label: prov,
    count: availableCities.value.filter(c => c.province === prov).length,
  })),
)

/** Opsi provinsi untuk level kab/kota, beserta jumlah kabupatennya. */
const kabupatenProvinceOptions = computed<SearchOption[]>(() =>
  availableProvinces.value.map(prov => ({
    value: prov.name,
    label: prov.name,
    count: prov.count,
  })),
)

/** Opsi filter benua/pulau, dengan "semua" di paling atas. */
const regionFilterOptions = computed<SearchOption[]>(() => [
  {
    value: 'all',
    label: activeScope.value === 'id-provinces' ? 'Semua provinsi' : 'Semua benua',
    count: items.value.length,
  },
  ...regions.value.map(r => ({
    value: r,
    label: r,
    count: itemsInRegion(r).length,
  })),
])

/** Level yang diikutkan di mode campuran. */
const mixedLevels = ref<{ province: boolean, kabupaten: boolean, kecamatan: boolean }>({
  province: true,
  kabupaten: true,
  kecamatan: true,
})
const mixedCityCount = ref(4)
const mixedPending = ref(false)

const mixedLevelCount = computed(() =>
  Object.values(mixedLevels.value).filter(Boolean).length,
)

function toggleMixedLevel(key: 'province' | 'kabupaten' | 'kecamatan') {
  if (mixedLevels.value[key] && mixedLevelCount.value === 1) return
  mixedLevels.value[key] = !mixedLevels.value[key]
  playClick()
}

const mixedEstimate = computed(() => {
  let n = 0
  if (mixedLevels.value.province) n += 38
  if (mixedLevels.value.kabupaten) n += 514
  if (mixedLevels.value.kecamatan) n += mixedCityCount.value * 13
  return n
})

const poolSize = computed(() =>
  activeScope.value === 'id-mixed'
    ? mixedEstimate.value
    : itemsInRegion(regionFilter.value).length,
)

const activeProvinceCities = computed(() => {
  if (activeScope.value !== 'id-kabupaten') return []
  return itemsInRegion(selectedProvince.value)
})

const activeCityDistricts = computed(() => {
  if (activeScope.value !== 'id-kecamatan') return []
  return itemsInRegion('all')
})

const activeProvinceExampleCity = computed(() => {
  if (activeScope.value === 'id-kecamatan') {
    const districts = activeCityDistricts.value
    if (!districts.length) return 'kecamatan setempat'
    if (districts.length >= 2) return `${districts[0]?.name} atau ${districts[1]?.name}`
    return districts[0]?.name || 'kecamatan setempat'
  }
  const cities = activeProvinceCities.value
  if (!cities.length) return 'wilayah setempat'
  if (cities.length >= 2) return `${cities[0]?.name} atau ${cities[1]?.name}`
  return cities[0]?.name || 'wilayah setempat'
})

const availableRoundOptions = computed(() => {
  const total = poolSize.value
  if (total <= 5) return [{ label: `Semua (${total})`, value: total }]
  if (total <= 10) {
    return [
      { label: '5', value: 5 },
      { label: `Semua (${total})`, value: total },
    ]
  }
  return [
    { label: '5', value: 5 },
    { label: '10', value: 10 },
    { label: total <= 20 ? `Semua (${total})` : '20', value: Math.min(20, total) },
  ]
})

watch(availableRoundOptions, (options) => {
  if (!options.length) return
  if (!options.some(o => o.value === selectedRounds.value)) {
    selectedRounds.value = options[options.length - 1]!.value
  }
})

const scopeLabel = computed(() => {
  if (activeScope.value === 'world') {
    return regionFilter.value === 'all' ? 'Seluruh Dunia' : regionFilter.value
  }
  if (activeScope.value === 'id-provinces') {
    return regionFilter.value === 'all' ? 'Indonesia · 38 Provinsi' : `Indonesia · ${regionFilter.value}`
  }
  if (activeScope.value === 'id-kabupaten') {
    return `${selectedProvince.value} · Kab/Kota`
  }
  if (activeScope.value === 'id-mixed') {
    const parts = []
    if (mixedLevels.value.province) parts.push('Provinsi')
    if (mixedLevels.value.kabupaten) parts.push('Kab/Kota')
    if (mixedLevels.value.kecamatan) parts.push('Kecamatan')
    return `Campuran · ${parts.join(' + ')}`
  }
  return `${selectedCity.value || 'Kota'} · Kecamatan`
})

const unitLabel = computed(() => {
  if (activeScope.value === 'world') return 'negara'
  if (activeScope.value === 'id-provinces') return 'provinsi'
  if (activeScope.value === 'id-kabupaten') return 'kab/kota'
  if (activeScope.value === 'id-mixed') return 'wilayah'
  return 'kecamatan'
})

const modeLabel = computed(() =>
  selectedMode.value === 'A' ? 'Klik Petanya' : 'Pilih Nama',
)

const canStart = computed(() =>
  !pending.value && !mixedPending.value && poolSize.value > 0 && !error.value,
)

async function start() {
  playClick()

  let pool: RegionItem[]
  if (activeScope.value === 'id-mixed') {
    mixedPending.value = true
    try {
      const levels: RegionLevel[] = []
      if (mixedLevels.value.province) levels.push('province')
      if (mixedLevels.value.kabupaten) levels.push('country')
      if (mixedLevels.value.kecamatan) levels.push('district')
      pool = await buildMixedPool({ levels, cityCount: mixedCityCount.value })
    }
    finally {
      mixedPending.value = false
    }
  }
  else {
    pool = itemsInRegion(regionFilter.value)
  }

  if (!pool.length) return
  game.startGame({
    mode: selectedMode.value,
    pool,
    regionFilter: regionFilter.value,
    timerEnabled: timerEnabled.value,
    roundsCount: selectedRounds.value,
    scope: activeScope.value,
    provinceName: activeScope.value === 'id-kabupaten' ? selectedProvince.value : '',
    cityName: activeScope.value === 'id-kecamatan' ? selectedCity.value : '',
  })
  navigateTo({ path: '/play', query: { mode: selectedMode.value } })
}

const INTERACTIVE_TAGS = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'SUMMARY', 'A']

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' || !canStart.value) return
  const el = e.target as HTMLElement | null
  if (el && (INTERACTIVE_TAGS.includes(el.tagName) || el.isContentEditable)) return
  e.preventDefault()
  start()
}

onMounted(() => {
  stats.bestScore = Number(localStorage.getItem('geoguess_best_score') || '0')
  stats.bestStreak = Number(localStorage.getItem('geoguess_best_streak') || '0')
  stats.gamesPlayed = Number(localStorage.getItem('geoguess_games_played') || '0')
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="relative flex min-h-dvh flex-col bg-slate-50 dark:bg-[#080b11] text-slate-900 dark:text-slate-100 selection:bg-sky-500/20 selection:text-sky-500 cool-grid-bg transition-colors duration-200">
    <!-- Ambient glowing light backdrop -->
    <div
      class="pointer-events-none fixed inset-0 transition-opacity duration-700"
      :class="primaryScope === 'world' ? 'bg-ambient-glow' : 'bg-ambient-indonesia'"
    />

    <!-- ── Modern Header ──────────────────────────────────────── -->
    <header class="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#080b11]/80 backdrop-blur-md">
      <div class="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <!-- Brand / Logo -->
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 via-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20 ring-1 ring-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-display text-base font-black tracking-tight text-slate-900 dark:text-white">GeoGuesser</span>
              <span class="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                PRO
              </span>
            </div>
            <p class="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400">Geografi Interaktif Dunia & Indonesia</p>
          </div>
        </div>

        <!-- Controls: Sound + Dark / Light Mode -->
        <div class="flex items-center gap-2">
          <!-- Audio Toggle -->
          <button
            type="button"
            class="focusable flex h-9 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
            :aria-pressed="soundEnabled"
            :title="soundEnabled ? 'Matikan suara efek' : 'Aktifkan suara efek'"
            @click="toggleSound"
          >
            <svg v-if="soundEnabled" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
            </svg>
            <span class="hidden md:inline">{{ soundEnabled ? 'Suara' : 'Mute' }}</span>
          </button>

          <!-- Dark / Light Mode Toggle Button -->
          <button
            type="button"
            class="focusable flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 shadow-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
            :title="isDark ? 'Beralih ke Mode Terang (Light Mode)' : 'Beralih ke Mode Gelap (Dark Mode)'"
            @click="toggleTheme"
          >
            <!-- Sun icon when dark -->
            <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <!-- Moon icon when light -->
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- ── Main Content Bento Grid ────────────────────────────── -->
    <main class="relative z-10 mx-auto w-full max-w-[1400px] flex-1 px-4 pb-12 pt-6 sm:px-6 sm:py-8 lg:px-10">
      <!-- Cool Hero Banner with Live Radar -->
      <div class="menu-rise relative mb-8 grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div class="max-w-3xl">
          <div class="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            <span class="h-1.5 w-1.5 rounded-full bg-sky-500 animate-ping" />
            Latihan Peta & Batas Wilayah Offline
          </div>

          <h1 class="font-display text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Tebak bentuk & lokasi <span class="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 via-indigo-500 to-cyan-400">wilayah impianmu</span>
          </h1>

          <p class="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Kuis geografi presisi tinggi. Dari kecamatan di kotamu sampai negara di seberang benua. Siapkan insting spasialmu dan mulai ekspedisi sekarang.
          </p>

          <!-- Quick Scope Summary Counters -->
          <div class="mt-5 flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-2.5 py-1 text-slate-700 dark:text-slate-300 shadow-sm">
              🇮🇩 6.644 Kecamatan
            </span>
            <span class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-2.5 py-1 text-slate-700 dark:text-slate-300 shadow-sm">
              🏙️ 514 Kab / Kota
            </span>
            <span class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-2.5 py-1 text-slate-700 dark:text-slate-300 shadow-sm">
              🏛️ 38 Provinsi
            </span>
            <span class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-2.5 py-1 text-slate-700 dark:text-slate-300 shadow-sm">
              🌍 195 Negara Dunia
            </span>
          </div>
        </div>

        <!-- Mini Cockpit Radar -->
        <div class="map-radar hidden min-h-44 rounded-2xl p-5 lg:block" aria-hidden="true">
          <div class="relative z-10 flex h-full flex-col justify-between">
            <div class="flex items-center justify-between font-mono text-xs font-semibold">
              <span class="truncate text-slate-700 dark:text-slate-200 max-w-[200px]">{{ scopeLabel }}</span>
              <span class="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-600 dark:text-sky-400">{{ poolSize }} {{ unitLabel }}</span>
            </div>

            <div class="grid grid-cols-3 gap-2 text-center mt-4">
              <div class="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-950/60 p-2 shadow-sm">
                <p class="text-[10px] uppercase font-bold text-slate-400">Mode</p>
                <p class="mt-0.5 truncate text-xs font-bold text-slate-900 dark:text-white">{{ selectedMode === 'A' ? 'Klik Peta' : 'Pilih Nama' }}</p>
              </div>
              <div class="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-950/60 p-2 shadow-sm">
                <p class="text-[10px] uppercase font-bold text-slate-400">Ronde</p>
                <p class="mt-0.5 font-mono text-xs font-bold text-slate-900 dark:text-white">{{ Math.min(selectedRounds, poolSize) }}</p>
              </div>
              <div class="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-slate-950/60 p-2 shadow-sm">
                <p class="text-[10px] uppercase font-bold text-slate-400">Waktu</p>
                <p class="mt-0.5 text-xs font-bold" :class="timerEnabled ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'">
                  {{ timerEnabled ? '15 dtk' : 'Santai' }}
                </p>
              </div>
            </div>
          </div>
          <span class="radar-pin is-hot left-[65%] top-[25%]">ID</span>
          <span class="radar-pin left-[28%] top-[35%]">A</span>
          <span class="radar-pin left-[52%] top-[65%]">B</span>
        </div>
      </div>

      <!-- Error notification if dataset fails -->
      <div v-if="error" class="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{{ error }}</span>
      </div>

      <!-- ══ Bento Box Setup Grid ══ -->
      <div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <!-- ── STEP 1: Wilayah Peta (Territory Picker) ── -->
        <section class="step-card menu-rise p-5 sm:p-6 lg:col-span-7 xl:col-span-8" style="animation-delay: 40ms" aria-labelledby="map-title">
          <div class="mb-5 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 pb-3.5">
            <div class="flex items-center gap-3">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                1
              </span>
              <div>
                <h2 id="map-title" class="text-sm font-bold text-slate-900 dark:text-white">Pilih Wilayah</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400">Tentukan peta dan tingkat cakupan yang mau kamu uji.</p>
              </div>
            </div>

            <span class="hidden sm:inline-flex rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:text-slate-400">
              {{ poolSize }} wilayah siap
            </span>
          </div>

          <!-- Two Main Scope Cards: Dunia vs Indonesia -->
          <div class="grid gap-3.5 sm:grid-cols-2" role="radiogroup" aria-label="Cakupan Utama">
            <!-- Dunia Option -->
            <button
              type="button"
              role="radio"
              class="pick-card focusable flex items-start gap-3.5 p-4 text-left"
              :aria-checked="primaryScope === 'world'"
              :class="primaryScope === 'world' ? '!border-sky-500/60 !bg-sky-500/10 ring-2 ring-sky-500/20' : ''"
              @click="selectPrimaryScope('world')"
            >
              <span
                class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition"
                :class="primaryScope === 'world' ? 'border-sky-500/50 bg-sky-500/20 text-sky-600 dark:text-sky-400' : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 text-slate-500'"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </span>
              <span class="min-w-0 flex-1">
                <span class="font-display text-sm font-bold text-slate-900 dark:text-white">Seluruh Dunia</span>
                <span class="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">195 negara lintas benua.</span>
                <span
                  v-if="primaryScope === 'world'"
                  class="mt-2 inline-flex items-center gap-1 rounded-md border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-600 dark:text-sky-400"
                >✓ Aktif</span>
              </span>
            </button>

            <!-- Indonesia Option -->
            <button
              type="button"
              role="radio"
              class="pick-card focusable flex items-start gap-3.5 p-4 text-left"
              :aria-checked="primaryScope === 'indonesia'"
              :class="primaryScope === 'indonesia' ? '!border-rose-500/60 !bg-rose-500/10 ring-2 ring-rose-500/20' : ''"
              @click="selectPrimaryScope('indonesia')"
            >
              <span
                class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xl transition"
                :class="primaryScope === 'indonesia' ? 'border-rose-500/50 bg-rose-500/15' : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80'"
              >🇮🇩</span>
              <span class="min-w-0 flex-1">
                <span class="font-display text-sm font-bold text-slate-900 dark:text-white">Indonesia</span>
                <span class="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">Provinsi, kab/kota, sampai kecamatan.</span>
                <span
                  v-if="primaryScope === 'indonesia'"
                  class="mt-2 inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-600 dark:text-rose-400"
                >✓ Aktif</span>
              </span>
            </button>
          </div>

          <!-- Filter Benua / Pulau (Dunia & 38 Provinsi) -->
          <div
            v-if="activeScope !== 'id-kabupaten' && activeScope !== 'id-kecamatan' && activeScope !== 'id-mixed'"
            class="mt-5"
          >
            <label class="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {{ activeScope === 'id-provinces' ? 'Saring Kepulauan' : 'Saring Benua' }}
            </label>
            <div class="mt-2 max-w-sm">
              <SearchSelect
                v-model="regionFilter"
                :options="regionFilterOptions"
                :label="activeScope === 'id-provinces' ? 'Saring Kepulauan' : 'Saring Benua'"
                accent="sky"
                :search-placeholder="activeScope === 'id-provinces' ? 'Cari kepulauan…' : 'Cari benua…'"
              />
            </div>
          </div>

          <!-- ── Sub-opsi Indonesia: Segmented Level Picker ── -->
          <div v-if="primaryScope === 'indonesia'" class="mt-5 space-y-4">
            <div class="seg-track grid grid-cols-2 sm:grid-cols-4" role="radiogroup" aria-label="Tingkat wilayah Indonesia">
              <button
                type="button"
                role="radio"
                class="seg-item focusable text-center justify-center"
                :aria-checked="indonesiaLevel === 'provinces'"
                :class="indonesiaLevel === 'provinces' ? '!bg-white dark:!bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm' : ''"
                @click="selectIndonesiaLevel('provinces')"
              >
                <span>🏛️</span> 38 Provinsi
              </button>
              <button
                type="button"
                role="radio"
                class="seg-item focusable text-center justify-center"
                :aria-checked="indonesiaLevel === 'kabupaten'"
                :class="indonesiaLevel === 'kabupaten' ? '!bg-white dark:!bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm' : ''"
                @click="selectIndonesiaLevel('kabupaten')"
              >
                <span>🏙️</span> Kab / Kota
              </button>
              <button
                type="button"
                role="radio"
                class="seg-item focusable text-center justify-center"
                :aria-checked="indonesiaLevel === 'kecamatan'"
                :class="indonesiaLevel === 'kecamatan' ? '!bg-white dark:!bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm' : ''"
                @click="selectIndonesiaLevel('kecamatan')"
              >
                <span>🏘️</span> Kecamatan
              </button>
              <button
                type="button"
                role="radio"
                class="seg-item focusable text-center justify-center"
                :aria-checked="indonesiaLevel === 'mixed'"
                :class="indonesiaLevel === 'mixed' ? '!bg-white dark:!bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm' : ''"
                @click="selectIndonesiaLevel('mixed')"
              >
                <span>🎲</span> Campuran
              </button>
            </div>

            <!-- LEVEL: KECAMATAN (Fitur Unggulan) -->
            <div v-if="indonesiaLevel === 'kecamatan'" class="space-y-4 rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] dark:bg-sky-950/20 p-4 sm:p-5 shadow-sm">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-900 dark:text-white">Pilih Kabupaten / Kota</span>
                    <span class="rounded-full bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-600 dark:text-sky-400">Level Mikro</span>
                  </div>
                  <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Cari kota apa saja di Indonesia untuk menebak batas-batas kecamatannya.
                  </p>
                </div>

                <div class="w-full space-y-2 sm:w-80">
                  <!-- Provinsi filter dropdown -->
                  <SearchSelect
                    v-model="kecamatanProvince"
                    :options="provinceOptions"
                    label="Pilih Provinsi"
                    accent="sky"
                    search-placeholder="Cari provinsi…"
                  />

                  <!-- CityPicker Combobox (Search across 514 cities) -->
                  <CityPicker
                    :cities="availableCities"
                    :provinces="kecamatanProvinces"
                    :selected-id="activeKecamatanCity?.id ?? null"
                    :province="kecamatanProvince"
                    :disabled="pending"
                    @select="selectCity"
                  />
                </div>
              </div>

              <!-- Quick chips for popular cities -->
              <div class="space-y-2 border-t border-slate-200/80 dark:border-slate-800/80 pt-3">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">DKI Jakarta:</span>
                  <button
                    v-for="c in quickCities"
                    :key="c.id"
                    type="button"
                    class="focusable rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition"
                    :aria-pressed="activeKecamatanCity?.id === c.id"
                    :class="activeKecamatanCity?.id === c.id
                      ? 'border-sky-500 bg-sky-600 text-white shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:border-sky-500/40'"
                    @click="selectCity(c.id)"
                  >
                    {{ c.city.replace(/^(Kota|Kabupaten)( Administrasi)? /, '') }}
                  </button>
                </div>

                <!-- Major regional cities chips -->
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">Kota Lain:</span>
                  <button
                    v-for="c in popularMajorCities"
                    :key="c.id"
                    type="button"
                    class="focusable rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition"
                    :aria-pressed="activeKecamatanCity?.id === c.id"
                    :class="activeKecamatanCity?.id === c.id
                      ? 'border-sky-500 bg-sky-600 text-white shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:border-sky-500/40'"
                    @click="selectCity(c.id)"
                  >
                    {{ c.city.replace(/^(Kota|Kabupaten)( Administrasi)? /, '') }}
                  </button>
                </div>
              </div>

              <!-- Live Kecamatan Preview Badges Strip (e.g. Jakarta Barat's 8 subdistricts) -->
              <div class="rounded-xl border border-sky-500/30 bg-white/80 dark:bg-slate-900/80 p-3.5 shadow-sm">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span class="text-xs font-bold text-slate-900 dark:text-white">
                      {{ activeCityDistricts.length }} Kecamatan di {{ selectedCity }}
                    </span>
                  </div>
                  <span class="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    Offline GeoJSON Siap
                  </span>
                </div>

                <div class="mt-2.5 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1">
                  <span
                    v-for="d in activeCityDistricts"
                    :key="d.id"
                    class="rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 font-mono text-[11px] font-medium text-sky-700 dark:text-sky-300"
                  >
                    {{ d.name }}
                  </span>
                </div>
              </div>
            </div>

            <!-- LEVEL: KABUPATEN / KOTA -->
            <div v-if="indonesiaLevel === 'kabupaten'" class="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-4 sm:p-5 shadow-sm">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                  <label class="text-xs font-bold text-slate-900 dark:text-white">Pilih Provinsi Induk</label>
                  <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Soal akan mengambil seluruh kab/kota di provinsi ini.</p>
                </div>

                <div class="w-full sm:w-64">
                  <SearchSelect
                    v-model="selectedProvince"
                    :options="kabupatenProvinceOptions"
                    label="Pilih provinsi"
                    accent="sky"
                    search-placeholder="Cari provinsi…"
                  />
                </div>
              </div>

              <!-- Quick pick popular provinces -->
              <div class="flex flex-wrap items-center gap-1.5 border-t border-slate-200/80 dark:border-slate-800/80 pt-3">
                <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">Populer:</span>
                <button
                  v-for="prov in quickProvinces"
                  :key="prov"
                  type="button"
                  class="focusable rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition"
                  :aria-pressed="selectedProvince === prov"
                  :class="selectedProvince === prov
                    ? 'border-sky-500 bg-sky-600 text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-sky-500/40'"
                  @click="selectProvince(prov)"
                >
                  {{ prov }}
                </button>
              </div>

              <!-- Preview kab/kota -->
              <details class="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3">
                <summary class="focusable flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white [&::-webkit-details-marker]:hidden">
                  <span>Lihat {{ activeProvinceCities.length }} wilayah di {{ selectedProvince }}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform group-open:rotate-180 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </summary>
                <div class="mt-2.5 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1 pt-1">
                  <span
                    v-for="city in activeProvinceCities"
                    :key="city.id"
                    class="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:text-slate-300"
                  >
                    {{ city.name }}
                  </span>
                </div>
              </details>
            </div>

            <!-- LEVEL: CAMPURAN (Multi-tier) -->
            <div v-if="indonesiaLevel === 'mixed'" class="space-y-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-950/20 p-4 sm:p-5 shadow-sm">
              <div class="flex items-center justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-900 dark:text-white">Mode Campuran Acak</span>
                    <span class="rounded-full bg-indigo-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Multi-Tingkat</span>
                  </div>
                  <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Setiap ronde akan berganti secara dinamis antara provinsi, kab/kota, dan kecamatan.
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="lvl in [
                    { key: 'province' as const, label: 'Provinsi', icon: '🏛️', n: 38 },
                    { key: 'kabupaten' as const, label: 'Kab/Kota', icon: '🏙️', n: 514 },
                    { key: 'kecamatan' as const, label: 'Kecamatan', icon: '🏘️', n: mixedCityCount * 13 },
                  ]"
                  :key="lvl.key"
                  type="button"
                  class="focusable rounded-xl border p-3 text-center transition"
                  :aria-pressed="mixedLevels[lvl.key]"
                  :class="mixedLevels[lvl.key]
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'"
                  @click="toggleMixedLevel(lvl.key)"
                >
                  <span class="block text-base" aria-hidden="true">{{ lvl.icon }}</span>
                  <span class="mt-1 block text-xs font-bold">{{ lvl.label }}</span>
                  <span class="mt-0.5 block font-mono text-[10px] opacity-80">±{{ lvl.n }} soal</span>
                </button>
              </div>

              <div v-if="mixedLevels.kecamatan" class="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                <div class="flex items-baseline justify-between text-xs">
                  <span class="font-medium text-slate-700 dark:text-slate-300">Sumber Kecamatan</span>
                  <span class="font-mono font-bold text-indigo-600 dark:text-indigo-400">{{ mixedCityCount }} Kota Terpilih</span>
                </div>
                <input
                  v-model.number="mixedCityCount"
                  type="range"
                  min="2"
                  max="12"
                  step="1"
                  aria-label="Jumlah kota sumber kecamatan"
                  class="w-full accent-indigo-600 cursor-pointer"
                >
              </div>
            </div>
          </div>
        </section>

        <!-- ── STEP 2 & 3: Mode & Sesi ── -->
        <div class="space-y-6 lg:col-span-5 xl:col-span-4">
          <!-- STEP 2: Mode Permainan -->
          <section class="step-card menu-rise p-5 sm:p-6" style="animation-delay: 80ms" aria-labelledby="mode-title">
            <div class="mb-4 flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                2
              </span>
              <div>
                <h2 id="mode-title" class="text-sm font-bold text-slate-900 dark:text-white">Mode Tantangan</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400">Pilih gaya interaksi permainan.</p>
              </div>
            </div>

            <div class="grid gap-3" role="radiogroup" aria-label="Mode permainan">
              <!-- Mode A -->
              <button
                type="button"
                role="radio"
                class="pick-card focusable p-4"
                :aria-checked="selectedMode === 'A'"
                :class="selectedMode === 'A' ? '!border-sky-500 !bg-sky-500/10 ring-2 ring-sky-500/20' : ''"
                @click="selectMode('A')"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div
                      class="flex h-9 w-9 items-center justify-center rounded-xl border transition"
                      :class="selectedMode === 'A' ? 'border-sky-500/50 bg-sky-500/20 text-sky-600 dark:text-sky-400' : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-500'"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="22" y1="12" x2="18" y2="12" /><line x1="6" y1="12" x2="2" y2="12" />
                        <line x1="12" y1="6" x2="12" y2="2" /><line x1="12" y1="22" x2="12" y2="18" />
                      </svg>
                    </div>
                    <div>
                      <h3 class="font-display text-sm font-bold text-slate-900 dark:text-white">Klik Petanya (Pinpoint)</h3>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400">Cari & klik langsung lokasi di peta.</p>
                    </div>
                  </div>

                  <span
                    class="flex h-5 w-5 items-center justify-center rounded-full border transition"
                    :class="selectedMode === 'A' ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 dark:border-slate-700'"
                  >
                    <svg v-if="selectedMode === 'A'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                </div>
              </button>

              <!-- Mode B -->
              <button
                type="button"
                role="radio"
                class="pick-card focusable p-4"
                :aria-checked="selectedMode === 'B'"
                :class="selectedMode === 'B' ? '!border-sky-500 !bg-sky-500/10 ring-2 ring-sky-500/20' : ''"
                @click="selectMode('B')"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div
                      class="flex h-9 w-9 items-center justify-center rounded-xl border transition"
                      :class="selectedMode === 'B' ? 'border-sky-500/50 bg-sky-500/20 text-sky-600 dark:text-sky-400' : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-500'"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
                      </svg>
                    </div>
                    <div>
                      <h3 class="font-display text-sm font-bold text-slate-900 dark:text-white">Tebak Nama (Identify)</h3>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400">Wilayah disorot, pilih nama dari opsi.</p>
                    </div>
                  </div>

                  <span
                    class="flex h-5 w-5 items-center justify-center rounded-full border transition"
                    :class="selectedMode === 'B' ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 dark:border-slate-700'"
                  >
                    <svg v-if="selectedMode === 'B'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                </div>
              </button>
            </div>
          </section>

          <!-- STEP 3: Konfigurasi Sesi & Timer -->
          <section class="step-card menu-rise p-5 sm:p-6" style="animation-delay: 120ms" aria-labelledby="session-title">
            <div class="mb-4 flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                3
              </span>
              <div>
                <h2 id="session-title" class="text-sm font-bold text-slate-900 dark:text-white">Pengaturan Sesi</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400">Jumlah soal dan batas waktu tebakan.</p>
              </div>
            </div>

            <div class="space-y-4">
              <!-- Rounds Selector -->
              <div>
                <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Jumlah Ronde</span>
                <div class="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Jumlah Ronde">
                  <button
                    v-for="count in availableRoundOptions"
                    :key="count.value"
                    type="button"
                    role="radio"
                    class="focusable flex-1 rounded-xl border py-2 text-center text-xs font-bold transition"
                    :aria-checked="selectedRounds === count.value"
                    :class="selectedRounds === count.value
                      ? 'border-sky-500 bg-sky-500/15 text-sky-600 dark:text-sky-400 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'"
                    @click="selectedRounds = count.value; playClick()"
                  >
                    {{ count.label }}
                  </button>
                </div>
              </div>

              <!-- 15s Timer Toggle -->
              <button
                type="button"
                role="switch"
                class="focusable flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3.5 text-left transition hover:border-sky-500/40"
                :aria-checked="timerEnabled"
                @click="toggleTimer"
              >
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-slate-900 dark:text-white">Timer 15 Detik</span>
                    <span v-if="timerEnabled" class="rounded-full bg-amber-500/20 px-1.5 py-0.2 font-mono text-[9px] font-bold text-amber-600 dark:text-amber-400">Aktif</span>
                  </div>
                  <p class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Uji ketangkasan berpikir cepat dalam 15s.</p>
                </div>

                <div
                  class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200"
                  :class="timerEnabled ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-700'"
                  aria-hidden="true"
                >
                  <span
                    class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200"
                    :class="timerEnabled ? 'translate-x-[1.125rem]' : 'translate-x-[0.1875rem]'"
                  />
                </div>
              </button>

              <!-- Collapsible Scoring Rules -->
              <div>
                <button
                  type="button"
                  class="focusable flex w-full items-center justify-between rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-100/60 dark:bg-slate-900/40 px-3.5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800/70"
                  :aria-expanded="showRules"
                  @click="showRules = !showRules"
                >
                  <span>Sistem Penilaian Skor</span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform" :class="showRules ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
                <div v-if="showRules" class="mt-2 space-y-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                  <p><strong class="text-slate-900 dark:text-white">+10 poin</strong> untuk setiap tebakan yang tepat.</p>
                  <p><strong class="text-slate-900 dark:text-white">+2 poin bonus</strong> untuk setiap kenaikan streak beruntun.</p>
                  <p><strong class="text-slate-900 dark:text-white">Salah tebak</strong> tidak mengurangi poin (hanya mereset streak).</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <!-- Lifetime Stats Mini Grid (if played before) -->
      <div v-if="stats.gamesPlayed > 0" class="menu-rise mt-8 grid max-w-md grid-cols-3 gap-3" style="animation-delay: 160ms">
        <div class="step-card p-3 text-center">
          <p class="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Skor Tertinggi</p>
          <p class="mt-0.5 font-mono text-xl font-black text-slate-900 dark:text-white">{{ stats.bestScore }}</p>
        </div>
        <div class="step-card p-3 text-center">
          <p class="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Streak Puncak</p>
          <p class="mt-0.5 font-mono text-xl font-black text-amber-500">{{ stats.bestStreak }} 🔥</p>
        </div>
        <div class="step-card p-3 text-center">
          <p class="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Sesi</p>
          <p class="mt-0.5 font-mono text-xl font-black text-sky-600 dark:text-sky-400">{{ stats.gamesPlayed }}</p>
        </div>
      </div>
    </main>

    <!-- ── Sticky Bottom Cockpit Launch Bar ────────────────────── -->
    <div class="sticky bottom-0 z-40 mx-auto w-full max-w-[1400px] px-3 pb-3 sm:px-6 sm:pb-4 lg:px-10">
      <div class="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-xl transition-all">
        <!-- Thin top progress line indicating selection completeness -->
        <div class="absolute inset-x-0 top-0 h-0.5 bg-slate-200 dark:bg-slate-800">
          <div
            class="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-300"
            :style="{ width: `${Math.max(5, Math.min(100, (Math.min(selectedRounds, poolSize) / Math.max(poolSize, 1)) * 100))}%` }"
          />
        </div>

        <div class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 lg:px-6">
          <div class="min-w-0 flex-1">
            <p class="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Ringkasan Misi
            </p>
            <dl class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <div class="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <dd class="truncate font-semibold text-slate-900 dark:text-white">{{ scopeLabel }}</dd>
              </div>
              <span class="text-slate-300 dark:text-slate-700">•</span>
              <div class="flex items-center gap-1.5">
                <dt class="text-slate-500 dark:text-slate-400">Mode</dt>
                <dd class="font-semibold text-slate-900 dark:text-white">{{ modeLabel }}</dd>
              </div>
              <span class="text-slate-300 dark:text-slate-700">•</span>
              <div class="flex items-center gap-1.5">
                <dt class="text-slate-500 dark:text-slate-400">Ronde</dt>
                <dd class="font-mono font-semibold text-slate-900 dark:text-white">
                  {{ Math.min(selectedRounds, poolSize) }}
                  <span class="text-slate-400 dark:text-slate-500">/ {{ poolSize }} {{ unitLabel }}</span>
                </dd>
              </div>
              <span class="hidden text-slate-300 dark:text-slate-700 sm:inline">•</span>
              <div class="hidden items-center gap-1.5 sm:flex">
                <dt class="text-slate-500 dark:text-slate-400">Waktu</dt>
                <dd class="font-semibold" :class="timerEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'">
                  {{ timerEnabled ? '15 Detik' : 'Santai' }}
                </dd>
              </div>
            </dl>
          </div>

          <div class="flex items-center justify-between gap-3 sm:justify-end">
            <span class="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {{ canStart ? '● Siap Main' : 'Memuat…' }}
            </span>

            <button
              type="button"
              :disabled="!canStart"
              class="focusable group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 px-5 font-display text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
              @click="start"
            >
              <span
                v-if="pending || mixedPending"
                class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden="true"
              />
              <span>{{ pending || mixedPending ? 'Menyiapkan Peta…' : 'Mulai Main' }}</span>
              <span class="shadcn-kbd text-[10px] hidden lg:inline-flex bg-white/20 text-white border-white/30">
                Enter ↵
              </span>
              <svg v-if="!pending && !mixedPending" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Modern Footer ──────────────────────────────────────── -->
    <footer class="relative z-10 border-t border-slate-200/80 dark:border-slate-800/80 py-4 text-center font-mono text-xs text-slate-500 dark:text-slate-400">
      Data batas wilayah offline · 195 Negara, 38 Provinsi, 514 Kab/Kota, 6.644 Kecamatan.
    </footer>
  </div>
</template>
