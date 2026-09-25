<script setup lang="ts">
import type { RegionItem } from '~/types/game'
import { masteryStatus } from '~/utils/mastery'
import { neighborIds, regionFact } from '~/utils/regionFacts'

/**
 * Mode belajar: peta tanpa soal, skor, atau timer. Ketuk wilayah mana saja
 * untuk melihat namanya, induknya, dan tetangganya — pemain baru bisa
 * mengenal petanya dulu sebelum diuji, alih-alih belajar dari kekalahan.
 */
const game = useGameStore()
const { collection, load } = useGeoData()
const { playClick } = useAudio()
const { t } = useI18n()
const { formatScope } = useScopeLabel()
const { mode: viewMode } = useMapViewMode()

const isGlobe = computed(() => viewMode.value === 'globe' && game.datasetScope === 'world')

if (game.phase === 'idle' || game.currentTarget) {
  await navigateTo('/')
}

const targetScope = game.datasetScope || 'world'
const targetLevel = targetScope === 'world'
  ? 'world'
  : (targetScope === 'id-kecamatan' || targetScope === 'us-county')
    ? 'district'
    : 'province'
await load(targetLevel, targetScope)

const mapRef = ref<{
  mark: (id: string, kind: 'correct' | 'wrong' | 'target') => void
  heat: (id: string, t: number) => void
  resetStyles: () => void
  fitRegion: (id: string) => void
  fitPool: (items: RegionItem[]) => void
  setInteractive: (v: boolean) => void
} | null>(null)
const mapReady = ref(false)

const scopeLabel = computed(() => formatScope(game.scopeParts ?? { scope: game.datasetScope }))

const selected = ref<RegionItem | null>(null)
/** Wilayah yang sudah dibuka sesi ini — penanda kemajuan menjelajah. */
const explored = ref(new Set<string>())

/** `toRaw`: koleksi `useState` berupa proxy, dan fakta membaca semua titiknya. */
const raw = computed(() => (collection.value ? toRaw(collection.value) : null))

const info = computed(() => {
  const item = selected.value
  const col = raw.value
  if (!item || !col) return null
  const fact = regionFact(col, item.id)
  const poolIds = new Set(game.pool.map(p => p.id))
  const byId = new Map(game.pool.map(p => [p.id, p]))
  const neighbors = neighborIds(col, item.id)
    .filter(id => poolIds.has(id))
    .map(id => byId.get(id)!)
    .sort((a, b) => a.name.localeCompare(b.name))
  return {
    parent: fact?.parent ?? item.region,
    neighbors,
    status: masteryStatus(game.datasetScope, item.id),
  }
})

/**
 * Terjemahan resmi hanya ditampilkan kalau berbeda — "Aceh (Aceh)" cuma
 * mengulang, tapi "Germany · Jerman" memang mengajarkan sesuatu.
 */
const altName = computed(() => {
  const s = selected.value
  return s && s.nameId && s.nameId !== s.name ? s.nameId : ''
})

/** Tetangga disorot lembut; bukan warna jawaban, karena di sini tidak ada soal. */
const NEIGHBOR_HEAT = 0.3

function paint() {
  const map = mapRef.value
  if (!map) return
  map.resetStyles()
  const item = selected.value
  if (!item) return
  for (const n of info.value?.neighbors ?? []) map.heat(n.id, NEIGHBOR_HEAT)
  map.mark(item.id, 'target')
}

function select(item: RegionItem, focus = false) {
  playClick()
  selected.value = item
  explored.value.add(item.id)
  paint()
  if (focus) mapRef.value?.fitRegion(item.id)
}

function onPick(item: RegionItem) {
  const inPool = game.pool.find(p => p.id === item.id)
  if (inPool) select(inPool)
}

function onMiss() {
  selected.value = null
  mapRef.value?.resetStyles()
}

function onMapReady() {
  mapReady.value = true
  mapRef.value?.setInteractive(true)
  mapRef.value?.fitPool(game.pool)
}

// Tema/peta digambar ulang saat tampilan berganti; sorotan ikut dipulihkan.
watch(viewMode, () => nextTick(paint))

// ── Pencarian ─────────────────────────────────────────────────
const query = ref('')
const searchOpen = ref(false)
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  return game.pool
    .filter(p => p.name.toLowerCase().includes(q) || p.nameId.toLowerCase().includes(q))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name))
    .slice(0, 6)
})

function pickResult(item: RegionItem) {
  query.value = ''
  searchOpen.value = false
  select(item, true)
}

function onSearchKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && results.value[0]) {
    e.preventDefault()
    pickResult(results.value[0])
  }
  else if (e.key === 'Escape') {
    query.value = ''
    ;(e.target as HTMLInputElement).blur()
  }
}

function quit() {
  game.resetGame()
  navigateTo('/')
}

