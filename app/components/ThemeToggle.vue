<script setup lang="ts">
import type { MessageKey } from '~/i18n/id'
import type { ThemePreference } from '~/composables/useTheme'

/**
 * Pemilih tema tiga-arah. Tombol putar sederhana tidak cukup di sini: pilihan
 * "ikut sistem" harus bisa dipilih ulang setelah pemain pernah memaksa
 * terang atau gelap.
 */
const { preference, setTheme } = useTheme()
const { playClick } = useAudio()
const { t } = useI18n()

const OPTIONS: { value: ThemePreference, labelKey: MessageKey, titleKey: MessageKey }[] = [
  { value: 'light', labelKey: 'common.theme.light', titleKey: 'common.theme.lightTitle' },
  { value: 'system', labelKey: 'common.theme.system', titleKey: 'common.theme.systemTitle' },
  { value: 'dark', labelKey: 'common.theme.dark', titleKey: 'common.theme.darkTitle' },
]

function choose(value: ThemePreference) {
  if (preference.value === value) return
  playClick()
  setTheme(value)
}
</script>

<template>
  <div class="seg-track w-auto gap-0.5 p-0.5" role="radiogroup" :aria-label="t('common.theme.label')">
    <button
      v-for="o in OPTIONS"
      :key="o.value"
      type="button"
      role="radio"
      :aria-checked="preference === o.value"
      :title="t(o.titleKey)"
      class="seg-item focusable !flex-none justify-center px-2 py-1"
      :class="preference === o.value
        ? '!bg-white dark:!bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
        : ''"
      @click="choose(o.value)"
    >
      <!-- Sun -->
      <svg v-if="o.value === 'light'" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
      </svg>
      <!-- Monitor -->
      <svg v-else-if="o.value === 'system'" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </svg>
      <!-- Moon -->
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      <span class="sr-only sm:not-sr-only">{{ t(o.labelKey) }}</span>
    </button>
  </div>
</template>
