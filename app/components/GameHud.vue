<script setup lang="ts">
const game = useGameStore()
const { soundEnabled, toggleSound } = useAudio()

const isFullscreen = ref(false)

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
    <div class="pointer-events-auto inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-md">
      <span class="text-zinc-400">Score</span>
      <span class="font-mono font-semibold text-zinc-100">{{ game.score }}</span>
    </div>

    <!-- Round Counter -->
    <div class="pointer-events-auto inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-md">
      <span class="text-zinc-400">Round</span>
      <span class="font-mono text-zinc-100 font-semibold">{{ game.currentRound }}</span>
      <span class="text-zinc-500 font-mono">/</span>
      <span class="text-zinc-500 font-mono">{{ game.totalRounds }}</span>
    </div>

    <!-- Streak Badge -->
    <div
      v-if="game.streak > 0"
      class="pointer-events-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-md transition-colors"
      :class="game.streak >= 3
        ? 'border-amber-900/50 bg-amber-950/40 text-amber-300'
        : 'border-zinc-800 bg-zinc-900/90 text-zinc-300'"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
      <span>Streak</span>
      <span class="font-mono font-bold">{{ game.streak }}</span>
      <span v-if="game.streak >= 2" class="font-mono text-[10px] text-amber-400">
        (+{{ game.streak * 2 }})
      </span>
    </div>

    <!-- Timer Badge -->
    <div
      v-if="game.timerEnabled"
      class="pointer-events-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-mono font-medium shadow-sm backdrop-blur-md transition-colors"
      :class="game.secondsLeft <= 5
        ? 'border-red-900/60 bg-red-950/50 text-red-300 animate-pulse'
        : 'border-zinc-800 bg-zinc-900/90 text-zinc-300'"
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
      class="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/90 text-zinc-400 shadow-sm backdrop-blur-md transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95"
      @click="toggleSound"
    >
      <svg v-if="soundEnabled" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      </svg>
    </button>

    <!-- Fullscreen Toggle Button -->
    <button
      type="button"
      title="Fullscreen"
      class="pointer-events-auto hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/90 text-zinc-400 shadow-sm backdrop-blur-md transition hover:bg-zinc-800 hover:text-zinc-100 active:scale-95"
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
