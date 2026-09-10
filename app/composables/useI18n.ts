import { en } from '~/i18n/en'
import { id, type MessageKey } from '~/i18n/id'

export type Locale = 'id' | 'en'

const STORAGE_KEY = 'geoguess_locale'

const DICTS: Record<Locale, Record<MessageKey, string>> = { id, en }

/** Nilai yang boleh disisipkan ke placeholder `{...}`. */
type Params = Record<string, string | number>

function readStored(): Locale | null {
  if (!import.meta.client) return null
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'id' || saved === 'en' ? saved : null
  }
  catch {
    return null
  }
}

/**
 * Bahasa awal: pilihan tersimpan dulu, baru bahasa peramban. Non-Indonesia
 * jatuh ke Inggris supaya pengunjung asing tidak mendarat di layar
 * berbahasa Indonesia.
 */
function detect(): Locale {
  const saved = readStored()
  if (saved) return saved
  if (!import.meta.client) return 'id'
  return /^id\b/i.test(navigator.language ?? '') ? 'id' : 'en'
}

/**
 * Teks dua bahasa (ID/EN).
 *
 * Kunci diambil dari `i18n/id.ts`; `en.ts` diketik terhadap kunci itu, jadi
 * terjemahan yang tertinggal jadi error typecheck. Aplikasi ini SPA penuh
 * (`ssr: false`), jadi bahasa bisa dibaca dari localStorage saat state
 * pertama kali dibuat — tidak ada kedipan teks bahasa lain.
 */
export function useI18n() {
  const locale = useState<Locale>('app-locale', detect)

  function setLocale(next: Locale) {
    if (locale.value === next) return
    locale.value = next
    if (!import.meta.client) return
    try {
      localStorage.setItem(STORAGE_KEY, next)
    }
    catch {}
    document.documentElement.lang = next
  }

  function toggleLocale() {
    setLocale(locale.value === 'id' ? 'en' : 'id')
  }

  /** Selaraskan atribut `lang` di `<html>` dengan bahasa aktif. */
  function initLocale() {
    if (!import.meta.client) return
    document.documentElement.lang = locale.value
  }

  /**
   * Ambil teks dan isi placeholder-nya: `t('common.rounds', { n: 10 })`.
   * Placeholder yang tidak diberi nilai dibiarkan apa adanya supaya
   * kelihatan saat dicoba, bukan hilang tanpa jejak.
   */
  function t(key: MessageKey, params?: Params): string {
    const raw = DICTS[locale.value][key] ?? id[key] ?? key
    if (!params) return raw
    return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    )
  }

  return { locale, setLocale, toggleLocale, initLocale, t }
}
