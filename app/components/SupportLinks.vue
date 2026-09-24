<script setup lang="ts">
import { CONTRIBUTORS_URL, DONATE_OPTIONS, GITHUB_URL } from '~/utils/support'

const { t } = useI18n()
const open = ref(false)
const root = ref<HTMLElement | null>(null)

function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="root" class="relative flex shrink-0 items-center gap-1.5 sm:gap-2">
    <!-- GitHub -->
    <a
      :href="GITHUB_URL"
      target="_blank"
      rel="noopener"
      class="focusable hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 sm:flex"
      :title="t('support.github')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-600 dark:text-slate-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.66.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.67.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
      </svg>
    </a>

    <!-- Contributors -->
    <a
      :href="CONTRIBUTORS_URL"
      target="_blank"
      rel="noopener"
      class="focusable hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 sm:flex"
      :title="t('support.contributors')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-600 dark:text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    </a>

    <!-- Donate dropdown -->
    <div class="relative">
      <button
        type="button"
        class="focusable flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
        :title="t('support.donate')"
        :aria-expanded="open"
        aria-haspopup="menu"
        @click.stop="open = !open"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>

      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 scale-95 -translate-y-1"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0 scale-95 -translate-y-1"
      >
        <div
          v-if="open"
          role="menu"
          class="absolute right-0 top-full z-50 mt-2 w-52 origin-top-right rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-2xl"
        >
          <!-- Di layar sempit tombol GitHub & Kontributor disembunyikan dari
               header supaya tidak meluber; aksesnya dipindah ke sini. -->
          <div class="sm:hidden">
            <a
              role="menuitem"
              :href="GITHUB_URL"
              target="_blank"
              rel="noopener"
              class="flex items-center rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              @click="open = false"
            >{{ t('support.github') }}</a>
            <a
              role="menuitem"
              :href="CONTRIBUTORS_URL"
              target="_blank"
              rel="noopener"
              class="flex items-center rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              @click="open = false"
            >{{ t('support.contributors') }}</a>
            <div class="mx-2 my-1 h-px bg-slate-200 dark:bg-slate-800" />
          </div>
          <p class="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {{ t('support.donate') }}
          </p>
          <a
            v-for="d in DONATE_OPTIONS"
            :key="d.label"
            role="menuitem"
            :href="d.url"
            target="_blank"
            rel="noopener"
            class="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            @click="open = false"
          >
            <span>{{ d.label }}</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </Transition>
    </div>
  </div>
</template>
