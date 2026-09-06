<script setup lang="ts">
import type { GameMode, DatasetScope } from '~/types/game'

const { regions, availableProvinces, pending, error, load, setScope, itemsInRegion } = useGeoData()
const game = useGameStore()
const { soundEnabled, toggleSound, playClick } = useAudio()

const primaryScope = ref<'world' | 'indonesia'>('indonesia')
const indonesiaLevel = ref<'provinces' | 'kabupaten'>('kabupaten')
const selectedProvince = ref('DKI Jakarta')
const regionFilter = ref('DKI Jakarta')
const timerEnabled = ref(false)
const selectedRounds = ref(5)
const showRules = ref(false)

const stats = reactive({
  bestScore: 0,
  bestStreak: 0,
  gamesPlayed: 0,
})

const quickProvinces = ['DKI Jakarta', 'Bali', 'Jawa Barat', 'DI Yogyakarta', 'Jawa Timur', 'Sumatera Utara', 'Jawa Tengah', 'Banten']

const activeScope = computed<DatasetScope>(() => {
  if (primaryScope.value === 'world') return 'world'
  return indonesiaLevel.value === 'provinces' ? 'id-provinces' : 'id-kabupaten'
})

// Preload id-kabupaten so DKI Jakarta and all 38 provinces are immediately ready
await load('province', 'id-kabupaten')

async function selectPrimaryScope(scope: 'world' | 'indonesia') {
  if (primaryScope.value === scope) return
  primaryScope.value = scope
  playClick()
  await syncScope()
}

async function selectIndonesiaLevel(lvl: 'provinces' | 'kabupaten') {
  if (indonesiaLevel.value === lvl) return
  indonesiaLevel.value = lvl
  playClick()
  await syncScope()
}

