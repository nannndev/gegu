<script setup lang="ts">
import type { SearchOption } from '~/components/SearchSelect.vue'
import { dailyChallenge, dailyResult } from '~/utils/daily'
import { loadStats, statsForScope, type StatsBlob } from '~/utils/stats'

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
  itemsInRegion,
} = useGeoData()

const game = useGameStore()
const { soundEnabled, toggleSound, playClick } = useAudio()
const setup = useGameSetup()

const showRules = ref(false)
const stats = ref<StatsBlob>({ overall: { bestScore: 0, bestStreak: 0, bestAccuracy: 0, gamesPlayed: 0 }, byScope: {} })

// Preload mode kecamatan: indeks nasional + satu kota default siap dipakai.
await load('district', 'id-kecamatan')

const quickProvinces = ['DKI Jakarta', 'Bali', 'Jawa Barat', 'Daerah Istimewa Yogyakarta', 'Jawa Timur', 'Sumatera Utara']

/** Pintasan kota populer untuk akses 1-klik. */
const quickCities = computed(() => {
  const dki = availableCities.value.filter(c => /Daerah Khusus|Jakarta/i.test(c.province))
  return dki.length ? dki : availableCities.value.slice(0, 5)
})

const popularMajorCities = computed(() => {
  const targets = ['Surabaya', 'Bandung', 'Medan', 'Denpasar', 'Semarang', 'Makassar']
  return availableCities.value.filter(c =>
    targets.some(t => c.city.toLowerCase().includes(t.toLowerCase())),
  )
})

/**
 * Provinsi di panel kecamatan. Kota pertama provinsi itu langsung dimuat,
 * karena daftar kota di bawahnya menyaring dari provinsi terpilih.
 */
watch(setup.kecamatanProvince, async (prov) => {
  if (setup.activeScope.value !== 'id-kecamatan') return
  if (activeKecamatanCity.value?.province === prov) return
  const first = availableCities.value.find(c => c.province === prov)
  if (first) await setup.setCity(first.id)
})

const provinceOptions = computed<SearchOption[]>(() =>
  kecamatanProvinces.value.map(prov => ({
    value: prov,
    label: prov,
    count: availableCities.value.filter(c => c.province === prov).length,
  })),
)

const kabupatenProvinceOptions = computed<SearchOption[]>(() =>
  availableProvinces.value.map(prov => ({
    value: prov.name,
    label: prov.name,
    count: prov.count,
  })),
)

const regionFilterOptions = computed<SearchOption[]>(() => [
  {
    value: 'all',
    label: setup.activeScope.value === 'id-provinces' ? 'Semua provinsi' : 'Semua benua',
    count: items.value.length,
  },
  ...regions.value.map(r => ({
    value: r,
    label: r,
    count: itemsInRegion(r).length,
  })),
])

const activeProvinceCities = computed(() =>
  setup.activeScope.value === 'id-kabupaten'
    ? itemsInRegion(setup.selectedProvince.value)
    : [],
)

const activeCityDistricts = computed(() =>
  setup.activeScope.value === 'id-kecamatan' ? itemsInRegion('all') : [],
)

/** Jaga agar jumlah ronde selalu ada di daftar pilihan yang tersedia. */
watch(setup.roundOptions, (options) => {
  if (!options.length) return
  if (!options.some(o => o.value === setup.selectedRounds.value)) {
    setup.selectedRounds.value = options[options.length - 1]!.value
  }
})

/** Rekor untuk cakupan yang sedang dipilih. */
const scopeRecord = computed(() => statsForScope(stats.value, setup.scopeKey.value))

const canStart = computed(() =>
  !pending.value && !setup.mixedPending.value && setup.poolSize.value > 0 && !error.value,
)

// ── Tantangan harian ──────────────────────────────────────────
const daily = dailyChallenge()
const dailyDone = ref<ReturnType<typeof dailyResult>>(null)

const DAILY_SCOPE_LABEL: Record<string, string> = {
  'world': 'Dunia',
  'id-provinces': 'Provinsi',
  'id-kabupaten': 'Kab/Kota',
  'id-kecamatan': 'Kecamatan',
}

