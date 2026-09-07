<script setup lang="ts">
import { isoToFlag } from '~/utils/geo'

const emit = defineEmits<{ next: [] }>()

const game = useGameStore()
const fb = computed(() => game.feedback)

const headline = computed(() => {
  if (!fb.value) return ''
  if (fb.value.kind === 'correct') {
    return `Benar (+${fb.value.points} poin)`
  }
  if (fb.value.kind === 'timeout') {
    return 'Kehabisan waktu'
  }
  return 'Kurang pas'
})

const isLast = computed(() => game.currentRound >= game.totalRounds)

// Keyboard shortcut: Press Space or Enter to proceed
function handleKeyDown(e: KeyboardEvent) {
  if (game.phase !== 'answered') return
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    emit('next')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div
    v-if="fb"
    class="flex flex-col justify-between gap-3 rounded-2xl border bg-white/95 dark:bg-slate-900/95 p-4 shadow-2xl shadow-black/10 dark:shadow-black/50 backdrop-blur-md transition-all sm:flex-row sm:items-center"
    :class="fb.kind === 'correct'
      ? 'border-emerald-500/40'
      : 'border-rose-500/40'"
  >
    <div class="flex items-start gap-3 min-w-0">
      <!-- Status Icon -->
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm"
        :class="fb.kind === 'correct'
          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          : 'border-rose-500/50 bg-rose-500/15 text-rose-600 dark:text-rose-400'"
      >
        <svg v-if="fb.kind === 'correct'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <svg v-else-if="fb.kind === 'timeout'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>

      <div class="min-w-0 flex-1" aria-live="polite">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3
            class="font-display text-sm font-bold tracking-tight"
            :class="fb.kind === 'correct' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
          >
            {{ headline }}
          </h3>
          <span
            class="rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold"
            :class="fb.kind === 'correct'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'"
          >
            Ronde {{ game.currentRound }} / {{ game.totalRounds }}
          </span>
        </div>

        <p class="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
          <template v-if="fb.kind === 'correct'">
            Yup, tepat sekali! Itu {{ fb.targetName }}.
          </template>
          <template v-else>
            <span v-if="fb.answerName" class="text-slate-500 dark:text-slate-400">
              Kamu pilih <span class="text-slate-700 dark:text-slate-300 line-through">{{ fb.answerName }}</span>.
            </span>
            <span>
              Yang benar adalah <strong class="text-slate-900 dark:text-white font-semibold">{{ fb.targetName }}</strong> {{ isoToFlag(fb.targetIso) }}.
            </span>
          </template>
        </p>
      </div>
    </div>

    <!-- Action Button -->
    <button
      type="button"
      class="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white px-4 text-xs font-bold text-white dark:text-slate-950 transition hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 shadow-md"
      @click="emit('next')"
    >
      <span>{{ isLast ? 'Lihat Skor' : 'Lanjut' }}</span>
      <kbd class="hidden h-4 items-center rounded border border-white/20 dark:border-slate-900/20 bg-white/10 dark:bg-slate-900/10 px-1 font-mono text-[9px] text-white dark:text-slate-950 sm:inline-flex">
        Space ↵
      </kbd>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </button>
  </div>
</template>
