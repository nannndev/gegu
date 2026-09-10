<script setup lang="ts">
const { initTheme } = useTheme()
const { initLocale, locale, t } = useI18n()

// Tema dipasang sebelum paint pertama oleh skrip inline di nuxt.config; ini
// menyelaraskan state Vue dengan kelas yang sudah ada di <html>.
initTheme()
// Selaraskan atribut lang di <html> dengan bahasa pilihan pemain.
initLocale()

// Judul & deskripsi ikut bahasa aktif; nuxt.config hanya memberi nilai awal
// yang dipakai sebelum bundel Vue jalan.
useHead({
  htmlAttrs: { lang: locale },
  title: () => t('app.title'),
  meta: [{ name: 'description', content: () => t('app.description') }],
})
</script>

<template>
  <div class="min-h-full bg-slate-50 dark:bg-[#080b11] text-slate-900 dark:text-slate-100 transition-colors duration-200">
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>
