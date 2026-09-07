<script setup lang="ts">
const game = useGameStore()
const { soundEnabled, toggleSound } = useAudio()

const isFullscreen = ref(false)

// Bump the score chip briefly whenever the score increases (correct answer).
const scoreBump = ref(false)
let bumpTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => game.score,
  (next, prev) => {
    if (next <= prev) return
    scoreBump.value = true
    if (bumpTimer) clearTimeout(bumpTimer)
    bumpTimer = setTimeout(() => {
      scoreBump.value = false
      bumpTimer = null
    }, 320)
  },
)
onBeforeUnmount(() => {
  if (bumpTimer) clearTimeout(bumpTimer)
})

function toggleFullscreen() {
  if (!import.meta.client) return
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {})
    isFullscreen.value = true
  }
  else {
    document.exitFullscreen().catch(() => {})
    isFullscreen.value = false
  }
}

onMounted(() => {
  const handler = () => {
    isFullscreen.value = Boolean(document.fullscreenElement)
  }
  document.addEventListener('fullscreenchange', handler)
  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', handler)
  })
})
</script>

<template>
  <div class="pointer-events-none flex flex-wrap items-center gap-2 select-none">
    <!-- Score Badge -->
    <div
      class="pointer-events-auto inline-flex h-9 items-center gap-2 rounded-xl border bg-white/90 dark:bg-slate-900/90 px-3 text-xs font-medium shadow-md backdrop-blur-md transition-colors hud-score"
      :class="[
        scoreBump
          ? 'hud-score-bumping border-sky-400 text-sky-600 dark:text-sky-300 ring-2 ring-sky-400/20'
          : 'border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100',
      ]"
      aria-live="polite"
    >
      <span class="text-slate-500 dark:text-slate-400">Score</span>
      <span class="font-mono font-bold hud-score-value text-sky-600 dark:text-sky-400">{{ game.score }}</span>
    </div>

    <!-- Round Counter -->
    <div class="pointer-events-auto inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 px-3 text-xs font-medium shadow-md backdrop-blur-md">
      <span class="text-slate-500 dark:text-slate-400">Round</span>
      <span class="font-mono text-slate-900 dark:text-slate-100 font-bold">{{ game.currentRound }}</span>
      <span class="text-slate-300 dark:text-slate-600 font-mono">/</span>
      <span class="text-slate-500 dark:text-slate-400 font-mono">{{ game.totalRounds }}</span>
    </div>

    <!-- Streak Badge -->
    <Transition name="streak-pop">
      <div
        v-if="game.streak > 0"
        key="streak"
        class="pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium shadow-md backdrop-blur-md transition-colors"
        :class="game.streak >= 3
          ? 'border-amber-400/50 bg-amber-500/15 text-amber-600 dark:text-amber-400'
          : 'border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300'"
        aria-live="polite"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <span>Streak</span>
        <span class="font-mono font-bold">{{ game.streak }}</span>
        <span v-if="game.streak >= 2" class="font-mono text-[10px] text-amber-600 dark:text-amber-400">
          (+{{ game.streak * 2 }})
        </span>
      </div>
    </Transition>

    <!-- Timer Badge -->
    <div
      v-if="game.timerEnabled"
      class="pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-mono font-medium shadow-md backdrop-blur-md transition-colors"
      :class="game.secondsLeft <= 5
        ? 'border-red-400/50 bg-red-500/15 text-red-600 dark:text-red-400 animate-pulse'
        : 'border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300'"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span class="font-bold">{{ Math.max(0, game.secondsLeft) }}s</span>
    </div>

    <!-- Audio Toggle Button -->
    <button
      type="button"
      :title="soundEnabled ? 'Mute' : 'Unmute'"
      class="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 shadow-md backdrop-blur-md transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 active:scale-95"
      @click="toggleSound"
    >
      <svg v-if="soundEnabled" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      </svg>
    </button>

    <!-- Fullscreen Toggle Button -->
    <button
      type="button"
      title="Fullscreen"
      class="pointer-events-auto hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 shadow-md backdrop-blur-md transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 active:scale-95"
      @click="toggleFullscreen"
    >
      <svg v-if="!isFullscreen" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
      </svg>
    </button>
  </div>
</template>
