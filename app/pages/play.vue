<script setup lang="ts">
import type { RegionItem } from '~/types/game'
import { scopeProfile } from '~/utils/scopeProfile'

const game = useGameStore()
const { load } = useGeoData()
const { playCorrect, playNear, playWrong, playTick } = useAudio()
const { t } = useI18n()
const { mode: viewMode } = useMapViewMode()

/** Globe 3D hanya tersedia di cakupan dunia. */
const isGlobe = computed(() => viewMode.value === 'globe' && game.datasetScope === 'world')

const mapRef = ref<{
  mark: (id: string, kind: 'correct' | 'wrong' | 'target') => void
  resetStyles: () => void
  fitRegion: (id: string) => void
  fitPool: (items: RegionItem[]) => void
  fitSameLevel: (target: RegionItem) => void
  /**
   * Boolean polos, bukan ref: Vue membungkus objek `defineExpose` dengan
   * `proxyRefs()`, yang membuka ref apa pun di dalamnya. Mengetiknya sebagai
   * `{ value: boolean }` membuat `roundReady?.value` selalu `undefined` —
   * penjaga di `renderRound` tidak pernah menyala dan mode campuran
   * menggambar sebelum layernya siap.
   */
  roundReady?: boolean
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
  const targetLevel = targetScope === 'world'
    ? 'world'
    : (targetScope === 'id-kecamatan' || targetScope === 'us-county')
      ? 'district'
      : 'province'
  await load(targetLevel, targetScope)
}

const mapReady = ref(false)
const showExitModal = ref(false)
const showShortcuts = ref(false)

/** Re-render map according to current round */
async function renderRound() {
  const map = mapRef.value
  const target = game.currentTarget
  if (!map || !mapReady.value || !target) return
  // Mode campuran memuat koleksinya per ronde; menggambar sebelum layer-nya
  // siap membuat wilayah soal tidak tersorot dan tidak bisa diklik.
  if (map.roundReady === false) return

  map.resetStyles()

  // Framing hardcore mengukur tinggi bilah soal dari DOM, dan bilah ronde ini
  // belum ter-render saat watcher menyala — tanpa jeda ini, yang terukur
  // adalah bilah ronde sebelumnya (atau tidak ada sama sekali di ronde 1).
  await nextTick()

  // Mode campuran: kamera mengikuti wilayah soal, karena pool berisi
  // beberapa level sekaligus dan fitPool akan zoom keluar terlalu jauh.
  const isMixed = game.datasetScope === 'id-mixed'
  const isLocal = scopeProfile(game.datasetScope).local

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
  [() => game.currentRound, mapReady, () => mapRef.value?.roundReady],
  renderRound,
  { immediate: true },
)

function onMapReady() {
  mapReady.value = true
}

/** Mode A: clicked country polygon */
function onPick(item: RegionItem, distanceKm?: number) {
  if (game.mode !== 'A' || game.phase !== 'playing') return
  answer(item, distanceKm)
}

/** Mode A: clicked in ocean / outside any polygon */
function onMiss() {
  if (game.mode !== 'A' || game.phase !== 'playing') return
  answer(null)
}

/** Mode B: multiple choice selected */
function onChoice(item: RegionItem) {
  // Tanpa jarak: Mode B menjawab dari daftar nama, tidak dari titik di peta,
  // jadi "seberapa dekat" tidak punya arti di sini.
  if (game.mode !== 'B' || game.phase !== 'playing') return
  answer(item)
}

