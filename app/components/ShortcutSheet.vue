<script setup lang="ts">
/**
 * Daftar pintasan papan ketik.
 *
 * Game ini sudah punya delapan pintasan (A–D, 1–4, Space, Esc, H, ?) tapi
 * tidak satu pun diumumkan di luar badge kecil di tombolnya. Yang paling
 * berguna justru yang tidak punya tombol sama sekali — H untuk petunjuk.
 */
const open = defineModel<boolean>({ required: true })

const game = useGameStore()
const { t } = useI18n()

interface Shortcut {
  keys: string[]
  labelKey: Parameters<ReturnType<typeof useI18n>['t']>[0]
  /** Hanya relevan di mode tertentu; disembunyikan di mode lain. */
  only?: 'A' | 'B'
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['A', 'B', 'C', 'D'], labelKey: 'shortcut.choice', only: 'B' },
  { keys: ['1', '2', '3', '4'], labelKey: 'shortcut.choiceNum', only: 'B' },
  { keys: ['Click'], labelKey: 'shortcut.click', only: 'A' },
  { keys: ['H'], labelKey: 'shortcut.hint' },
  { keys: ['Space'], labelKey: 'shortcut.next' },
  { keys: ['Esc'], labelKey: 'shortcut.quit' },
  { keys: ['?'], labelKey: 'shortcut.sheet' },
]

const visible = computed(() =>
  SHORTCUTS.filter(s => !s.only || s.only === game.mode),
)

function close() {
  open.value = false
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0"
    leave-active-class="transition duration-100 ease-in"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      :aria-label="t('shortcut.title')"
      @click.self="close"
    >
      <div class="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl">
        <div class="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 class="font-display text-sm font-bold text-slate-900 dark:text-white">
            {{ t('shortcut.title') }}
          </h3>
          <button
            type="button"
            class="focusable flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
            :aria-label="t('shortcut.close')"
            @click="close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <dl class="mt-1 divide-y divide-slate-100 dark:divide-slate-800/70">
          <div
            v-for="s in visible"
            :key="s.labelKey"
            class="flex items-center justify-between gap-4 py-2.5"
          >
            <dt class="text-xs text-slate-600 dark:text-slate-400">{{ t(s.labelKey) }}</dt>
            <dd class="flex shrink-0 items-center gap-1">
              <kbd v-for="k in s.keys" :key="k" class="shadcn-kbd text-[10px]">{{ k }}</kbd>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </Transition>
</template>
