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
    class="flex flex-col justify-between gap-3 rounded-2xl border p-4 shadow-2xl shadow-black/40 backdrop-blur-md transition-all sm:flex-row sm:items-center"
    :class="fb.kind === 'correct'
      ? 'border-emerald-400/30 bg-slate-950/92'
      : 'border-red-400/30 bg-slate-950/92'"
  >
    <div class="flex items-start gap-3 min-w-0">
      <!-- Status Icon -->
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm"
        :class="fb.kind === 'correct'
          ? 'border-emerald-400/40 bg-emerald-950/70 text-emerald-300'
          : 'border-red-400/40 bg-red-950/70 text-red-300'"
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

      <div class="min-w-0 flex-1">
        <h3
          class="text-sm font-semibold tracking-tight"
          :class="fb.kind === 'correct' ? 'text-emerald-400' : 'text-red-400'"
        >
          {{ headline }}
        </h3>

        <p class="mt-0.5 text-xs text-zinc-300">
          <template v-if="fb.kind === 'correct'">
            Yup, itu {{ fb.targetName }}.
          </template>
          <template v-else>
            <span v-if="fb.answerName" class="text-zinc-400">
              Kamu pilih <span class="text-zinc-200 line-through">{{ fb.answerName }}</span>.
            </span>
            <span>
              Yang bener <strong class="text-zinc-100">{{ fb.targetName }}</strong> {{ isoToFlag(fb.targetIso) }}.
            </span>
          </template>
        </p>
      </div>
    </div>

    <!-- Action Button (shadcn button) -->
    <button
      type="button"
      class="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-xs font-bold text-slate-950 transition hover:bg-slate-200 active:scale-98"
      @click="emit('next')"
    >
      <span>{{ isLast ? 'Lihat Skor' : 'Lanjut' }}</span>
      <kbd class="hidden sm:inline-flex h-4 items-center rounded border border-zinc-300 bg-zinc-200 px-1 font-mono text-[9px] text-zinc-800">
        Space ↵
      </kbd>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </button>
  </div>
</template>
