<script setup lang="ts">
/**
 * Tombol petunjuk dengan jatah sesi yang terlihat.
 *
 * Sisa jatah dipasang di tombolnya sendiri, bukan di HUD terpisah: harganya
 * ("satu dari dua yang tersisa, dan poin ronde ini jadi separuh") harus
 * terbaca di tempat keputusannya diambil, bukan di sudut layar yang lain.
 */
const game = useGameStore()
const { playClick } = useAudio()
const { t } = useI18n()

/** Sesi hardcore tidak punya jatah sama sekali, jadi tombolnya absen. */
const available = computed(() => !game.isHardcore && game.totalRounds > 0)

const label = computed(() => {
  if (game.hintUsedThisRound) return t('hint.used')
  if (game.hintsLeft <= 0) return t('hint.empty')
  return game.hintKind === 'fifty' ? t('hint.fifty') : t('hint.region')
})

function use() {
  if (!game.canUseHint) return
  playClick()
  game.useHint()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key.toLowerCase() !== 'h' || e.metaKey || e.ctrlKey || e.altKey) return
  const el = e.target as HTMLElement | null
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
  e.preventDefault()
  use()
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <button
    v-if="available"
    type="button"
    :disabled="!game.canUseHint"
    class="focusable pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold shadow-md backdrop-blur-md transition active:scale-95 disabled:cursor-not-allowed"
    :class="game.canUseHint
      ? 'border-amber-400/50 bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25'
      : 'border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 text-slate-400 dark:text-slate-600'"
    :title="t('hint.tooltip')"
    @click="use"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
    </svg>
    <span>{{ label }}</span>

    <!-- Jatah sebagai titik, bukan angka: jumlahnya paling banyak tiga. -->
    <span v-if="game.hintsLeft > 0 || game.hintUsedThisRound" class="flex items-center gap-0.5" aria-hidden="true">
      <span
        v-for="i in Math.max(game.hintsLeft, 0)"
        :key="i"
        class="h-1.5 w-1.5 rounded-full bg-current opacity-70"
      />
    </span>
    <span class="sr-only">{{ t('hint.left', { n: game.hintsLeft }) }}</span>

    <kbd class="shadcn-kbd hidden text-[10px] sm:inline-flex">H</kbd>
  </button>
</template>