/** Terapkan konfigurasi harian ke panel setup, lalu mulai. */
async function startDaily() {
  playClick()
  if (daily.kind === 'world') {
    await setup.setPrimaryScope('world')
  }
  else {
    await setup.setPrimaryScope('indonesia')
    await setup.setIndonesiaLevel(
      daily.kind === 'id-provinces' ? 'provinces' : daily.kind === 'id-kabupaten' ? 'kabupaten' : 'kecamatan',
    )
  }
  setup.selectedMode.value = daily.mode
  setup.timerEnabled.value = daily.timer
  setup.selectedRounds.value = Math.min(daily.rounds, setup.poolSize.value)
  await start(true)
}

async function start(isDaily = false) {
  if (!canStart.value) return
  playClick()

  const pool = await setup.buildPool()
  if (!pool.length) return

  setup.persist()
  game.startGame({
    mode: setup.selectedMode.value,
    pool,
    regionFilter: setup.regionFilter.value,
    timerEnabled: setup.timerEnabled.value,
    roundsCount: setup.selectedRounds.value,
    scope: setup.activeScope.value,
    provinceName: setup.activeScope.value === 'id-kabupaten' ? setup.selectedProvince.value : '',
    cityName: setup.activeScope.value === 'id-kecamatan' ? (activeKecamatanCity.value?.city ?? '') : '',
    scopeKey: setup.scopeKey.value,
    scopeLabel: setup.scopeLabel.value,
    daily: isDaily ? daily.key : '',
  })
  navigateTo({ path: '/play', query: { mode: setup.selectedMode.value } })
}

const INTERACTIVE_TAGS = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'SUMMARY', 'A']

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' || !canStart.value) return
  const el = e.target as HTMLElement | null
  if (el && (INTERACTIVE_TAGS.includes(el.tagName) || el.isContentEditable)) return
  e.preventDefault()
  start()
}

