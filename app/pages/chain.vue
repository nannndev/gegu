<script setup lang="ts">
import type { RegionItem } from '~/types/game'
import { chainHeatColor, collectionMaxKm, formatDistance } from '~/utils/distance'

const game = useGameStore()
const { collection, load } = useGeoData()
const { playCorrect, playClick } = useAudio()
const { t, locale } = useI18n()
const { formatScope } = useScopeLabel()
const { mode: viewMode } = useMapViewMode()

/** Globe 3D hanya tersedia di cakupan dunia. */
const isGlobe = computed(() => viewMode.value === 'globe' && game.datasetScope === 'world')

if (game.mode !== 'C' || game.phase === 'idle') {
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
  heat: (id: string, t: number) => void
  mark: (id: string, kind: 'correct' | 'wrong' | 'target') => void
  setInteractive: (v: boolean) => void
  fitPool: (items: RegionItem[]) => void
  resetStyles: () => void
} | null>(null)

const mapReady = ref(false)

/** Skala "sejauh apa mungkin meleset" untuk gradasi panas-dingin. */
const maxKm = computed(() => (collection.value ? collectionMaxKm(collection.value) : 0))
const solved = computed(() => game.phase === 'finished')
const reversedGuesses = computed(() => [...game.chainGuesses].reverse())
const scopeLabel = computed(() => formatScope(game.scopeParts ?? { scope: game.datasetScope }))

function fitPool() {
  if (mapReady.value) mapRef.value?.fitPool(game.pool)
}

function onMapReady() {
  mapReady.value = true
  fitPool()
}

function onPick(item: RegionItem, distanceKm?: number) {
  if (solved.value) return

  const t = maxKm.value > 0 ? (distanceKm ?? 0) / maxKm.value : 1
  const isTarget = item.id === game.currentTarget?.id

  game.submitChainGuess(item, distanceKm)

  if (isTarget) {
    mapRef.value?.mark(item.id, 'correct')
    mapRef.value?.setInteractive(false)
    playCorrect()
  }
  else {
    mapRef.value?.heat(item.id, t)
    playClick()
  }
}

function onMiss() {
  // Klik di laut / di luar wilayah mana pun: bukan tebakan, tidak dicatat.
}

function rankLabel(n: number): string {
  if (n <= 1) return t('chain.rank.perfect')
  if (n <= 3) return t('chain.rank.great')
  if (n <= 6) return t('chain.rank.good')
  return t('chain.rank.ok')
}

function quit() {
  game.resetGame()
  navigateTo('/')
}

function playAgain() {
  playClick()
  game.restartChain()
  mapRef.value?.resetStyles()
  mapRef.value?.setInteractive(true)
  fitPool()
}
</script>

<template>
  <main class="relative h-dvh w-full overflow-hidden select-none">
    <MapView v-if="!isGlobe" ref="mapRef" @pick="onPick" @miss="onMiss" @ready="onMapReady" />
    <GlobeMap v-else ref="mapRef" @pick="onPick" @miss="onMiss" @ready="onMapReady" />

    <!-- Top HUD -->
    <div class="pointer-events-none absolute inset-x-0 top-0 z-[1100] flex items-start justify-between gap-3 p-3 sm:p-4">
      <div class="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-3 py-2 shadow-sm backdrop-blur-md">
        <span class="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
        <div class="leading-tight">
          <p class="text-xs font-bold text-slate-900 dark:text-white">{{ t('chain.title') }}</p>
          <p class="text-[10px] text-slate-500 dark:text-slate-400">{{ scopeLabel }}</p>
        </div>
        <span class="ml-1 rounded-full bg-sky-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-600 dark:text-sky-400">
          {{ t('chain.guesses', { n: game.chainGuessCount }) }}
        </span>
      </div>

      <button
        type="button"
        class="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm backdrop-blur-md transition hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
        @click="quit"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        <span>{{ t('play.quit') }}</span>
        <span class="shadcn-kbd text-[10px] hidden sm:inline-flex">Esc</span>
      </button>
    </div>

    <!-- Guess list -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-[1100] p-3 sm:p-5">
      <div class="pointer-events-auto mx-auto w-full max-w-md">
        <div
          v-if="game.chainGuesses.length"
          class="raycast-card max-h-56 overflow-y-auto rounded-2xl p-2 shadow-2xl"
        >
          <p class="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {{ t('chain.guesses', { n: game.chainGuessCount }) }}
          </p>
          <ul class="divide-y divide-slate-200/60 dark:divide-slate-800/60">
            <li
              v-for="g in reversedGuesses"
              :key="g.item.id"
              class="flex items-center gap-2.5 px-2.5 py-2"
            >
              <span
                class="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/10"
                :style="{ background: chainHeatColor(maxKm > 0 ? g.distanceKm / maxKm : 1) }"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                {{ g.item.name }}
              </span>
              <span class="shrink-0 font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {{ formatDistance(g.distanceKm, locale) }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Solved overlay -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="solved"
        class="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      >
        <div class="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center shadow-2xl">
          <span class="text-3xl" aria-hidden="true">🎯</span>
          <h2 class="font-display mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {{ rankLabel(game.chainGuessCount) }}
          </h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ t('chain.solved.in', { n: game.chainGuessCount }) }}
          </p>
          <p class="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            {{ t('chain.solved.target', { name: game.currentTarget?.name ?? '' }) }}
          </p>

          <div class="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-xs font-bold text-white shadow-lg shadow-sky-600/25 transition hover:bg-sky-500 active:scale-95"
              @click="playAgain"
            >
              {{ t('chain.again') }}
            </button>
            <button
              type="button"
              class="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
              @click="quit"
            >
              {{ t('chain.home') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </main>
</template>
