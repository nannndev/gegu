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
  <div ref="root" class="relative flex shrink-0 items-center">
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
          <!-- GitHub & Kontributor tinggal di menu ini, bukan jadi tombol
               sendiri di header: tautan keluar yang jarang diklik tidak perlu
               bersaing tempat dengan kontrol yang dipakai tiap sesi. -->
          <div>
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
