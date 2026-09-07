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
/** Pintasan kota DKI Jakarta, diambil dari indeks. */
const quickCities = computed(() =>
  availableCities.value.filter(c => /^Daerah Khusus/i.test(c.province)),
)

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
// Selaraskan state awal dengan kota yang sudah dimuat: koleksi berisi satu kota,
// jadi seluruh isinya adalah pool soal.
selectedCity.value = activeKecamatanCity.value?.city ?? ''
regionFilter.value = 'all'
selectedRounds.value = Math.min(10, activeKecamatanCity.value?.count ?? 8)
/** Kata kunci pencarian kota — daftarnya 494 item, terlalu panjang untuk di-scroll. */
const citySearch = ref('')

/** Kota di provinsi terpilih, disaring pencarian. */
const citiesInProvince = computed(() => {
  const query = citySearch.value.trim().toLowerCase()
  return availableCities.value
    .filter(c => query
      ? c.city.toLowerCase().includes(query) || c.province.toLowerCase().includes(query)
      : c.province === kecamatanProvince.value)
    .slice(0, query ? 40 : undefined)
})

/**
 * Pindah provinsi lewat dropdown: muat kota pertama di provinsi itu.
 * Dilewati kalau kota aktif sudah ada di provinsi tersebut — itu berarti
 * provinsinya berubah karena mengikuti pilihan kota, bukan sebaliknya.
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
  // Mode campuran tidak punya satu koleksi tunggal — pool-nya dibangun saat
  // permainan dimulai, jadi tidak ada scope yang perlu dimuat di sini.
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

/** Ganti kota: hanya file kota itu yang diunduh. */
async function selectCity(cityId: string) {
  playClick()
  await setKecamatanCity(cityId)
  selectedCity.value = activeKecamatanCity.value?.city ?? ''
  if (activeKecamatanCity.value) kecamatanProvince.value = activeKecamatanCity.value.province
  // Koleksi yang dimuat hanya berisi kota ini, jadi seluruh isinya jadi pool.
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
/** Berapa kabupaten/kota yang kecamatannya diunduh untuk mode campuran. */
const mixedCityCount = ref(4)
const mixedPending = ref(false)

const mixedLevelCount = computed(() =>
  Object.values(mixedLevels.value).filter(Boolean).length,
)

function toggleMixedLevel(key: 'province' | 'kabupaten' | 'kecamatan') {
  // Minimal satu level harus aktif, kalau tidak pool-nya kosong.
  if (mixedLevels.value[key] && mixedLevelCount.value === 1) return
  mixedLevels.value[key] = !mixedLevels.value[key]
  playClick()
}

/** Perkiraan jumlah soal di mode campuran, tanpa perlu mengunduh datanya. */
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
  if (total <= 5) return [{ label: `Semua ${total}`, value: total }]
  if (total <= 10) {
    return [
      { label: '5', value: 5 },
      { label: `Semua ${total}`, value: total },
    ]
  }
  return [
    { label: '5', value: 5 },
    { label: '10', value: 10 },
    { label: total <= 20 ? `Semua ${total}` : '20', value: Math.min(20, total) },
  ]
})

/** Jaga selectedRounds tetap salah satu opsi yang tersedia untuk pool saat ini. */
watch(availableRoundOptions, (options) => {
  if (!options.length) return
  if (!options.some(o => o.value === selectedRounds.value)) {
    selectedRounds.value = options[options.length - 1]!.value
  }
})

/** Label ringkas untuk panel ringkasan & tombol start. */
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
  return `${selectedCity.value} · Kecamatan`
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
    // Pool campuran perlu mengunduh beberapa dataset, jadi tombolnya dikunci
    // selama proses supaya tidak terpicu dua kali.
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