onMounted(async () => {
  stats.value = loadStats()
  dailyDone.value = dailyResult(daily.key)
  await setup.restore()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="relative flex min-h-dvh flex-col bg-slate-50 dark:bg-[#080b11] text-slate-900 dark:text-slate-100 selection:bg-sky-500/20 selection:text-sky-600 dark:selection:text-sky-400 cool-grid-bg transition-colors duration-200">
    <!-- Ambient glowing light backdrop -->
    <div
      class="pointer-events-none fixed inset-0 transition-opacity duration-700"
      :class="setup.primaryScope.value === 'world' ? 'bg-ambient-glow' : 'bg-ambient-indonesia'"
    />

    <!-- ── Header ─────────────────────────────────────────────── -->
    <header class="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#080b11]/80 backdrop-blur-md">
      <div class="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
        <div class="flex min-w-0 items-center gap-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 via-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20 ring-1 ring-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div class="min-w-0">
            <span class="font-display block truncate text-base font-black tracking-tight text-slate-900 dark:text-white">GeoGuesser</span>
            <p class="hidden truncate text-[11px] text-slate-500 dark:text-slate-400 sm:block">Geografi Interaktif Dunia &amp; Indonesia</p>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="focusable flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
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
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>

    <!-- ── Main ───────────────────────────────────────────────── -->
    <main class="relative z-10 mx-auto w-full max-w-[1400px] flex-1 px-4 pb-40 pt-6 sm:px-6 sm:py-8 sm:pb-36 lg:px-10">
      <!-- Hero + Daily Challenge -->
      <div class="menu-rise mb-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div class="max-w-3xl">
          <div class="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            <span class="h-1.5 w-1.5 rounded-full bg-sky-500" />
            Latihan peta &amp; batas wilayah, sepenuhnya offline
          </div>

          <h1 class="font-display text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Kenali bentuk &amp; letak
            <span class="bg-gradient-to-r from-sky-500 via-indigo-500 to-cyan-400 bg-clip-text text-transparent">setiap wilayah</span>
          </h1>

          <p class="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Kuis geografi presisi tinggi — dari kecamatan di kotamu sampai negara di seberang benua.
            Semua data batas wilayah tersimpan lokal, jadi bisa dimainkan tanpa koneksi.
          </p>

          <div class="mt-5 flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-2.5 py-1 text-slate-700 dark:text-slate-300 shadow-sm">🇮🇩 6.644 Kecamatan</span>
            <span class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-2.5 py-1 text-slate-700 dark:text-slate-300 shadow-sm">🏙️ 514 Kab / Kota</span>
            <span class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-2.5 py-1 text-slate-700 dark:text-slate-300 shadow-sm">🏛️ 38 Provinsi</span>
            <span class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-2.5 py-1 text-slate-700 dark:text-slate-300 shadow-sm">🌍 175 Negara</span>
          </div>
        </div>

        <!-- Daily challenge card -->
        <section
          class="step-card overflow-hidden p-5"
          aria-labelledby="daily-title"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 id="daily-title" class="text-sm font-bold text-slate-900 dark:text-white">Tantangan Harian</h2>
                <span class="rounded-full bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  {{ daily.key }}
                </span>
              </div>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Satu konfigurasi yang sama untuk semua pemain hari ini.
              </p>
            </div>
            <span class="shrink-0 text-2xl" aria-hidden="true">🎯</span>
          </div>

          <dl class="mt-4 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-950/50 p-2">
              <dt class="text-[10px] font-bold uppercase text-slate-400">Wilayah</dt>
              <dd class="mt-0.5 truncate text-xs font-bold text-slate-900 dark:text-white">
                {{ DAILY_SCOPE_LABEL[daily.kind] }}
              </dd>
            </div>
            <div class="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-950/50 p-2">
              <dt class="text-[10px] font-bold uppercase text-slate-400">Mode</dt>
              <dd class="mt-0.5 truncate text-xs font-bold text-slate-900 dark:text-white">
                {{ daily.mode === 'A' ? 'Klik Peta' : 'Pilih Nama' }}
              </dd>
            </div>
            <div class="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-950/50 p-2">
              <dt class="text-[10px] font-bold uppercase text-slate-400">Waktu</dt>
              <dd class="mt-0.5 truncate text-xs font-bold" :class="daily.timer ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'">
                {{ daily.timer ? '15 dtk' : 'Santai' }}
              </dd>
            </div>
          </dl>

          <div v-if="dailyDone" class="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
            <span aria-hidden="true">✓</span>
            <span class="font-semibold text-emerald-700 dark:text-emerald-400">
              Sudah selesai — {{ dailyDone.score }} poin ({{ dailyDone.accuracy }}%)
            </span>
          </div>

          <button
            type="button"
            :disabled="!canStart"
            class="focusable mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 text-xs font-bold text-amber-700 dark:text-amber-300 transition hover:bg-amber-500/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            @click="startDaily"
          >
            {{ dailyDone ? 'Main Ulang Tantangan' : 'Mainkan Tantangan Hari Ini' }}
          </button>
        </section>
      </div>

      <!-- Error notification if dataset fails -->
      <div v-if="error" class="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{{ error }}</span>
      </div>

      <!-- ══ Setup grid ══ -->
      <div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <!-- ── STEP 1: Wilayah ── -->
        <section class="step-card menu-rise p-5 sm:p-6 lg:col-span-7 xl:col-span-8" style="animation-delay: 40ms" aria-labelledby="map-title">
          <div class="mb-5 flex items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800/80 pb-3.5">
            <div class="flex min-w-0 items-center gap-3">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 font-mono text-xs font-bold text-sky-600 dark:text-sky-400">1</span>
              <div class="min-w-0">
                <h2 id="map-title" class="text-sm font-bold text-slate-900 dark:text-white">Pilih Wilayah</h2>
                <p class="truncate text-xs text-slate-500 dark:text-slate-400">Tentukan peta dan tingkat cakupan yang mau diuji.</p>
              </div>
            </div>

            <span class="hidden shrink-0 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:text-slate-400 sm:inline-flex">
              {{ setup.poolSize.value }} wilayah siap
            </span>
          </div>

          <!-- Dunia vs Indonesia -->
          <div class="grid gap-3.5 sm:grid-cols-2" role="radiogroup" aria-label="Cakupan utama">
            <button
              type="button"
              role="radio"
              class="pick-card focusable flex items-start gap-3.5 p-4 text-left"
              :aria-checked="setup.primaryScope.value === 'world'"
              :class="setup.primaryScope.value === 'world' ? '!border-sky-500/60 !bg-sky-500/10 ring-2 ring-sky-500/20' : ''"
              @click="setup.setPrimaryScope('world')"
            >
              <span
                class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition"
                :class="setup.primaryScope.value === 'world' ? 'border-sky-500/50 bg-sky-500/20 text-sky-600 dark:text-sky-400' : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 text-slate-500'"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </span>
              <span class="min-w-0 flex-1">
                <span class="font-display block text-sm font-bold text-slate-900 dark:text-white">Seluruh Dunia</span>
                <span class="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">175 negara lintas benua.</span>
              </span>
              <span
                v-if="setup.primaryScope.value === 'world'"
                class="shrink-0 text-sm font-bold text-sky-500"
                aria-hidden="true"
              >✓</span>
            </button>

            <button
              type="button"
              role="radio"
              class="pick-card focusable flex items-start gap-3.5 p-4 text-left"
              :aria-checked="setup.primaryScope.value === 'indonesia'"
              :class="setup.primaryScope.value === 'indonesia' ? '!border-rose-500/60 !bg-rose-500/10 ring-2 ring-rose-500/20' : ''"
              @click="setup.setPrimaryScope('indonesia')"
            >
              <span
                class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xl transition"
                :class="setup.primaryScope.value === 'indonesia' ? 'border-rose-500/50 bg-rose-500/15' : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80'"
              >🇮🇩</span>
              <span class="min-w-0 flex-1">
                <span class="font-display block text-sm font-bold text-slate-900 dark:text-white">Indonesia</span>
                <span class="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">Provinsi, kab/kota, sampai kecamatan.</span>
              </span>
              <span
                v-if="setup.primaryScope.value === 'indonesia'"
                class="shrink-0 text-sm font-bold text-rose-500"
                aria-hidden="true"
              >✓</span>
            </button>
          </div>

          <!-- Filter benua / kepulauan -->
          <div
            v-if="setup.activeScope.value === 'world' || setup.activeScope.value === 'id-provinces'"
            class="mt-5"
          >
            <label class="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {{ setup.activeScope.value === 'id-provinces' ? 'Saring kepulauan' : 'Saring benua' }}
            </label>
            <div class="mt-2 max-w-sm">
              <SearchSelect
                v-model="setup.regionFilter.value"
                :options="regionFilterOptions"
                :label="setup.activeScope.value === 'id-provinces' ? 'Saring kepulauan' : 'Saring benua'"
                :search-placeholder="setup.activeScope.value === 'id-provinces' ? 'Cari kepulauan…' : 'Cari benua…'"
              />
            </div>
          </div>

          <!-- Sub-opsi Indonesia -->
          <div v-if="setup.primaryScope.value === 'indonesia'" class="mt-5 space-y-4">
            <div class="seg-track grid grid-cols-2 sm:grid-cols-4" role="radiogroup" aria-label="Tingkat wilayah Indonesia">
              <button
                v-for="lvl in [
                  { key: 'provinces' as const, icon: '🏛️', label: '38 Provinsi' },
                  { key: 'kabupaten' as const, icon: '🏙️', label: 'Kab / Kota' },
                  { key: 'kecamatan' as const, icon: '🏘️', label: 'Kecamatan' },
                  { key: 'mixed' as const, icon: '🎲', label: 'Campuran' },
                ]"
                :key="lvl.key"
                type="button"
                role="radio"
                class="seg-item focusable justify-center text-center"
                :aria-checked="setup.indonesiaLevel.value === lvl.key"
                :class="setup.indonesiaLevel.value === lvl.key ? '!bg-white dark:!bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm' : ''"
                @click="setup.setIndonesiaLevel(lvl.key)"
              >
                <span aria-hidden="true">{{ lvl.icon }}</span> {{ lvl.label }}
              </button>
            </div>

            <!-- LEVEL: KECAMATAN -->
            <div v-if="setup.indonesiaLevel.value === 'kecamatan'" class="space-y-4 rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] dark:bg-sky-950/20 p-4 shadow-sm sm:p-5">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-900 dark:text-white">Pilih Kabupaten / Kota</span>
                    <span class="rounded-full bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-600 dark:text-sky-400">Level Mikro</span>
                  </div>
                  <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Cari kota mana pun di Indonesia untuk menebak batas kecamatannya.
                  </p>
                </div>

                <div class="w-full space-y-2 sm:w-80">
                  <SearchSelect
                    v-model="setup.kecamatanProvince.value"
                    :options="provinceOptions"
                    label="Pilih provinsi"
                    search-placeholder="Cari provinsi…"
                  />
                  <CityPicker
                    :cities="availableCities"
                    :provinces="kecamatanProvinces"
                    :selected-id="activeKecamatanCity?.id ?? null"
                    :province="setup.kecamatanProvince.value"
                    :disabled="pending"
                    @select="setup.setCity"
                  />
                </div>
              </div>

              <div class="space-y-2 border-t border-slate-200/80 dark:border-slate-800/80 pt-3">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="mr-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">DKI Jakarta:</span>
                  <button
                    v-for="c in quickCities"
                    :key="c.id"
                    type="button"
                    class="focusable rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition"
                    :aria-pressed="activeKecamatanCity?.id === c.id"
                    :class="activeKecamatanCity?.id === c.id
                      ? 'border-sky-500 bg-sky-600 text-white shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:border-sky-500/40'"
                    @click="setup.setCity(c.id)"
                  >
                    {{ c.city.replace(/^(Kota|Kabupaten)( Administrasi)? /, '') }}
                  </button>
                </div>

                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="mr-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Kota lain:</span>
                  <button
                    v-for="c in popularMajorCities"
                    :key="c.id"
                    type="button"
                    class="focusable rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition"
                    :aria-pressed="activeKecamatanCity?.id === c.id"
                    :class="activeKecamatanCity?.id === c.id
                      ? 'border-sky-500 bg-sky-600 text-white shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:border-sky-500/40'"
                    @click="setup.setCity(c.id)"
                  >
                    {{ c.city.replace(/^(Kota|Kabupaten)( Administrasi)? /, '') }}
                  </button>
                </div>
              </div>

              <!-- Preview kecamatan -->
              <div class="rounded-xl border border-sky-500/30 bg-white/80 dark:bg-slate-900/80 p-3.5 shadow-sm">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <span class="truncate text-xs font-bold text-slate-900 dark:text-white">
                      {{ activeCityDistricts.length }} kecamatan di {{ setup.cityShortName.value }}
                    </span>
                  </div>
                  <span class="shrink-0 font-mono text-[10px] text-slate-500 dark:text-slate-400">Tersimpan offline</span>
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
            <div v-if="setup.indonesiaLevel.value === 'kabupaten'" class="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-4 shadow-sm sm:p-5">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                  <label class="text-xs font-bold text-slate-900 dark:text-white">Pilih provinsi induk</label>
                  <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Soal diambil dari seluruh kab/kota di provinsi ini.</p>
                </div>

                <div class="w-full sm:w-64">
                  <SearchSelect
                    v-model="setup.selectedProvince.value"
                    :options="kabupatenProvinceOptions"
                    label="Pilih provinsi"
                    search-placeholder="Cari provinsi…"
                  />
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-1.5 border-t border-slate-200/80 dark:border-slate-800/80 pt-3">
                <span class="mr-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Populer:</span>
                <button
                  v-for="prov in quickProvinces"
                  :key="prov"
                  type="button"
                  class="focusable rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition"
                  :aria-pressed="setup.selectedProvince.value === prov"
                  :class="setup.selectedProvince.value === prov
                    ? 'border-sky-500 bg-sky-600 text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-sky-500/40'"
                  @click="setup.setProvince(prov)"
                >
                  {{ prov }}
                </button>
              </div>

              <details class="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3">
                <summary class="focusable flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white [&::-webkit-details-marker]:hidden">
                  <span>Lihat {{ activeProvinceCities.length }} wilayah di {{ setup.selectedProvince.value }}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
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

            <!-- LEVEL: CAMPURAN -->
            <div v-if="setup.indonesiaLevel.value === 'mixed'" class="space-y-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-950/20 p-4 shadow-sm sm:p-5">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-slate-900 dark:text-white">Mode campuran acak</span>
                  <span class="rounded-full bg-indigo-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Multi-tingkat</span>
                </div>
                <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Tiap ronde berganti antara provinsi, kab/kota, dan kecamatan.
                </p>
              </div>

              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="lvl in [
                    { key: 'province' as const, label: 'Provinsi', icon: '🏛️', n: 38 },
                    { key: 'kabupaten' as const, label: 'Kab/Kota', icon: '🏙️', n: 514 },
                    { key: 'kecamatan' as const, label: 'Kecamatan', icon: '🏘️', n: setup.mixedCityCount.value * 13 },
                  ]"
                  :key="lvl.key"
                  type="button"
                  class="focusable rounded-xl border p-3 text-center transition"
                  :aria-pressed="setup.mixedLevels.value[lvl.key]"
                  :class="setup.mixedLevels.value[lvl.key]
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'"
                  @click="setup.toggleMixedLevel(lvl.key)"
                >
                  <span class="block text-base" aria-hidden="true">{{ lvl.icon }}</span>
                  <span class="mt-1 block text-xs font-bold">{{ lvl.label }}</span>
                  <span class="mt-0.5 block font-mono text-[10px] opacity-80">±{{ lvl.n }} soal</span>
                </button>
              </div>

              <div v-if="setup.mixedLevels.value.kecamatan" class="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                <div class="flex items-baseline justify-between text-xs">
                  <label for="mixed-cities" class="font-medium text-slate-700 dark:text-slate-300">Sumber kecamatan</label>
                  <span class="font-mono font-bold text-indigo-600 dark:text-indigo-400">{{ setup.mixedCityCount.value }} kota</span>
                </div>
                <input
                  id="mixed-cities"
                  v-model.number="setup.mixedCityCount.value"
                  type="range"
                  min="2"
                  max="12"
                  step="1"
                  class="w-full cursor-pointer accent-indigo-600"
                >
                <p class="text-[11px] text-slate-500 dark:text-slate-400">
                  Makin banyak kota, makin lama peta disiapkan sebelum sesi mulai.
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- ── STEP 2 & 3 ── -->
        <div class="space-y-6 lg:col-span-5 xl:col-span-4">
          <!-- STEP 2: Mode -->
          <section class="step-card menu-rise p-5 sm:p-6" style="animation-delay: 80ms" aria-labelledby="mode-title">
            <div class="mb-4 flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 font-mono text-xs font-bold text-sky-600 dark:text-sky-400">2</span>
              <div>
                <h2 id="mode-title" class="text-sm font-bold text-slate-900 dark:text-white">Mode Tantangan</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400">Pilih gaya interaksi permainan.</p>
              </div>
            </div>

            <div class="grid gap-3" role="radiogroup" aria-label="Mode permainan">
              <button
                v-for="m in [
                  { key: 'A' as const, title: 'Klik Petanya', desc: 'Nama muncul, cari lokasinya di peta.' },
                  { key: 'B' as const, title: 'Tebak Nama', desc: 'Wilayah disorot, pilih namanya dari 4 opsi.' },
                ]"
                :key="m.key"
                type="button"
                role="radio"
                class="pick-card focusable p-4"
                :aria-checked="setup.selectedMode.value === m.key"
                :class="setup.selectedMode.value === m.key ? '!border-sky-500 !bg-sky-500/10 ring-2 ring-sky-500/20' : ''"
                @click="setup.setMode(m.key)"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="flex min-w-0 items-center gap-3">
                    <div
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition"
                      :class="setup.selectedMode.value === m.key ? 'border-sky-500/50 bg-sky-500/20 text-sky-600 dark:text-sky-400' : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-500'"
                    >
                      <svg v-if="m.key === 'A'" xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="22" y1="12" x2="18" y2="12" /><line x1="6" y1="12" x2="2" y2="12" />
                        <line x1="12" y1="6" x2="12" y2="2" /><line x1="12" y1="22" x2="12" y2="18" />
                      </svg>
                      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
                      </svg>
                    </div>
                    <div class="min-w-0 text-left">
                      <h3 class="font-display text-sm font-bold text-slate-900 dark:text-white">{{ m.title }}</h3>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400">{{ m.desc }}</p>
                    </div>
                  </div>

                  <span
                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition"
                    :class="setup.selectedMode.value === m.key ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 dark:border-slate-700'"
                  >
                    <svg v-if="setup.selectedMode.value === m.key" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                </div>
              </button>
            </div>
          </section>

          <!-- STEP 3: Sesi -->
          <section class="step-card menu-rise p-5 sm:p-6" style="animation-delay: 120ms" aria-labelledby="session-title">
            <div class="mb-4 flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 font-mono text-xs font-bold text-sky-600 dark:text-sky-400">3</span>
              <div>
                <h2 id="session-title" class="text-sm font-bold text-slate-900 dark:text-white">Pengaturan Sesi</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400">Jumlah soal dan batas waktu tebakan.</p>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">Jumlah ronde</span>
                <div class="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Jumlah ronde">
                  <button
                    v-for="count in setup.roundOptions.value"
                    :key="count.value"
                    type="button"
                    role="radio"
                    class="focusable flex-1 rounded-xl border py-2 text-center text-xs font-bold transition"
                    :aria-checked="setup.selectedRounds.value === count.value"
                    :class="setup.selectedRounds.value === count.value
                      ? 'border-sky-500 bg-sky-500/15 text-sky-600 dark:text-sky-400 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'"
                    @click="setup.selectedRounds.value = count.value; playClick()"
                  >
                    {{ count.label }}
                  </button>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                class="focusable flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3.5 text-left transition hover:border-sky-500/40"
                :aria-checked="setup.timerEnabled.value"
                @click="setup.toggleTimer"
              >
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-slate-900 dark:text-white">Timer 15 detik</span>
                    <span v-if="setup.timerEnabled.value" class="rounded-full bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-600 dark:text-amber-400">Aktif</span>
                  </div>
                  <p class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Uji ketangkasan berpikir cepat.</p>
                </div>

                <div
                  class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200"
                  :class="setup.timerEnabled.value ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-700'"
                  aria-hidden="true"
                >
                  <span
                    class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200"
                    :class="setup.timerEnabled.value ? 'translate-x-[1.125rem]' : 'translate-x-[0.1875rem]'"
                  />
                </div>
              </button>

              <div>
                <button
                  type="button"
                  class="focusable flex w-full items-center justify-between rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-100/60 dark:bg-slate-900/40 px-3.5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800/70"
                  :aria-expanded="showRules"
                  @click="showRules = !showRules"
                >
                  <span>Sistem penilaian skor</span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform" :class="showRules ? 'rotate-180' : ''" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
                <div v-if="showRules" class="mt-2 space-y-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                  <p><strong class="text-slate-900 dark:text-white">+10 poin</strong> untuk setiap tebakan tepat.</p>
                  <p><strong class="text-slate-900 dark:text-white">+2 poin bonus</strong> per kenaikan streak beruntun.</p>
                  <p><strong class="text-slate-900 dark:text-white">Salah tebak</strong> tidak mengurangi poin, hanya mereset streak.</p>
                </div>
              </div>
            </div>
          </section>

          <!-- Rekor cakupan ini -->
          <section
            v-if="scopeRecord.gamesPlayed > 0"
            class="step-card menu-rise p-5"
            style="animation-delay: 160ms"
            aria-labelledby="record-title"
          >
            <div class="flex items-center justify-between gap-2">
              <h2 id="record-title" class="text-sm font-bold text-slate-900 dark:text-white">Rekor kamu di sini</h2>
              <span class="shrink-0 font-mono text-[10px] text-slate-500 dark:text-slate-400">{{ scopeRecord.gamesPlayed }}× main</span>
            </div>
            <p class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{{ setup.scopeLabel.value }}</p>

            <div class="mt-3 grid grid-cols-3 gap-2 text-center">
              <div class="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-950/50 p-2.5">
                <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Skor</p>
                <p class="font-mono mt-0.5 text-lg font-black text-slate-900 dark:text-white">{{ scopeRecord.bestScore }}</p>
              </div>
              <div class="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-950/50 p-2.5">
                <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Streak</p>
                <p class="font-mono mt-0.5 text-lg font-black text-amber-500">{{ scopeRecord.bestStreak }}</p>
              </div>
              <div class="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-slate-950/50 p-2.5">
                <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Akurasi</p>
                <p class="font-mono mt-0.5 text-lg font-black text-sky-600 dark:text-sky-400">{{ scopeRecord.bestAccuracy }}%</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <!-- Statistik keseluruhan -->
      <div v-if="stats.overall.gamesPlayed > 0" class="menu-rise mt-8 grid max-w-md grid-cols-3 gap-3" style="animation-delay: 200ms">
        <div class="step-card p-3 text-center">
          <p class="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Skor tertinggi</p>
          <p class="font-mono mt-0.5 text-xl font-black text-slate-900 dark:text-white">{{ stats.overall.bestScore }}</p>
        </div>
        <div class="step-card p-3 text-center">
          <p class="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Streak puncak</p>
          <p class="font-mono mt-0.5 text-xl font-black text-amber-500">{{ stats.overall.bestStreak }} 🔥</p>
        </div>
        <div class="step-card p-3 text-center">
          <p class="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total sesi</p>
          <p class="font-mono mt-0.5 text-xl font-black text-sky-600 dark:text-sky-400">{{ stats.overall.gamesPlayed }}</p>
        </div>
      </div>
    </main>

    <!-- ── Launch bar ─────────────────────────────────────────── -->
    <div class="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-6 sm:pb-4 lg:px-10">
      <div class="relative mx-auto w-full max-w-[1400px] overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-xl">
        <div class="absolute inset-x-0 top-0 h-0.5 bg-slate-200 dark:bg-slate-800">
          <div
            class="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-300"
            :style="{ width: `${Math.max(5, Math.min(100, (setup.effectiveRounds.value / Math.max(setup.poolSize.value, 1)) * 100))}%` }"
          />
        </div>

        <div class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 lg:px-6">
          <div class="min-w-0 flex-1">
            <p class="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Ringkasan misi
            </p>
            <dl class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <div class="flex min-w-0 items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <dt class="sr-only">Wilayah</dt>
                <dd class="truncate font-semibold text-slate-900 dark:text-white">{{ setup.scopeLabel.value }}</dd>
              </div>
              <span class="text-slate-300 dark:text-slate-700" aria-hidden="true">•</span>
              <div class="flex items-center gap-1.5">
                <dt class="text-slate-500 dark:text-slate-400">Mode</dt>
                <dd class="font-semibold text-slate-900 dark:text-white">{{ setup.modeLabel.value }}</dd>
              </div>
              <span class="text-slate-300 dark:text-slate-700" aria-hidden="true">•</span>
              <div class="flex items-center gap-1.5">
                <dt class="text-slate-500 dark:text-slate-400">Ronde</dt>
                <dd class="font-mono font-semibold text-slate-900 dark:text-white">
                  {{ setup.effectiveRounds.value }}
                  <span class="text-slate-400 dark:text-slate-500">/ {{ setup.poolSize.value }} {{ setup.unitLabel.value }}</span>
                </dd>
              </div>
              <span class="hidden text-slate-300 dark:text-slate-700 sm:inline" aria-hidden="true">•</span>
              <div class="hidden items-center gap-1.5 sm:flex">
                <dt class="text-slate-500 dark:text-slate-400">Waktu</dt>
                <dd class="font-semibold" :class="setup.timerEnabled.value ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'">
                  {{ setup.timerEnabled.value ? '15 detik' : 'Santai' }}
                </dd>
              </div>
            </dl>
          </div>

          <button
            type="button"
            :disabled="!canStart"
            class="focusable group inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-5 font-display text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition hover:from-sky-500 hover:to-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 sm:w-auto"
            @click="start()"
          >
            <span
              v-if="pending || setup.mixedPending.value"
              class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden="true"
            />
            <span>{{ pending || setup.mixedPending.value ? 'Menyiapkan peta…' : 'Mulai Main' }}</span>
            <span class="shadcn-kbd shadcn-kbd-on-accent hidden text-[10px] lg:inline-flex">Enter ↵</span>
            <svg v-if="!pending && !setup.mixedPending.value" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
