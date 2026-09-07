<script setup lang="ts" generic="T extends string">
/**
 * Dropdown dengan pencarian, dipakai untuk semua pemilih di menu utama.
 * Daftar wilayah Indonesia panjang (38 provinsi, 514 kab/kota), jadi
 * `<select>` bawaan menyulitkan — ini menambah pencarian berperingkat,
 * pengelompokan opsional, dan navigasi keyboard.
 */
export interface SearchOption<V extends string = string> {
  value: V
  label: string
  /** Angka di kanan, mis. jumlah kabupaten di provinsi itu. */
  count?: number
  /** Baris kecil di bawah label. */
  hint?: string
  /** Header pengelompokan; opsi tanpa grup ditampilkan lebih dulu. */
  group?: string
  /** Awalan kecil di kiri label, mis. "Kab." / "Kota". */
  badge?: string
}

const props = withDefaults(defineProps<{
  modelValue: T
  options: SearchOption<T>[]
  label?: string
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  /** Warna aksen: menyesuaikan konteks kartu tempat dropdown ini dipakai. */
  accent?: 'sky' | 'amber' | 'slate'
  /** Sembunyikan kolom cari kalau opsinya sedikit. */
  searchThreshold?: number
}>(), {
  accent: 'sky',
  searchThreshold: 8,
  placeholder: 'Pilih…',
  searchPlaceholder: 'Cari…',
})

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const open = ref(false)
const query = ref('')
const activeIndex = ref(0)
const rootEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)

const selected = computed(() => props.options.find(o => o.value === props.modelValue) ?? null)
const showSearch = computed(() => props.options.length >= props.searchThreshold)

const ACCENTS = {
  sky: {
    trigger: 'border-sky-500/40 hover:border-sky-400/70',
    label: 'text-sky-100',
    chevron: 'text-sky-300',
    activeText: 'text-sky-300',
    focus: 'focus:border-sky-400',
  },
  amber: {
    trigger: 'border-amber-500/40 hover:border-amber-400/70',
    label: 'text-amber-100',
    chevron: 'text-amber-300',
    activeText: 'text-amber-300',
    focus: 'focus:border-amber-400',
  },
  slate: {
    trigger: 'border-white/10 hover:border-white/20',
    label: 'text-slate-200',
    chevron: 'text-slate-400',
    activeText: 'text-sky-300',
    focus: 'focus:border-sky-400',
  },
} as const

const accent = computed(() => ACCENTS[props.accent])

/** Peringkat: awalan label > mengandung label > mengandung grup/hint. */
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.options

  const scored: { option: SearchOption<T>, rank: number }[] = []
  for (const o of props.options) {
    const label = o.label.toLowerCase()
    let rank = -1
    if (label.startsWith(q)) rank = 0
    else if (label.includes(q)) rank = 1
    else if ((o.group ?? '').toLowerCase().includes(q)) rank = 2
    else if ((o.hint ?? '').toLowerCase().includes(q)) rank = 3
    if (rank >= 0) scored.push({ option: o, rank })
  }
  return scored
    .sort((a, b) => a.rank - b.rank || a.option.label.localeCompare(b.option.label))
    .map(s => s.option)
})

/** Kelompokkan hasil; opsi tanpa `group` masuk kelompok tanpa header. */
const grouped = computed(() => {
  const groups: { group: string | null, options: SearchOption<T>[] }[] = []
  for (const o of results.value) {
    const g = o.group ?? null
    const last = groups[groups.length - 1]
    if (last && last.group === g) last.options.push(o)
    else groups.push({ group: g, options: [o] })
  }
  return groups
})

watch(results, () => { activeIndex.value = 0 })

function openMenu() {
  if (props.disabled) return
  open.value = true
  // Mulai dari opsi yang sedang terpilih supaya keyboard terasa wajar.
  activeIndex.value = Math.max(0, results.value.findIndex(o => o.value === props.modelValue))
  nextTick(() => {
    inputEl.value?.focus()
    scrollActiveIntoView()
  })
}