/** Enter mulai permainan — kecuali fokus sedang di kontrol yang punya aksi Enter sendiri. */
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
  <div class="relative flex min-h-dvh flex-col bg-[#070a12] text-slate-100 selection:bg-sky-500/20 selection:text-sky-200">
    <!-- Ambient lighting -->
    <div
      class="pointer-events-none fixed inset-0 transition-opacity duration-500"
      :class="primaryScope === 'world' ? 'bg-ambient-glow' : 'bg-ambient-indonesia'"
    />

    <!-- ── Header ──────────────────────────────────────────────── -->
    <header class="relative z-20 border-b border-white/[0.07] bg-[#070a12]/85 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-sky-400">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <span class="text-sm font-bold tracking-tight text-white">GeoGuesser</span>
          <span class="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-400">Pro</span>
        </div>

        <button
          type="button"
          class="focusable flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/80 px-2.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
          :aria-pressed="soundEnabled"
          @click="toggleSound"
        >
          <svg v-if="soundEnabled" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
          </svg>
          <span class="hidden sm:inline">{{ soundEnabled ? 'Suara' : 'Bisu' }}</span>
        </button>
      </div>
    </header>

    <!-- ── Main ────────────────────────────────────────────────── -->
    <main class="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <!-- Hero -->
      <div class="menu-rise mb-7 grid items-end gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div class="max-w-2xl">
          <p class="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-bold uppercase text-sky-200">
            <span class="h-1.5 w-1.5 rounded-full bg-sky-300" />
            Main tebak peta
          </p>
          <h1 class="text-[30px] font-black leading-tight text-white sm:text-[42px]">
            Seberapa hafal kamu sama bentuk wilayah?
          </h1>
          <p class="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
            Mulai dari kecamatan di Jakarta sampai negara di dunia. Pilih area, pilih gaya main, gas.
          </p>
        </div>

        <div class="map-radar hidden min-h-44 rounded-2xl p-4 lg:block" aria-hidden="true">
          <div class="relative z-10 flex h-full flex-col justify-between">
            <div class="flex items-center justify-between text-[11px] font-semibold text-slate-300">
              <span>{{ scopeLabel }}</span>
              <span class="font-mono text-sky-200">{{ poolSize }} {{ unitLabel }}</span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center">
              <div class="rounded-lg border border-white/10 bg-slate-950/55 px-2 py-2">
                <p class="text-[10px] text-slate-500">Mode</p>
                <p class="mt-0.5 truncate text-xs font-bold text-white">{{ selectedMode }}</p>
              </div>
              <div class="rounded-lg border border-white/10 bg-slate-950/55 px-2 py-2">
                <p class="text-[10px] text-slate-500">Ronde</p>
                <p class="mt-0.5 font-mono text-xs font-bold text-white">{{ Math.min(selectedRounds, poolSize) }}</p>
              </div>
              <div class="rounded-lg border border-white/10 bg-slate-950/55 px-2 py-2">
                <p class="text-[10px] text-slate-500">Waktu</p>
                <p class="mt-0.5 text-xs font-bold" :class="timerEnabled ? 'text-sky-200' : 'text-slate-300'">
                  {{ timerEnabled ? '15s' : 'Santai' }}
                </p>
              </div>
            </div>
          </div>
          <span class="radar-pin is-hot left-[61%] top-[28%]">ID</span>
          <span class="radar-pin left-[30%] top-[38%]">A</span>
          <span class="radar-pin left-[48%] top-[62%]">B</span>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-950/40 p-3.5 text-xs text-red-200">
        <svg xmlns="http://www.w3.org/2000/svg" class="mt-px h-4 w-4 shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{{ error }}</span>
      </div>

      <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <!-- ═══ Kolom kiri: langkah konfigurasi ═══ -->
        <div class="space-y-4">
          <!-- ── Langkah 1: Wilayah ── -->
          <section class="step-card menu-rise p-4 sm:p-5" style="animation-delay: 40ms" aria-labelledby="step-1-title">
            <div class="mb-4 flex items-center gap-2.5">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-800 font-mono text-[11px] font-bold text-slate-300">1</span>
              <div>
                <h2 id="step-1-title" class="text-sm font-bold text-white">Wilayah</h2>
                <p class="text-xs text-slate-400">Mau main di peta mana?</p>
              </div>
            </div>

            <div class="seg-track" role="radiogroup" aria-label="Cakupan wilayah">
              <button
                type="button"
                role="radio"
                class="seg-item focusable"
                :aria-checked="primaryScope === 'world'"
                :class="primaryScope === 'world' ? 'bg-sky-500 text-slate-950 shadow-sm' : ''"
                @click="selectPrimaryScope('world')"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                Dunia
              </button>
              <button
                type="button"
                role="radio"
                class="seg-item focusable"
                :aria-checked="primaryScope === 'indonesia'"
                :class="primaryScope === 'indonesia' ? 'bg-rose-500 text-white shadow-sm' : ''"
                @click="selectPrimaryScope('indonesia')"
              >
                <span aria-hidden="true">🇮🇩</span>
                Indonesia
              </button>
            </div>

            <!-- Sub-opsi Indonesia -->
            <div v-if="primaryScope === 'indonesia'" class="mt-3.5 space-y-3.5">
              <div class="seg-track grid grid-cols-2 sm:grid-cols-4" role="radiogroup" aria-label="Tingkat wilayah Indonesia">
                <button
                  type="button"
                  role="radio"
                  class="seg-item focusable text-center justify-center"
                  :aria-checked="indonesiaLevel === 'provinces'"
                  :class="indonesiaLevel === 'provinces' ? 'bg-rose-500/90 text-white shadow-sm' : ''"
                  @click="selectIndonesiaLevel('provinces')"
                >
                  <span aria-hidden="true">🏛️</span> 38 Provinsi
                </button>
                <button
                  type="button"
                  role="radio"
                  class="seg-item focusable text-center justify-center"
                  :aria-checked="indonesiaLevel === 'kabupaten'"
                  :class="indonesiaLevel === 'kabupaten' ? 'bg-amber-400 text-slate-950 shadow-sm' : ''"
                  @click="selectIndonesiaLevel('kabupaten')"
                >
                  <span aria-hidden="true">🏙️</span> Kab / Kota
                </button>
                <button
                  type="button"
                  role="radio"
                  class="seg-item focusable text-center justify-center"
                  :aria-checked="indonesiaLevel === 'kecamatan'"
                  :class="indonesiaLevel === 'kecamatan' ? 'bg-sky-400 text-slate-950 shadow-sm' : ''"
                  @click="selectIndonesiaLevel('kecamatan')"
                >
                  <span aria-hidden="true">🏘️</span> Kecamatan
                </button>
                <button
                  type="button"
                  role="radio"
                  class="seg-item focusable text-center justify-center"
                  :aria-checked="indonesiaLevel === 'mixed'"
                  :class="indonesiaLevel === 'mixed' ? 'bg-violet-500 text-white shadow-sm' : ''"
                  @click="selectIndonesiaLevel('mixed')"
                >
                  <span aria-hidden="true">🎲</span> Campuran
                </button>
              </div>

              <!-- Panel mode campuran -->
              <div v-if="indonesiaLevel === 'mixed'" class="space-y-3 rounded-xl border border-violet-500/30 bg-slate-950/50 p-3.5 shadow-sm">
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-semibold text-violet-200">Acak lintas tingkat</span>
                    <span class="rounded bg-violet-500/15 px-1.5 py-0.2 text-[10px] font-bold text-violet-300">Baru</span>
                  </div>
                  <p class="mt-0.5 text-[11px] text-slate-400">
                    Tiap ronde bisa loncat antara provinsi, kab/kota, atau kecamatan.
                  </p>
                </div>

                <div class="space-y-1.5">
                  <p class="text-[11px] font-medium text-slate-400">Tingkat yang diikutkan</p>
                  <div class="grid grid-cols-3 gap-1.5">
                    <button
                      v-for="lvl in [
                        { key: 'province' as const, label: 'Provinsi', icon: '🏛️', n: 38 },
                        { key: 'kabupaten' as const, label: 'Kab/Kota', icon: '🏙️', n: 514 },
                        { key: 'kecamatan' as const, label: 'Kecamatan', icon: '🏘️', n: mixedCityCount * 13 },
                      ]"
                      :key="lvl.key"
                      type="button"
                      class="focusable rounded-lg border px-2 py-1.5 text-center transition"
                      :aria-pressed="mixedLevels[lvl.key]"
                      :class="mixedLevels[lvl.key]
                        ? 'border-violet-400 bg-violet-500/15 text-violet-100'
                        : 'border-white/[0.08] bg-slate-900/70 text-slate-500 hover:bg-slate-800'"
                      @click="toggleMixedLevel(lvl.key)"
                    >
                      <span class="block text-xs" aria-hidden="true">{{ lvl.icon }}</span>
                      <span class="mt-0.5 block text-[10px] font-semibold">{{ lvl.label }}</span>
                      <span class="block text-[9px] tabular-nums opacity-70">±{{ lvl.n }}</span>
                    </button>
                  </div>
                </div>

                <div v-if="mixedLevels.kecamatan" class="space-y-1.5">
                  <div class="flex items-baseline justify-between">
                    <p class="text-[11px] font-medium text-slate-400">Ambil kecamatan dari</p>
                    <span class="text-[10px] tabular-nums text-slate-500">{{ mixedCityCount }} kota</span>
                  </div>
                  <!-- Tiap kota adalah satu file terpisah, jadi ini langsung
                       menentukan berapa banyak yang diunduh. -->
                  <input
                    v-model.number="mixedCityCount"
                    type="range"
                    min="2"
                    max="12"
                    step="1"
                    aria-label="Jumlah kota sumber kecamatan"
                    class="focusable w-full accent-violet-400"
                  >
                  <p class="text-[10px] text-slate-500">
                    Makin banyak kota, soalnya makin rame. Loading juga bisa sedikit lebih lama.
                  </p>
                </div>

                <p class="rounded-lg border border-violet-500/15 bg-violet-950/20 px-2.5 py-2 text-[11px] text-violet-200">
                  Sekitar <span class="font-bold tabular-nums">±{{ mixedEstimate }}</span> wilayah bakal masuk pool.
                </p>
              </div>

              <!-- Pemilih Kota/Kecamatan (level kecamatan) -->
              <div v-if="indonesiaLevel === 'kecamatan'" class="space-y-3 rounded-xl border border-sky-500/30 bg-slate-950/50 p-3.5 shadow-sm">
                <div class="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <label for="city-select" class="text-xs font-semibold text-sky-200">Pilih kota</label>
                      <span class="rounded bg-sky-500/15 px-1.5 py-0.2 text-[10px] font-bold text-sky-400">Mikro</span>
                    </div>
                    <p class="mt-0.5 text-[11px] text-slate-400">Nanti yang ditebak batas kecamatan di kota ini.</p>
                  </div>

                  <div class="w-full sm:w-72 space-y-2">
                    <!-- Provinsi menyaring daftar; pencarian di dalam picker
                         menembus semua provinsi. -->
                    <SearchSelect
                      v-model="kecamatanProvince"
                      :options="provinceOptions"
                      label="Provinsi"
                      accent="slate"
                      search-placeholder="Cari provinsi…"
                    />

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

                <!-- Quick pick for Jakarta Cities -->
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-[11px] font-medium text-slate-500">DKI Jakarta</span>
                  <button
                    v-for="c in quickCities"
                    :key="c.id"
                    type="button"
                    class="focusable rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition"
                    :aria-pressed="activeKecamatanCity?.id === c.id"
                    :class="activeKecamatanCity?.id === c.id
                      ? 'border-sky-400 bg-sky-400 text-slate-950'
                      : 'border-white/[0.08] bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white'"
                    @click="selectCity(c.id)"
                  >
                    {{ c.city.replace(/^(Kota|Kabupaten)( Administrasi)? /, '') }}
                  </button>
                </div>

                <!-- Live badges preview of all kecamatan in selectedCity -->
                <div class="rounded-lg border border-sky-500/15 bg-slate-900/70 p-2.5">
                  <div class="mb-2 flex items-center justify-between text-[11px]">
                    <span class="font-semibold text-sky-300 flex items-center gap-1.5">
                      <span class="inline-block h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                      {{ activeCityDistricts.length }} Kecamatan di {{ selectedCity }}
                    </span>
                    <span class="text-[10px] text-slate-500 font-mono">Data offline</span>
                  </div>
                  <div class="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    <span
                      v-for="d in activeCityDistricts"
                      :key="d.id"
                      class="rounded-md border border-sky-500/20 bg-sky-950/40 px-2 py-0.5 text-[11px] font-medium text-sky-200"
                    >
                      {{ d.name }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Pemilih provinsi (hanya di level kab/kota) -->
              <div v-if="indonesiaLevel === 'kabupaten'" class="space-y-3 rounded-xl border border-amber-500/20 bg-slate-950/50 p-3.5">
                <div class="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
                  <div class="min-w-0">
                    <label for="province-select" class="text-xs font-semibold text-amber-200">Pilih provinsi</label>
                    <p class="mt-0.5 text-[11px] text-slate-400">Soalnya dari kabupaten & kota di provinsi ini.</p>
                  </div>

                  <div class="w-full sm:w-56">
                    <SearchSelect
                      v-model="selectedProvince"
                      :options="kabupatenProvinceOptions"
                      label="Pilih provinsi"
                      accent="amber"
                      search-placeholder="Cari provinsi…"
                    />
                  </div>
                </div>

                <!-- Quick pick -->
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-[11px] font-medium text-slate-500">Populer</span>
                  <button
                    v-for="prov in quickProvinces"
                    :key="prov"
                    type="button"
                    class="focusable rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition"
                    :aria-pressed="selectedProvince === prov"
                    :class="selectedProvince === prov
                      ? 'border-amber-400 bg-amber-400 text-slate-950'
                      : 'border-white/[0.08] bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white'"
                    @click="selectProvince(prov)"
                  >
                    {{ prov }}
                  </button>
                </div>

                <!-- Preview daftar wilayah -->
                <details class="group">
                  <summary class="focusable flex cursor-pointer list-none items-center justify-between rounded-lg py-1 text-[11px] font-semibold text-slate-400 transition hover:text-slate-200 [&::-webkit-details-marker]:hidden">
                    <span>Lihat {{ activeProvinceCities.length }} wilayah di {{ selectedProvince }}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                  </summary>
                  <div class="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
                    <span
                      v-for="city in activeProvinceCities"
                      :key="city.id"
                      class="rounded-md border border-white/[0.08] bg-slate-900/80 px-2 py-0.5 text-[11px] text-slate-300"
                    >
                      {{ city.name }}
                    </span>
                  </div>
                </details>
              </div>
            </div>

            <!-- Filter benua / kepulauan -->
            <div
              v-if="activeScope !== 'id-kabupaten' && activeScope !== 'id-kecamatan' && activeScope !== 'id-mixed'"
              class="mt-3.5"
            >
              <label for="region-select" class="text-xs font-semibold text-slate-300">
                {{ activeScope === 'id-provinces' ? 'Filter pulau' : 'Filter benua' }}
              </label>
              <div class="mt-1.5">
                <SearchSelect
                  v-model="regionFilter"
                  :options="regionFilterOptions"
                  :label="activeScope === 'id-provinces' ? 'Filter pulau' : 'Filter benua'"
                  accent="slate"
                  :search-placeholder="activeScope === 'id-provinces' ? 'Cari pulau…' : 'Cari benua…'"
                />
              </div>
            </div>
          </section>

          <!-- ── Langkah 2: Mode ── -->
          <section class="step-card menu-rise p-4 sm:p-5" style="animation-delay: 90ms" aria-labelledby="step-2-title">
            <div class="mb-4 flex items-center gap-2.5">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-800 font-mono text-[11px] font-bold text-slate-300">2</span>
              <div>
                <h2 id="step-2-title" class="text-sm font-bold text-white">Cara main</h2>
                <p class="text-xs text-slate-400">Mau klik peta atau pilih jawaban?</p>
              </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Mode permainan">
              <!-- Mode A -->
              <button
                type="button"
                role="radio"
                class="pick-card focusable p-4"
                :aria-checked="selectedMode === 'A'"
                :class="selectedMode === 'A' ? '!border-sky-500/70 !bg-sky-500/10 ring-1 ring-sky-500/40' : ''"
                @click="selectMode('A')"
              >
                <div class="mb-2.5 flex items-center justify-between">
                  <div
                    class="flex h-9 w-9 items-center justify-center rounded-lg border transition"
                    :class="selectedMode === 'A' ? 'border-sky-400/40 bg-sky-500/20 text-sky-300' : 'border-white/10 bg-slate-800/80 text-slate-400'"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="22" y1="12" x2="18" y2="12" /><line x1="6" y1="12" x2="2" y2="12" />
                      <line x1="12" y1="6" x2="12" y2="2" /><line x1="12" y1="22" x2="12" y2="18" />
                    </svg>
                  </div>
                  <span
                    class="flex h-4.5 w-4.5 items-center justify-center rounded-full border transition"
                    :class="selectedMode === 'A' ? 'border-sky-400 bg-sky-400' : 'border-white/20'"
                    aria-hidden="true"
                  >
                    <svg v-if="selectedMode === 'A'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                </div>
                <h3 class="text-sm font-bold text-white">Klik Petanya</h3>
                <p class="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {{ activeScope === 'id-kecamatan'
                    ? `Muncul nama seperti ${activeProvinceExampleCity}. Tugasmu klik kecamatannya.`
                    : activeScope === 'id-kabupaten'
                      ? `Muncul nama seperti ${activeProvinceExampleCity}. Tugasmu klik wilayahnya.`
                      : activeScope === 'id-provinces'
                        ? 'Muncul nama provinsi. Klik wilayahnya di peta.'
                        : 'Muncul nama negara. Klik wilayahnya di peta dunia.' }}
                </p>
              </button>

              <!-- Mode B -->
              <button
                type="button"
                role="radio"
                class="pick-card focusable p-4"
                :aria-checked="selectedMode === 'B'"
                :class="selectedMode === 'B' ? '!border-amber-500/70 !bg-amber-500/10 ring-1 ring-amber-500/40' : ''"
                @click="selectMode('B')"
              >
                <div class="mb-2.5 flex items-center justify-between">
                  <div
                    class="flex h-9 w-9 items-center justify-center rounded-lg border transition"
                    :class="selectedMode === 'B' ? 'border-amber-400/40 bg-amber-500/20 text-amber-300' : 'border-white/10 bg-slate-800/80 text-slate-400'"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
                    </svg>
                  </div>
                  <span
                    class="flex h-4.5 w-4.5 items-center justify-center rounded-full border transition"
                    :class="selectedMode === 'B' ? 'border-amber-400 bg-amber-400' : 'border-white/20'"
                    aria-hidden="true"
                  >
                    <svg v-if="selectedMode === 'B'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                </div>
                <h3 class="text-sm font-bold text-white">Pilih Nama</h3>
                <p class="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Satu wilayah disorot. Kamu tinggal pilih nama yang bener.
                </p>
              </button>
            </div>
          </section>

          <!-- ── Langkah 3: Sesi ── -->
          <section class="step-card menu-rise p-4 sm:p-5" style="animation-delay: 140ms" aria-labelledby="step-3-title">
            <div class="mb-4 flex items-center gap-2.5">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-800 font-mono text-[11px] font-bold text-slate-300">3</span>
              <div>
                <h2 id="step-3-title" class="text-sm font-bold text-white">Set sesi</h2>
                <p class="text-xs text-slate-400">Berapa ronde, pakai timer atau santai.</p>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <span id="rounds-label" class="text-xs font-semibold text-slate-300">Jumlah ronde</span>
                <div class="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="rounds-label">
                  <button
                    v-for="count in availableRoundOptions"
                    :key="count.value"
                    type="button"
                    role="radio"
                    class="focusable min-w-16 flex-1 rounded-lg border py-2 text-xs font-bold transition"
                    :aria-checked="selectedRounds === count.value"
                    :class="selectedRounds === count.value
                      ? 'border-sky-500 bg-sky-500/15 text-sky-300'
                      : 'border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/20 hover:text-white'"
                    @click="selectedRounds = count.value; playClick()"
                  >
                    {{ count.label }}
                  </button>
                </div>
              </div>

              <!-- Timer switch -->
              <button
                type="button"
                role="switch"
                class="focusable flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-slate-900/50 p-3 text-left transition hover:border-white/[0.14]"
                :aria-checked="timerEnabled"
                @click="toggleTimer"
              >
                <span class="min-w-0">
                  <span class="block text-xs font-semibold text-slate-100">Timer 15 detik</span>
                  <span class="mt-0.5 block text-[11px] text-slate-400">Biar agak deg-degan.</span>
                </span>
                <span
                  class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200"
                  :class="timerEnabled ? 'bg-sky-500' : 'bg-slate-700'"
                  aria-hidden="true"
                >
                  <span
                    class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200"
                    :class="timerEnabled ? 'translate-x-[1.125rem]' : 'translate-x-[0.1875rem]'"
                  />
                </span>
              </button>
            </div>
          </section>
        </div>

        <!-- ═══ Kolom kanan: ringkasan + CTA ═══ -->
        <aside class="menu-rise lg:sticky lg:top-6" style="animation-delay: 190ms">
          <div class="step-card overflow-hidden">
            <div class="border-b border-white/[0.07] px-4 py-3">
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-xs font-bold uppercase text-slate-400">Setup kamu</h2>
                <span class="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  {{ canStart ? 'Ready' : 'Loading' }}
                </span>
              </div>
            </div>

            <dl class="divide-y divide-white/[0.05] px-4 text-xs">
              <div class="flex items-center justify-between gap-3 py-2.5">
                <dt class="text-slate-400">Wilayah</dt>
                <dd class="truncate font-semibold text-white">{{ scopeLabel }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3 py-2.5">
                <dt class="text-slate-400">Mode</dt>
                <dd class="font-semibold" :class="selectedMode === 'A' ? 'text-sky-300' : 'text-amber-300'">
                  {{ modeLabel }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3 py-2.5">
                <dt class="text-slate-400">Ronde</dt>
                <dd class="font-mono font-semibold text-white">
                  {{ Math.min(selectedRounds, poolSize) }}
                  <span class="text-slate-500">/ {{ poolSize }} {{ unitLabel }}</span>
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3 py-2.5">
                <dt class="text-slate-400">Timer</dt>
                <dd class="font-semibold" :class="timerEnabled ? 'text-sky-300' : 'text-slate-500'">
                  {{ timerEnabled ? '15 detik' : 'Nonaktif' }}
                </dd>
              </div>
            </dl>

            <div class="px-4 pt-4">
              <div class="overflow-hidden rounded-xl border border-white/[0.08] bg-slate-950/60">
                <div class="h-1.5 bg-slate-800">
                  <div
                    class="h-full rounded-r-full bg-sky-400 transition-all"
                    :style="{ width: `${Math.max(8, Math.min(100, (Math.min(selectedRounds, poolSize) / Math.max(poolSize, 1)) * 100))}%` }"
                  />
                </div>
                <div class="flex items-center justify-between px-3 py-2 text-[11px]">
                  <span class="text-slate-400">Dipakai</span>
                  <span class="font-mono font-semibold text-slate-200">
                    {{ Math.min(selectedRounds, poolSize) }} dari {{ poolSize }}
                  </span>
                </div>
              </div>
            </div>

            <div class="p-4 pt-3">
              <button
                type="button"
                :disabled="!canStart"
                class="focusable group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-slate-950 shadow-lg transition hover:bg-slate-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
                @click="start"
              >
                <span
                  v-if="pending"
                  class="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-slate-900"
                  aria-hidden="true"
                />
                <span>{{ pending || mixedPending ? 'Lagi siapin peta…' : `Gas ${Math.min(selectedRounds, poolSize)} Ronde` }}</span>
                <svg v-if="!pending" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
              <p class="mt-2 hidden items-center justify-center gap-1.5 text-[11px] text-slate-500 lg:flex">
                Enter juga bisa
              </p>
            </div>
          </div>

          <!-- Rekor -->
          <div v-if="stats.gamesPlayed > 0" class="mt-4 grid grid-cols-3 gap-2">
            <div class="step-card p-3 text-center">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Skor</p>
              <p class="mt-0.5 font-mono text-lg font-black text-white">{{ stats.bestScore }}</p>
            </div>
            <div class="step-card p-3 text-center">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Streak</p>
              <p class="mt-0.5 font-mono text-lg font-black text-amber-400">{{ stats.bestStreak }}</p>
            </div>
            <div class="step-card p-3 text-center">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Sesi</p>
              <p class="mt-0.5 font-mono text-lg font-black text-sky-400">{{ stats.gamesPlayed }}</p>
            </div>
          </div>

          <!-- Aturan skor -->
          <div class="mt-4">
            <button
              type="button"
              class="focusable flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-slate-900/40 px-3.5 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-white/[0.14] hover:text-white"
              :aria-expanded="showRules"
              @click="showRules = !showRules"
            >
              <span>Skornya gimana?</span>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform" :class="showRules ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
            <div v-if="showRules" class="mt-2 space-y-1.5 rounded-xl border border-white/[0.07] bg-slate-900/60 p-3.5 text-[11px] leading-relaxed text-slate-400">
              <p><strong class="text-white">+10 poin</strong> kalau benar.</p>
              <p><strong class="text-white">+2 poin</strong> tiap streak naik.</p>
              <p><strong class="text-white">Salah aman</strong>, skor nggak turun. Streak aja yang putus.</p>
            </div>
          </div>
        </aside>
      </div>
    </main>

    <!-- ── Footer ──────────────────────────────────────────────── -->
    <footer class="relative z-10 border-t border-white/[0.07] px-6 py-4 text-center text-[11px] text-slate-500">
      Data batas wilayah offline · Dunia, provinsi, kab/kota, sampai kecamatan.
    </footer>
  </div>
</template>
