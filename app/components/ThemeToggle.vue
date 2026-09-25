<script setup lang="ts">
import type { MessageKey } from '~/i18n/id'
import type { ThemePreference } from '~/composables/useTheme'

/**
 * Tombol tema satu-ikon: tiap klik memutar terang → gelap → ikut sistem.
 * "Ikut sistem" tetap ada di putaran, jadi bisa dipilih ulang setelah pemain
 * pernah memaksa terang atau gelap — segmen tiga tombol dulu menghabiskan
 * tempat header hanya untuk kontrol yang jarang disentuh.
 */
const { preference, cycleTheme } = useTheme()
const { playClick } = useAudio()
const { t } = useI18n()

const TITLES: Record<ThemePreference, MessageKey> = {
  light: 'common.theme.lightTitle',
  dark: 'common.theme.darkTitle',
  system: 'common.theme.systemTitle',
}

function cycle() {
  playClick()
  cycleTheme()
}
</script>

<template>
  <button
    type="button"
    class="focusable flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
    :title="`${t('common.theme.label')}: ${t(TITLES[preference])}`"
    :aria-label="`${t('common.theme.label')}: ${t(TITLES[preference])}`"
    @click="cycle"
  >
    <!-- Sun -->
    <svg v-if="preference === 'light'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
    </svg>
    <!-- Moon -->
    <svg v-else-if="preference === 'dark'" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
    <!-- Monitor -->
    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-600 dark:text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </svg>
  </button>
</template>