function closeMenu() {
  open.value = false
  query.value = ''
}

function choose(option: SearchOption<T>) {
  emit('update:modelValue', option.value)
  closeMenu()
}

function scrollActiveIntoView() {
  nextTick(() => {
    listEl.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  })
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) {
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault()
      openMenu()
    }
    return
  }
  if (e.key === 'Escape' || e.key === 'Tab') {
    if (e.key === 'Escape') e.preventDefault()
    closeMenu()
    return
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const n = results.value.length
    if (!n) return
    activeIndex.value = (activeIndex.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
    scrollActiveIntoView()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const option = results.value[activeIndex.value]
    if (option) choose(option)
  }
}

function indexOf(option: SearchOption<T>) {
  return results.value.indexOf(option)
}

function onDocumentPointer(e: MouseEvent) {
  if (open.value && !rootEl.value?.contains(e.target as Node)) closeMenu()
}

onMounted(() => document.addEventListener('mousedown', onDocumentPointer))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentPointer))
</script>

<template>
  <div ref="rootEl" class="relative">
    <button
      type="button"
      class="focusable flex w-full items-center justify-between gap-2 rounded-lg border bg-slate-950 px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
      :class="accent.trigger"
      :disabled="disabled"
      :aria-expanded="open"
      :aria-label="label"
      aria-haspopup="listbox"
      @click="open ? closeMenu() : openMenu()"
      @keydown="onKeydown"
    >
      <span class="min-w-0 flex-1">
        <span class="block truncate text-xs font-semibold" :class="accent.label">
          {{ selected?.label ?? placeholder }}
        </span>
        <span v-if="selected?.hint" class="block truncate text-[10px] text-slate-400">
          {{ selected.hint }}
        </span>
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 transition-transform"
        :class="[accent.chevron, open ? 'rotate-180' : '']"
        viewBox="0 0 20 20" fill="currentColor"
      >
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="absolute z-50 mt-1.5 w-full min-w-56 overflow-hidden rounded-xl border border-white/[0.08] bg-slate-900 shadow-2xl"
      >
        <div v-if="showSearch" class="border-b border-white/[0.06] p-2">
          <input
            ref="inputEl"
            v-model="query"
            type="text"
            :placeholder="searchPlaceholder"
            :aria-label="searchPlaceholder"
            class="focusable w-full rounded-lg border border-white/[0.08] bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500"
            :class="accent.focus"
            @keydown="onKeydown"
          >
        </div>

        <div ref="listEl" role="listbox" class="max-h-72 overflow-y-auto overscroll-contain py-1">
          <p v-if="!results.length" class="px-3 py-6 text-center text-[11px] text-slate-500">
            Tidak ada yang cocok.
          </p>

          <template v-for="(g, gi) in grouped" :key="g.group ?? `g${gi}`">
            <p
              v-if="g.group"
              class="sticky top-0 bg-slate-900/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur"
            >
              {{ g.group }}
            </p>
            <button
              v-for="o in g.options"
              :key="o.value"
              type="button"
              role="option"
              :aria-selected="o.value === modelValue"
              :data-active="indexOf(o) === activeIndex"
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left transition"
              :class="[
                indexOf(o) === activeIndex ? 'bg-white/[0.07]' : '',
                o.value === modelValue ? accent.activeText : 'text-slate-200',
              ]"
              @click="choose(o)"
              @mouseenter="activeIndex = indexOf(o)"
            >
              <span v-if="o.badge" class="w-8 shrink-0 text-[10px] font-medium text-slate-500">{{ o.badge }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[11px] font-medium">{{ o.label }}</span>
                <span v-if="o.hint" class="block truncate text-[10px] text-slate-500">{{ o.hint }}</span>
              </span>
              <span v-if="o.count !== undefined" class="shrink-0 text-[10px] tabular-nums text-slate-500">
                {{ o.count }}
              </span>
              <span v-if="o.value === modelValue" class="shrink-0 text-[10px] font-bold" aria-hidden="true">✓</span>
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>