function onKeydown(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null
  if (el?.tagName === 'INPUT') return
  if (e.key === 'Escape') {
    if (selected.value) onMiss()
    else quit()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

const STATUS_CLASS = {
  mastered: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  learning: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  new: 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
} as const
</script>

<template>
  <main class="relative h-dvh w-full overflow-hidden select-none">
    <MapView v-if="!isGlobe" ref="mapRef" @pick="onPick" @miss="onMiss" @ready="onMapReady" />
    <GlobeMap v-else ref="mapRef" @pick="onPick" @miss="onMiss" @ready="onMapReady" />

    <!-- HUD atas: judul + pencarian + keluar -->
    <div class="pointer-events-none absolute inset-x-0 top-0 z-[1100] flex flex-wrap items-start gap-2 p-3 sm:flex-nowrap sm:p-4">
      <div class="pointer-events-auto flex min-w-0 items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-3 py-2 shadow-sm backdrop-blur-md">
        <span aria-hidden="true">📖</span>
        <div class="min-w-0 leading-tight">
          <p class="text-xs font-bold text-slate-900 dark:text-white">{{ t('study.title') }}</p>
          <p class="truncate text-[10px] text-slate-500 dark:text-slate-400">{{ scopeLabel }}</p>
        </div>
        <span class="ml-1 shrink-0 rounded-full bg-sky-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-600 dark:text-sky-400">
          {{ t('study.explored', { n: explored.size, total: game.pool.length }) }}
        </span>
      </div>

      <button
        type="button"
        class="pointer-events-auto order-2 ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm backdrop-blur-md transition hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 sm:order-3"
        @click="quit"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        <span>{{ t('play.quit') }}</span>
        <span class="shadcn-kbd hidden text-[10px] sm:inline-flex">Esc</span>
      </button>

      <!-- Pencarian: cara cepat menemukan wilayah yang namanya sudah dikenal. -->
      <div class="pointer-events-auto relative order-3 w-full sm:order-2 sm:mx-auto sm:max-w-xs">
        <input
          v-model="query"
          type="search"
          class="focusable h-9 w-full rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-3 text-xs text-slate-900 dark:text-white shadow-sm backdrop-blur-md placeholder:text-slate-400"
          :placeholder="t('study.search')"
          :aria-label="t('study.search')"
          autocomplete="off"
          @focus="searchOpen = true"
          @blur="searchOpen = false"
          @keydown="onSearchKey"
        >
        <ul
          v-if="searchOpen && results.length"
          class="absolute inset-x-0 top-full mt-1 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-2xl"
          role="listbox"
        >
          <li v-for="r in results" :key="r.id">
            <button
              type="button"
              role="option"
              class="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              @mousedown.prevent="pickResult(r)"
            >
              <span class="truncate">{{ r.name }}</span>
              <span class="shrink-0 text-[10px] font-normal text-slate-400">{{ r.region }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <!--
      Kartu info wilayah terpilih. Di atas pemilih tampilan peta (z-1150):
      di layar sempit keduanya bertumpuk, dan teks kartu lebih penting —
      ketuk laut menutup kartu dan pemilihnya muncul lagi.
    -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-[1200] p-3 sm:p-5">
      <div class="pointer-events-auto mx-auto w-full max-w-md">
        <Transition
          mode="out-in"
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 translate-y-2"
          leave-active-class="transition duration-100 ease-in"
          leave-to-class="opacity-0 translate-y-2"
        >
          <div v-if="selected && info" :key="selected.id" class="raycast-card rounded-2xl p-4 shadow-2xl" aria-live="polite">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 class="font-display truncate text-lg font-black tracking-tight text-slate-900 dark:text-white">{{ selected.name }}</h2>
                <p class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  <span aria-hidden="true">📍</span> {{ info.parent }}<template v-if="altName"> · {{ altName }}</template>
                </p>
              </div>
              <span class="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold" :class="STATUS_CLASS[info.status]">
                {{ t(`study.status.${info.status}`) }}
              </span>
            </div>

            <div class="mt-3">
              <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {{ t('study.neighbors', { n: info.neighbors.length }) }}
              </p>
              <div v-if="info.neighbors.length" class="mt-1.5 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                <button
                  v-for="n in info.neighbors"
                  :key="n.id"
                  type="button"
                  class="focusable rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-500/20 active:scale-95"
                  @click="select(n, true)"
                >
                  {{ n.name }}
                </button>
              </div>
              <p v-else class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ t('study.noNeighbors') }}</p>
            </div>
          </div>

          <div v-else key="empty" class="raycast-card rounded-2xl px-4 py-3 text-center text-xs text-slate-600 dark:text-slate-300 shadow-2xl">
            {{ t('study.hint') }}
          </div>
        </Transition>
      </div>
    </div>
  </main>
</template>
