<script setup lang="ts">
const { initTheme } = useTheme()

// Tema dipasang sebelum paint pertama oleh skrip inline di nuxt.config; ini
// menyelaraskan state Vue dengan kelas yang sudah ada di <html>.
initTheme()
</script>

<template>
  <div class="min-h-full bg-slate-50 dark:bg-[#080b11] text-slate-900 dark:text-slate-100 transition-colors duration-200">
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>
