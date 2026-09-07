<script setup lang="ts">
import type { RegionItem } from '~/types/game'

const game = useGameStore()
const { load } = useGeoData()
const { playCorrect, playWrong, playTick } = useAudio()

const mapRef = ref<{
  mark: (id: string, kind: 'correct' | 'wrong' | 'target') => void
  resetStyles: () => void
  fitRegion: (id: string) => void
  fitPool: (items: RegionItem[]) => void
  fitSameLevel: (target: RegionItem) => void
  roundReady?: { value: boolean }
  resetView: () => void
  setInteractive: (v: boolean) => void
} | null>(null)

if (game.phase === 'idle') {
  await navigateTo('/')
}

const targetScope = game.datasetScope || 'world'
// Mode campuran memuat koleksinya per ronde di MapView (levelnya berganti),
// jadi tidak ada satu scope yang bisa dimuat di muka.
if (targetScope !== 'id-mixed') {
  const targetLevel = targetScope === 'world' ? 'world' : targetScope === 'id-kecamatan' ? 'district' : 'province'
  await load(targetLevel, targetScope)
}

const mapReady = ref(false)
const showExitModal = ref(false)

/** Re-render map according to current round */
function renderRound() {
  const map = mapRef.value
  const target = game.currentTarget
  if (!map || !mapReady.value || !target) return
  // Mode campuran memuat koleksinya per ronde; menggambar sebelum layer-nya
  // siap membuat wilayah soal tidak tersorot dan tidak bisa diklik.
  if (map.roundReady?.value === false) return

  map.resetStyles()

  // Mode campuran: kamera mengikuti wilayah soal, karena pool berisi
  // beberapa level sekaligus dan fitPool akan zoom keluar terlalu jauh.
  const isMixed = game.datasetScope === 'id-mixed'
  const isLocal = game.datasetScope === 'id-kabupaten' || game.datasetScope === 'id-kecamatan'

  if (game.mode === 'B') {
    map.setInteractive(false)
    map.mark(target.id, 'target')
    if (isMixed) map.fitRegion(target.id)
    else if (isLocal) map.fitPool(game.pool)
    else map.fitRegion(target.id)
  }
  else {
    map.setInteractive(true)
    if (isMixed) map.fitSameLevel(target)
    else if (isLocal) map.fitPool(game.pool)
    else map.resetView()
  }
}

watch(
  [() => game.currentRound, mapReady, () => mapRef.value?.roundReady?.value],
  renderRound,
  { immediate: true },
)

function onMapReady() {
  mapReady.value = true
}

/** Mode A: clicked country polygon */
function onPick(item: RegionItem) {
  if (game.mode !== 'A' || game.phase !== 'playing') return
  answer(item)
}

/** Mode A: clicked in ocean / outside any polygon */
function onMiss() {
  if (game.mode !== 'A' || game.phase !== 'playing') return
  answer(null)
}

/** Mode B: multiple choice selected */
function onChoice(item: RegionItem) {
  if (game.mode !== 'B' || game.phase !== 'playing') return
  answer(item)
}

function answer(item: RegionItem | null) {
  game.submitAnswer(item?.id ?? null, item?.name ?? null)

  const map = mapRef.value
  const target = game.currentTarget
  if (!map || !target) return

  map.setInteractive(false)

  // Sound feedback
  if (item && item.id === target.id) {
    playCorrect()
  }
  else {
    playWrong()
  }

  if (item && item.id !== target.id) map.mark(item.id, 'wrong')
  map.mark(target.id, 'correct')
  if (game.mode === 'A' && game.datasetScope !== 'id-kabupaten' && game.datasetScope !== 'id-kecamatan') map.fitRegion(target.id)
}

function next() {
  if (game.currentRound >= game.totalRounds) {
    game.phase = 'finished'
    return navigateTo('/result')
  }
  game.nextRound()
}

// Timer tick handling
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    if (game.phase === 'playing' && game.timerEnabled) {
      if (game.secondsLeft <= 6 && game.secondsLeft > 1) {
        playTick()
      }
      game.tick()
    }
  }, 1000)

  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('keydown', onKeyDown)
})

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    showExitModal.value = !showExitModal.value
  }
}

// Time's up is handled by store; update map and play sound
watch(() => game.phase, (phase) => {
  if (phase !== 'answered' || game.lastAnswerId !== null) return
  playWrong()
  const map = mapRef.value
  const target = game.currentTarget
  if (!map || !target) return
  map.setInteractive(false)
  map.mark(target.id, 'correct')
  if (game.mode === 'A' && game.datasetScope !== 'id-kabupaten' && game.datasetScope !== 'id-kecamatan') map.fitRegion(target.id)
})

function confirmQuit() {
  game.resetGame()
  navigateTo('/')
}
</script>

<template>
  <main class="relative h-dvh w-full overflow-hidden select-none">
    <MapView ref="mapRef" @pick="onPick" @miss="onMiss" @ready="onMapReady" />

    <!-- Top Navigation HUD Bar -->
    <div class="pointer-events-none absolute inset-x-0 top-0 z-[1100] flex items-start justify-between gap-3 p-3 sm:p-4">
      <GameHud />

      <button
        type="button"
        class="pointer-events-auto inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/90 px-2.5 py-1 text-xs font-medium text-zinc-400 shadow-sm backdrop-blur-md transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95"
        @click="showExitModal = true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        <span>Keluar</span>
        <kbd class="hidden sm:inline-block rounded border border-zinc-700 bg-zinc-800 px-1 py-0.2 font-mono text-[9px] text-zinc-400">
          Esc
        </kbd>
      </button>
    </div>

    <!-- Bottom Action Card -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-[1100] space-y-3 p-3 sm:p-5">
      <div class="pointer-events-auto mx-auto w-full max-w-xl">
        <FeedbackToast v-if="game.phase === 'answered'" @next="next" />
        <PromptBar v-else @answer="onChoice" />
      </div>
    </div>

    <!-- Exit Confirmation Modal (shadcn Dialog style) -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showExitModal"
        class="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        @click.self="showExitModal = false"
      >
        <div class="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
          <h3 class="text-base font-semibold text-zinc-100">Keluar dari sesi?</h3>
          <p class="mt-2 text-xs text-zinc-400 leading-relaxed">
            Ronde ini berhenti dan skor sesi nggak disimpan.
          </p>

          <div class="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              class="inline-flex h-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
              @click="showExitModal = false"
            >
              Lanjut main
            </button>
            <button
              type="button"
              class="inline-flex h-8 items-center justify-center rounded-lg bg-red-600 px-3 text-xs font-medium text-white transition hover:bg-red-700 active:scale-95"
              @click="confirmQuit"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </main>
</template>
