import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Leaflet butuh `window` saat init. Game tidak butuh SEO, jadi pakai
  // Strategi A dari PRD 4.1: SPA penuh — tidak ada render di server sama sekali.
  ssr: false,

  modules: ['@pinia/nuxt'],

  // CSS Leaflet aman di-import global (tidak menyentuh `window`).
  css: ['leaflet/dist/leaflet.css', '~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  app: {
    head: {
      title: 'GeoGuesser — Interactive World Geography Quiz',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1' },
        { name: 'description', content: 'Test your world geography skills with interactive map challenges, territory identification, and continent sprints.' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap' },
      ],
    },
  },
})
