export type ThemePreference = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'geoguess_theme'

/**
 * Tema aplikasi. Tiga pilihan: terang, gelap, atau ikut sistem.
 *
 * Kelas `.dark` di `<html>` yang menjadi sumber kebenaran — variant `dark:`
 * di main.css memang didefinisikan terhadap kelas itu, bukan terhadap
 * `prefers-color-scheme`, supaya tombol ganti tema benar-benar berpengaruh.
 */
export function useTheme() {
  const preference = useState<ThemePreference>('app-theme', () => 'system')
  /** Hasil akhir setelah 'system' diterjemahkan ke terang/gelap. */
  const resolved = useState<'dark' | 'light'>('app-theme-resolved', () => 'dark')

  const isDark = computed(() => resolved.value === 'dark')

  function systemPrefersDark() {
    if (!import.meta.client) return true
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  function paint(pref: ThemePreference) {
    const dark = pref === 'system' ? systemPrefersDark() : pref === 'dark'
    resolved.value = dark ? 'dark' : 'light'
    if (!import.meta.client) return
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    root.dataset.theme = dark ? 'dark' : 'light'
    root.style.colorScheme = dark ? 'dark' : 'light'
  }

  function setTheme(pref: ThemePreference) {
    preference.value = pref
    if (import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, pref)
      }
      catch {}
    }
    paint(pref)
  }

  /** Putar tema: terang → gelap → ikut sistem → terang. */
  function cycleTheme() {
    setTheme(
      preference.value === 'light' ? 'dark' : preference.value === 'dark' ? 'system' : 'light',
    )
  }

  function toggleTheme() {
    setTheme(isDark.value ? 'light' : 'dark')
  }

  function initTheme() {
    if (!import.meta.client) return
    let saved: string | null = null
    try {
      saved = localStorage.getItem(STORAGE_KEY)
    }
    catch {}

    preference.value = saved === 'dark' || saved === 'light' || saved === 'system'
      ? saved
      : 'system'
    paint(preference.value)

    // Saat pilihannya 'system', ikuti perubahan tema OS tanpa perlu muat ulang.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (preference.value === 'system') paint('system')
    })
  }

  return {
    preference,
    resolved,
    isDark,
    setTheme,
    toggleTheme,
    cycleTheme,
    initTheme,
  }
}