function answer(item: RegionItem | null, distanceKm?: number) {
  game.submitAnswer(item?.id ?? null, item?.name ?? null, distanceKm)

  const map = mapRef.value
  const target = game.currentTarget
  if (!map || !target) return

  map.setInteractive(false)

  // Bunyinya dibaca dari `feedback.kind`, bukan dihitung ulang di sini:
  // store yang memutuskan sebuah tebakan masuk hitungan "nyaris" atau tidak,
  // dan menduplikasi ambangnya di sini akan membuat suara dan kartu umpan
  // balik bisa berbeda pendapat.
  const kind = game.feedback?.kind
  if (kind === 'correct') playCorrect()
  else if (kind === 'near') playNear()
  else playWrong()

  if (item && item.id !== target.id) map.mark(item.id, 'wrong')
  map.mark(target.id, 'correct')
  if (game.mode === 'A' && game.datasetScope !== 'id-kabupaten' && game.datasetScope !== 'id-kecamatan') map.fitRegion(target.id)
}

function next() {
  if (game.currentRound >= game.totalRounds) {
    // Lewat store, bukan `phase = 'finished'` langsung: di situlah rekor
    // dan hasil tantangan harian dicatat.
    game.finishGame()
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
    // Esc menutup lembar pintasan lebih dulu kalau sedang terbuka —
    // menariknya keluar dari sesi sekaligus jelas bukan yang dimaksud.
    if (showShortcuts.value) {
      showShortcuts.value = false
      return
    }
    showExitModal.value = !showExitModal.value
    return
  }
  if (e.key === '?') {
    e.preventDefault()
    showShortcuts.value = !showShortcuts.value
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
    <MapView v-if="!isGlobe" ref="mapRef" @pick="onPick" @miss="onMiss" @ready="onMapReady" />
    <GlobeMap v-else ref="mapRef" @pick="onPick" @miss="onMiss" @ready="onMapReady" />

    <!-- Top Navigation HUD Bar -->
    <div class="pointer-events-none absolute inset-x-0 top-0 z-[1100] flex items-start justify-between gap-3 p-3 sm:p-4">
      <GameHud />

      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="focusable pointer-events-auto hidden h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 text-slate-500 dark:text-slate-400 shadow-sm backdrop-blur-md transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white active:scale-95 sm:inline-flex"
          :title="t('shortcut.title')"
          :aria-label="t('shortcut.title')"
          @click="showShortcuts = true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
          </svg>
        </button>

        <button
          type="button"
          class="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm backdrop-blur-md transition hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
          @click="showExitModal = true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <span>{{ t('play.quit') }}</span>
          <span class="shadcn-kbd text-[10px] hidden sm:inline-flex">
            Esc
          </span>
        </button>
      </div>
    </div>

    <!-- Bottom Action Card -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-[1100] space-y-3 p-3 sm:p-5">
      <!--
        `data-prompt-bar` dibaca peta untuk memesan ruang di bawah kamera saat
        hardcore: kameranya terkunci, jadi wilayah yang tertutup bilah ini
        tidak bisa digeser keluar oleh pemain.
      -->
      <div data-prompt-bar class="pointer-events-auto mx-auto w-full max-w-xl">
        <Transition name="card-pop" mode="out-in">
          <FeedbackToast v-if="game.phase === 'answered'" key="feedback" @next="next" />
          <PromptBar v-else key="prompt" @answer="onChoice" />
        </Transition>
      </div>
    </div>

    <ShortcutSheet v-model="showShortcuts" />

    <!-- Exit Confirmation Modal -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showExitModal"
        class="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
        @click.self="showExitModal = false"
      >
        <div class="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
          <h3 class="font-display text-base font-bold text-slate-900 dark:text-white">{{ t('play.exit.title') }}</h3>
          <p class="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {{ t('play.exit.body') }}
          </p>

          <div class="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              class="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 px-3 text-xs font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-200 dark:hover:bg-slate-700"
              @click="showExitModal = false"
            >
              {{ t('play.exit.stay') }}
            </button>
            <button
              type="button"
              class="inline-flex h-8 items-center justify-center rounded-lg bg-rose-600 hover:bg-rose-500 px-3 text-xs font-medium text-white transition active:scale-95 shadow-sm"
              @click="confirmQuit"
            >
              {{ t('play.exit.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </main>
</template>
