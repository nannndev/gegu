/**
 * Tautan komunitas & donasi yang dipasang di header.
 *
 * Disimpan di satu tempat supaya URL-nya mudah diganti tanpa menyentuh
 * komponen. Repo-nya: https://github.com/nannndev/gegu
 */

export const GITHUB_URL = 'https://github.com/nannndev/gegu'
export const CONTRIBUTORS_URL = `${GITHUB_URL}/graphs/contributors`

export interface DonateOption {
  /** Nama platform; nama merek, tidak diterjemahkan. */
  label: string
  url: string
}

/**
 * Platform donasi. `ekaprasety8` adalah handle Buy Me a Coffee yang sama
 * dengan project Beacon; handle Saweria & Ko-fi tinggal diisi di sini.
 */
export const DONATE_OPTIONS: DonateOption[] = [
  { label: 'Buy Me a Coffee', url: 'https://buymeacoffee.com/ekaprasety8' },
  { label: 'Saweria', url: 'https://saweria.co/YOUR_USERNAME' },
  { label: 'Ko-fi', url: 'https://ko-fi.com/YOUR_USERNAME' },
]
