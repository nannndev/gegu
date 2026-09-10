<script setup lang="ts">
import type { Locale } from '~/composables/useI18n'

/**
 * Pengalih bahasa ID/EN. Bentuknya menyalin ThemeToggle supaya dua kontrol
 * di header terbaca sebagai satu keluarga.
 */
const { locale, setLocale, t } = useI18n()
const { playClick } = useAudio()

const OPTIONS: { value: Locale, labelKey: 'common.lang.id' | 'common.lang.en', titleKey: 'common.lang.idTitle' | 'common.lang.enTitle' }[] = [
  { value: 'id', labelKey: 'common.lang.id', titleKey: 'common.lang.idTitle' },
  { value: 'en', labelKey: 'common.lang.en', titleKey: 'common.lang.enTitle' },
]

function choose(value: Locale) {
  if (locale.value === value) return
  playClick()
  setLocale(value)
}
</script>

<template>
  <div class="seg-track w-auto gap-0.5 p-0.5" role="radiogroup" :aria-label="t('common.lang.label')">
    <button
      v-for="o in OPTIONS"
      :key="o.value"
      type="button"
      role="radio"
      :aria-checked="locale === o.value"
      :title="t(o.titleKey)"
      class="seg-item focusable !flex-none justify-center px-2 py-1 font-mono text-[11px] font-bold"
      :class="locale === o.value
        ? '!bg-white dark:!bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
        : ''"
      @click="choose(o.value)"
    >
      {{ t(o.labelKey) }}
    </button>
  </div>
</template>
