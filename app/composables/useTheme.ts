export type AppTheme = 'dark' | 'light'

const STORAGE_KEY = 'geoguess_theme'

export function useTheme() {
  const theme = useState<AppTheme>('app-theme', () => 'dark')

  const isDark = computed(() => theme.value === 'dark')

  function applyTheme(t: AppTheme) {
    theme.value = t
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, t)
      document.documentElement.classList.toggle('dark', t === 'dark')
      document.documentElement.setAttribute('data-theme', t)
    }
  }

  function toggleTheme() {
    applyTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  function initTheme() {
    if (!import.meta.client) return
    const saved = localStorage.getItem(STORAGE_KEY) as AppTheme | null
    if (saved === 'dark' || saved === 'light') {
      applyTheme(saved)
    }
    else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      applyTheme(prefersDark ? 'dark' : 'light')
    }
  }

  return {
    theme,
    isDark,
    toggleTheme,
    setTheme: applyTheme,
    initTheme,
  }
}