async function syncScope() {
  const scope = activeScope.value
  await setScope(scope)

  if (scope === 'id-kabupaten') {
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
  regionFilter.value = prov
  playClick()
  selectedRounds.value = Math.min(10, itemsInRegion(prov).length || 5)
}

watch(selectedProvince, (prov) => {
  if (activeScope.value === 'id-kabupaten') {
    regionFilter.value = prov
    selectedRounds.value = Math.min(10, itemsInRegion(prov).length || 5)
  }
})

onMounted(() => {
  if (import.meta.client) {
    stats.bestScore = Number(localStorage.getItem('geoguess_best_score') || '0')
    stats.bestStreak = Number(localStorage.getItem('geoguess_best_streak') || '0')
    stats.gamesPlayed = Number(localStorage.getItem('geoguess_games_played') || '0')
  }
})

const poolSize = computed(() => itemsInRegion(regionFilter.value).length)

const activeProvinceCities = computed(() => {
  if (activeScope.value !== 'id-kabupaten') return []
  return itemsInRegion(selectedProvince.value)
})

const activeProvinceExampleCity = computed(() => {
  const cities = activeProvinceCities.value
  if (!cities.length) return 'local districts'
  if (cities.length >= 2) return `${cities[0]?.name} or ${cities[1]?.name}`
  return cities[0]?.name || 'local districts'
})

const availableRoundOptions = computed(() => {
  const total = poolSize.value
  if (total <= 5) {
    return [{ label: `All ${total}`, value: total }]
  }
  if (total <= 10) {
    return [
      { label: '5 Rounds', value: 5 },
      { label: `All ${total}`, value: total },
    ]
  }
  return [
    { label: '5 Rounds', value: 5 },
    { label: '10 Rounds', value: 10 },
    { label: total <= 20 ? `All ${total}` : '20 Rounds', value: Math.min(20, total) },
  ]
})

function start(mode: GameMode) {
  const pool = itemsInRegion(regionFilter.value)
  if (!pool.length) return
  playClick()
  game.startGame({
    mode,
    pool,
    regionFilter: regionFilter.value,
    timerEnabled: timerEnabled.value,
    roundsCount: selectedRounds.value,
    scope: activeScope.value,
    provinceName: activeScope.value === 'id-kabupaten' ? selectedProvince.value : '',
  })
  navigateTo({ path: '/play', query: { mode } })
}
</script>

<template>
  <div class="relative min-h-dvh bg-[#070a12] text-slate-100 flex flex-col justify-between selection:bg-sky-500/20 selection:text-sky-200">
    <!-- Ambient Lighting -->
    <div
      class="pointer-events-none fixed inset-0 transition-opacity duration-500"
      :class="primaryScope === 'world' ? 'bg-ambient-glow' : 'bg-ambient-indonesia'"
    />

    <!-- Header Navigation -->
    <header class="relative z-10 border-b border-white/[0.08] bg-[#070a12]/80 px-6 py-3.5 backdrop-blur-md">
      <div class="mx-auto flex max-w-4xl items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-sky-400 shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm tracking-tight text-white">GeoGuesser</span>
            <span class="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-400">
              Pro
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            type="button"
            class="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/80 px-2.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
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
            <span>{{ soundEnabled ? 'Audio On' : 'Muted' }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="relative z-10 mx-auto w-full max-w-4xl px-4 py-8 sm:py-10 space-y-7">
      <!-- Title & Geographic Scope Selection -->
      <div class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Spatial Geography Quiz
            </h1>
            <p class="mt-1 text-xs sm:text-sm text-slate-400">
              Pinpoint global borders or drill down into specific provinces and smallest local districts.
            </p>
          </div>

          <!-- Primary Country / World Selector -->
          <div class="inline-flex h-11 items-center rounded-xl border border-white/10 bg-slate-900/90 p-1 shadow-md">
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all"
              :class="primaryScope === 'world'
                ? 'bg-sky-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white'"
              @click="selectPrimaryScope('world')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>Global World</span>
            </button>

            <button
              type="button"
              class="flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all"
              :class="primaryScope === 'indonesia'
                ? 'bg-rose-500 text-white font-bold shadow-md'
                : 'text-slate-400 hover:text-white'"
              @click="selectPrimaryScope('indonesia')"
            >
              <span>🇮🇩</span>
              <span>Country: Indonesia</span>
            </button>
          </div>
        </div>

        <!-- Indonesia Configuration Box (Provinces vs Smallest District Drill-Down) -->
        <div
          v-if="primaryScope === 'indonesia'"
          class="rounded-2xl border border-rose-500/25 bg-slate-900/90 p-4 sm:p-5 space-y-4 shadow-xl"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                <span>🇮🇩</span> Indonesia Granularity Level:
              </span>
              <p class="text-xs text-slate-400 mt-0.5">
                Choose national provinces or drill down into specific regions to guess smallest local divisions.
              </p>
            </div>

            <!-- Granularity Switcher -->
            <div class="inline-flex h-9 items-center rounded-lg border border-white/10 bg-slate-950 p-1">
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition"
                :class="indonesiaLevel === 'kabupaten'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'"
                @click="selectIndonesiaLevel('kabupaten')"
              >
                <span>🏙️</span>
                <span>Smallest Units (Kota / Kab)</span>
              </button>
              <button
                type="button"
                class="flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition"
                :class="indonesiaLevel === 'provinces'
                  ? 'bg-rose-500 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'"
                @click="selectIndonesiaLevel('provinces')"
              >
                <span>🏛️</span>
                <span>38 Provinces</span>
              </button>
            </div>
          </div>

          <!-- Smallest Administrative Unit (Kota/Kabupaten) Selector -->
          <div v-if="indonesiaLevel === 'kabupaten'" class="space-y-3.5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span class="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                  <span>📍</span> Specific Province Selection:
                </span>
                <p class="text-xs text-slate-400 mt-0.5">
                  Quizzing the smallest administrative divisions (Kota Administrasi & Kabupaten) inside this province.
                </p>
              </div>

              <!-- Full Dropdown (All 38 provinces) -->
              <div class="relative min-w-[240px]">
                <select
                  v-model="selectedProvince"
                  class="w-full appearance-none rounded-xl border border-amber-500/40 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-amber-200 outline-none pr-8 transition focus:border-amber-400"
                  @change="selectProvince(selectedProvince)"
                >
                  <option v-for="prov in availableProvinces" :key="prov.name" :value="prov.name">
                    {{ prov.name }} ({{ prov.count }} Kab/Kota)
                  </option>
                </select>
                <div class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-amber-300">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            <!-- Popular Quick Pick Chips -->
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[11px] font-semibold text-slate-400">Popular:</span>
              <button
                v-for="prov in quickProvinces"
                :key="prov"
                type="button"
                class="rounded-lg px-2.5 py-1 text-xs font-semibold transition"
                :class="selectedProvince === prov
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-white/5'"
                @click="selectProvince(prov)"
              >
                {{ prov }}
              </button>
            </div>

            <!-- Smallest Administrative Divisions Live Preview -->
            <div class="rounded-xl border border-amber-500/20 bg-slate-950/80 p-3.5 space-y-2">
              <div class="flex items-center justify-between text-xs font-semibold text-amber-300">
                <span class="flex items-center gap-1.5">
                  <span>🔍</span> Smallest Divisions in {{ selectedProvince }}:
                </span>
                <span class="font-mono text-slate-400 text-[11px]">{{ activeProvinceCities.length }} Smallest Areas</span>
              </div>
              <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                <span
                  v-for="city in activeProvinceCities"
                  :key="city.id"
                  class="rounded-md border border-white/10 bg-slate-900/90 px-2 py-0.5 text-[11px] font-medium text-slate-200 shadow-sm"
                >
                  {{ city.name }}
                </span>
              </div>
            </div>
          </div>

          <!-- National 38 Provinces Description -->
          <div v-else class="rounded-xl border border-rose-500/20 bg-slate-950/60 p-3 text-xs text-rose-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="inline-flex h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
              <span>National Provinces: Quiz all 38 provinces across Java, Sumatra, Kalimantan, Sulawesi, Bali, and Papua.</span>
            </div>
            <span class="font-mono font-bold opacity-80">{{ poolSize }} Provinces</span>
          </div>
        </div>

        <!-- Global World Mode Description -->
        <div
          v-else
          class="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3.5 text-xs text-sky-200 flex items-center justify-between"
        >
          <div class="flex items-center gap-2">
            <span class="inline-flex h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            <span>Global Sovereignty: 177 sovereign nations across 6 continents.</span>
          </div>
          <span class="font-mono font-bold opacity-80">{{ poolSize }} Nations</span>
        </div>
      </div>

      <!-- Error alert -->
      <div v-if="error" class="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-300">
        {{ error }}
      </div>

      <!-- Game Mode Selection Cards -->
      <div class="grid gap-4 sm:grid-cols-2">
        <!-- Mode A: Locate on Map -->
        <div class="raycast-card group relative flex flex-col justify-between rounded-2xl p-5">
          <div>
            <div class="flex items-center justify-between mb-3.5">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-800/80 text-sky-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="22" y1="12" x2="18" y2="12" />
                  <line x1="6" y1="12" x2="2" y2="12" />
                  <line x1="12" y1="6" x2="12" y2="2" />
                  <line x1="12" y1="22" x2="12" y2="18" />
                </svg>
              </div>
              <span class="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300">
                Mode A
              </span>
            </div>

            <h2 class="text-lg font-bold text-white group-hover:text-sky-300 transition">
              {{ activeScope === 'id-kabupaten' ? `Pinpoint in ${selectedProvince}` : activeScope === 'id-provinces' ? 'Pinpoint Indonesian Province' : 'Locate on World Map' }}
            </h2>
            <p class="mt-1.5 text-xs text-slate-400 leading-relaxed">
              {{ activeScope === 'id-kabupaten'
                ? `Random questions ask where an area like ${activeProvinceExampleCity} is located. Click its boundary polygon on the map!`
                : activeScope === 'id-provinces'
                ? 'A province name appears. Locate and click its exact borders on the Indonesian archipelago map.'
                : 'A sovereign country name appears. Locate and click its boundary polygon on the global map.'
              }}
            </p>
          </div>

          <div class="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between">
            <span class="text-xs text-slate-400 font-medium">
              {{ activeScope === 'id-kabupaten' ? `${poolSize} Kota / Kab` : 'Pinpoint Challenge' }}
            </span>
            <button
              type="button"
              :disabled="pending || !poolSize"
              class="inline-flex h-8.5 items-center justify-center rounded-xl bg-white px-3.5 text-xs font-semibold text-slate-950 transition hover:bg-slate-200 active:scale-95 disabled:opacity-50 shadow-md"
              @click="start('A')"
            >
              Start Game
              <svg xmlns="http://www.w3.org/2000/svg" class="ml-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Mode B: Identify Territory -->
        <div class="raycast-card group relative flex flex-col justify-between rounded-2xl p-5">
          <div>
            <div class="flex items-center justify-between mb-3.5">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-800/80 text-amber-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <span class="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                Mode B
              </span>
            </div>

            <h2 class="text-lg font-bold text-white group-hover:text-amber-300 transition">
              {{ activeScope === 'id-kabupaten' ? `Identify Area in ${selectedProvince}` : activeScope === 'id-provinces' ? 'Identify Highlighted Province' : 'Identify Territory Outline' }}
            </h2>
            <p class="mt-1.5 text-xs text-slate-400 leading-relaxed">
              {{ activeScope === 'id-kabupaten'
                ? `A city/regency outline in ${selectedProvince} is highlighted in yellow. Guess which smallest area it is from 4 options.`
                : activeScope === 'id-provinces'
                ? 'An Indonesian province is highlighted in yellow on the map. Identify the correct province among 4 choices.'
                : 'A territory outline is highlighted on the map. Select the correct nation from 4 multiple-choice options.'
              }}
            </p>
          </div>

          <div class="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between">
            <span class="text-xs text-slate-400 font-medium">Multiple Choice</span>
            <button
              type="button"
              :disabled="pending || !poolSize"
              class="inline-flex h-8.5 items-center justify-center rounded-xl bg-white px-3.5 text-xs font-semibold text-slate-950 transition hover:bg-slate-200 active:scale-95 disabled:opacity-50 shadow-md"
              @click="start('B')"
            >
              Start Game
              <svg xmlns="http://www.w3.org/2000/svg" class="ml-1.5 h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Settings Panel -->
      <div class="raycast-card rounded-2xl p-5 sm:p-6 space-y-5">
        <div class="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
          <div>
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Session Configuration</span>
            </h3>
            <p class="text-xs text-slate-400">Configure regions and round mechanics</p>
          </div>
          <span class="rounded-md border border-white/10 bg-slate-800/60 px-2.5 py-1 text-xs font-mono text-slate-300">
            {{ poolSize }} in pool
          </span>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <!-- Region Filter (only if not in id-kabupaten) -->
          <div v-if="activeScope !== 'id-kabupaten'" class="space-y-1.5">
            <label for="region-select" class="text-xs font-semibold text-slate-300">
              {{ activeScope === 'id-provinces' ? 'Island Group Filter' : 'Continent Scope' }}
            </label>
            <div class="relative">
              <select
                id="region-select"
                v-model="regionFilter"
                class="w-full appearance-none rounded-xl border border-white/10 bg-slate-900/90 px-3.5 py-2.5 text-xs text-slate-200 outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 pr-9"
              >
                <option value="all">
                  {{ activeScope === 'id-provinces' ? 'All 38 Provinces (Whole Indonesia)' : 'All Continents (Entire Globe)' }}
                </option>
                <option v-for="r in regions" :key="r" :value="r">{{ r }}</option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          <!-- Active Province Status (if in id-kabupaten) -->
          <div v-else class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-300">
              Active Province Scope
            </label>
            <div class="flex items-center justify-between rounded-xl border border-amber-500/30 bg-slate-900/90 px-3.5 py-2.5 text-xs">
              <span class="font-bold text-amber-200">{{ selectedProvince }}</span>
              <span class="font-mono text-slate-400">{{ poolSize }} Areas</span>
            </div>
          </div>

          <!-- Rounds Selector -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-300">
              Game Duration (Max: {{ poolSize }})
            </label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="count in availableRoundOptions"
                :key="count.value"
                type="button"
                class="rounded-xl border py-2 text-xs font-bold transition"
                :class="selectedRounds === count.value
                  ? 'border-sky-500 bg-sky-500/20 text-sky-300 shadow-sm'
                  : 'border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/20 hover:text-white'"
                @click="selectedRounds = count.value"
              >
                {{ count.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Switches row -->
        <div class="pt-3 border-t border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <!-- 15s Timer Switch -->
          <label class="flex items-center gap-3 cursor-pointer select-none">
            <div
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
              :class="timerEnabled ? 'bg-sky-500' : 'bg-slate-800'"
              @click.prevent="timerEnabled = !timerEnabled"
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out"
                :class="timerEnabled ? 'translate-x-4 bg-white' : 'translate-x-0 bg-slate-400'"
              />
            </div>
            <div>
              <span class="text-xs font-semibold text-slate-200 block">15-Second Blitz Timer</span>
              <span class="text-[11px] text-slate-400">Strict speed challenge per round</span>
            </div>
          </label>

          <!-- Rules toggle -->
          <button
            type="button"
            class="text-xs text-slate-400 hover:text-white underline underline-offset-4 transition"
            @click="showRules = !showRules"
          >
            {{ showRules ? 'Hide Rules' : 'Scoring System' }}
          </button>
        </div>

        <!-- Collapsible Rules -->
        <div
          v-if="showRules"
          class="rounded-xl border border-white/10 bg-slate-900/80 p-3.5 text-xs text-slate-300 space-y-1"
        >
          <p><strong class="text-white">Base Score:</strong> +10 points per correct answer.</p>
          <p><strong class="text-white">Streak Multiplier:</strong> +2 bonus points per streak count.</p>
          <p><strong class="text-white">No Deductions:</strong> Wrong answers reset streak, never deduct score.</p>
        </div>
      </div>

      <!-- Stats Grid -->
      <div v-if="stats.gamesPlayed > 0" class="grid grid-cols-3 gap-3">
        <div class="raycast-card rounded-xl p-4 text-center">
          <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">High Score</p>
          <p class="mt-1 font-mono text-2xl font-black text-white">{{ stats.bestScore }}</p>
        </div>
        <div class="raycast-card rounded-xl p-4 text-center">
          <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Peak Streak</p>
          <p class="mt-1 font-mono text-2xl font-black text-amber-400">{{ stats.bestStreak }} 🔥</p>
        </div>
        <div class="raycast-card rounded-xl p-4 text-center">
          <p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Sessions Completed</p>
          <p class="mt-1 font-mono text-2xl font-black text-sky-400">{{ stats.gamesPlayed }}</p>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="relative z-10 border-t border-white/[0.08] px-6 py-4 text-center text-xs text-slate-500">
      <p>GeoGuesser Pro · Offline vector boundaries with multi-level drill down (World, Provinces, and Kabupaten/Kota).</p>
    </footer>
  </div>
</template>
