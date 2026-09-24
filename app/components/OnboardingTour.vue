<script setup lang="ts">
import type { GameMode } from '~/types/game'
import { chainHeatColor, formatDistance } from '~/utils/distance'

/**
 * Panduan singkat untuk pengunjung pertama: satu layar per mode.
 *
 * Nama modenya saja tidak cukup menjelaskan cara main — terutama Rantai
 * Jarak, yang aturannya (tebak terus sampai kena, warna = jarak) tidak
 * tertebak dari judul. Tiap langkah punya ilustrasi kecil supaya pemain
 * melihat bentuk permainannya, bukan cuma membaca paragraf.
 */
const open = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  /** Pemain menekan "Coba mode ini" — halaman menu memilihkan modenya. */
  pick: [mode: GameMode]
}>()

const { t, locale } = useI18n()

const STEPS = ['A', 'B', 'C'] as const
const step = ref(0)
const mode = computed(() => STEPS[step.value]!)
const last = computed(() => step.value === STEPS.length - 1)

const panel = ref<HTMLElement | null>(null)

watch(open, async (v) => {
  if (!v) return
  step.value = 0
  await nextTick()
  panel.value?.focus()
})

function close() {
  markOnboarded()
  open.value = false
}

function next() {
  if (last.value) close()
  else step.value++
}

function back() {
  if (step.value > 0) step.value--
}

function pick() {
  emit('pick', mode.value)
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
  else if (e.key === 'ArrowRight') {
    e.preventDefault()
    if (!last.value) step.value++
  }
  else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    back()
  }
}

/** Warna panas-dingin ilustrasi Rantai: dari jauh (merah) ke kena (hijau). */
const heat = [chainHeatColor(0.9), chainHeatColor(0.5), chainHeatColor(0.15)]
const km = computed(() => [2100, 640, 120].map(n => formatDistance(n, locale.value)))
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    leave-active-class="transition duration-150 ease-in"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="fixed inset-0 z-[1200] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center"
      @click.self="close"
    >
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabindex="-1"
        class="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl outline-none sm:p-6"
        @keydown="onKeydown"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="font-mono text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            {{ t('onboarding.eyebrow', { n: step + 1, total: STEPS.length }) }}
          </p>
          <button
            type="button"
            class="focusable rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
            @click="close"
          >
            {{ t('onboarding.skip') }}
          </button>
        </div>

        <!-- Ilustrasi: tiap mode digambar sebagai potongan layar mainnya. -->
        <div class="onb-stage mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800" aria-hidden="true">
          <Transition mode="out-in" name="onb">
            <svg v-if="mode === 'A'" key="A" viewBox="0 0 320 150" class="block h-auto w-full">
              <rect x="70" y="12" width="180" height="24" rx="12" class="onb-chip" />
              <text x="160" y="28" text-anchor="middle" class="onb-chip-text">{{ t('onboarding.a.prompt') }}</text>
              <path d="M40 70 L110 58 L128 96 L92 132 L34 118 Z" class="onb-land" />
              <path d="M128 96 L110 58 L176 52 L196 90 L160 124 Z" class="onb-land onb-pulse" />
              <path d="M196 90 L176 52 L250 62 L284 104 L230 136 L160 124 Z" class="onb-land" />
              <!-- Kursor mengetuk wilayah yang benar. -->
              <g class="onb-cursor" transform="translate(152 84)">
                <path d="M0 0 L0 22 L6 16 L11 26 L15 24 L10 14 L18 14 Z" class="onb-cursor-shape" />
              </g>
            </svg>

            <svg v-else-if="mode === 'B'" key="B" viewBox="0 0 320 150" class="block h-auto w-full">
              <path d="M24 44 L74 32 L90 70 L60 104 L20 92 Z" class="onb-land" />
              <path d="M90 70 L74 32 L124 28 L140 64 L110 98 Z" class="onb-land onb-hilite" />
              <path d="M60 104 L90 70 L110 98 L100 132 L50 128 Z" class="onb-land" />
              <g v-for="(opt, i) in ['A', 'B', 'C', 'D']" :key="opt" :transform="`translate(172 ${18 + i * 30})`">
                <rect width="128" height="24" rx="8" :class="i === 1 ? 'onb-opt onb-opt-on' : 'onb-opt'" />
                <text x="12" y="16" class="onb-opt-key">{{ opt }}</text>
                <rect x="30" y="9" :width="[62, 78, 54, 70][i]" height="6" rx="3" class="onb-opt-line" />
              </g>
            </svg>

            <svg v-else key="C" viewBox="0 0 320 150" class="block h-auto w-full">
              <path d="M22 50 L80 36 L98 80 L60 118 L18 104 Z" :style="{ fill: heat[0] }" class="onb-heat" />
              <path d="M98 80 L80 36 L150 30 L170 76 L130 112 Z" :style="{ fill: heat[1] }" class="onb-heat" />
              <path d="M170 76 L150 30 L220 38 L236 82 L196 118 Z" :style="{ fill: heat[2] }" class="onb-heat" />
              <path d="M236 82 L220 38 L292 50 L302 100 L256 128 L196 118 Z" class="onb-land onb-dashed" />
              <text x="58" y="82" text-anchor="middle" class="onb-km">{{ km[0] }}</text>
              <text x="132" y="74" text-anchor="middle" class="onb-km">{{ km[1] }}</text>
              <text x="200" y="80" text-anchor="middle" class="onb-km">{{ km[2] }}</text>
              <text x="262" y="92" text-anchor="middle" class="onb-q">?</text>
            </svg>
          </Transition>
        </div>

        <h2 id="onboarding-title" class="font-display mt-4 text-lg font-black tracking-tight text-slate-900 dark:text-white">
          {{ t(`onboarding.${mode.toLowerCase() as 'a' | 'b' | 'c'}.title`) }}
        </h2>
        <p class="mt-1 min-h-[3.75rem] text-sm leading-relaxed text-slate-600 dark:text-slate-400" aria-live="polite">
          {{ t(`onboarding.${mode.toLowerCase() as 'a' | 'b' | 'c'}.body`) }}
        </p>

        <button
          type="button"
          class="focusable mt-2 text-xs font-semibold text-sky-600 dark:text-sky-400 underline-offset-2 hover:underline"
          @click="pick"
        >
          {{ t('onboarding.try') }} →
        </button>

        <div class="mt-5 flex items-center justify-between gap-3">
          <!-- Titik langkah: bisa diklik untuk loncat langsung. -->
          <div class="flex items-center gap-1.5">
            <button
              v-for="(s, i) in STEPS"
              :key="s"
              type="button"
              class="focusable h-2 rounded-full transition-all"
              :class="i === step ? 'w-6 !bg-sky-500' : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'"
              :aria-label="t('onboarding.goto', { n: i + 1 })"
              :aria-current="i === step ? 'step' : undefined"
              @click="step = i"
            />
          </div>

          <div class="flex items-center gap-2">
            <button
              v-if="step > 0"
              type="button"
              class="focusable rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              @click="back"
            >
              {{ t('onboarding.back') }}
            </button>
            <button
              type="button"
              class="focusable rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-sky-500 active:scale-95"
              @click="next"
            >
              {{ last ? t('onboarding.done') : t('onboarding.next') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.onb-stage {
  --onb-bg: #f1f5f9;
  --onb-land: #cbd5e1;
  --onb-edge: #94a3b8;
  --onb-text: #334155;
  background: var(--onb-bg);
}
:global(.dark .onb-stage) {
  --onb-bg: #0b1220;
  --onb-land: #1e293b;
  --onb-edge: #334155;
  --onb-text: #cbd5e1;
}
.onb-land {
  fill: var(--onb-land);
  stroke: var(--onb-edge);
  stroke-width: 1.2;
}
.onb-pulse {
  animation: onb-pulse 1.8s ease-in-out infinite;
}
.onb-hilite {
  fill: color-mix(in srgb, var(--color-target) 60%, transparent);
  stroke: var(--color-target);
  stroke-width: 2;
}
.onb-dashed {
  stroke-dasharray: 4 3;
}
.onb-heat {
  stroke: var(--onb-bg);
  stroke-width: 1.5;
}
.onb-chip {
  fill: #0284c7;
}
.onb-chip-text {
  fill: #fff;
  font-size: 11px;
  font-weight: 700;
}
.onb-cursor {
  animation: onb-tap 1.8s ease-in-out infinite;
}
.onb-cursor-shape {
  fill: #fff;
  stroke: #0f172a;
  stroke-width: 1.5;
  stroke-linejoin: round;
}
.onb-opt {
  fill: var(--onb-land);
  stroke: var(--onb-edge);
}
.onb-opt-on {
  fill: color-mix(in srgb, var(--color-correct) 30%, transparent);
  stroke: var(--color-correct);
  stroke-width: 1.5;
}
.onb-opt-key {
  fill: var(--onb-text);
  font-size: 10px;
  font-weight: 700;
  font-family: ui-monospace, monospace;
}
.onb-opt-line {
  fill: var(--onb-edge);
}
.onb-km {
  fill: #fff;
  font-size: 10px;
  font-weight: 700;
  paint-order: stroke;
  stroke: rgb(15 23 42 / 0.55);
  stroke-width: 3px;
}
.onb-q {
  fill: var(--onb-text);
  font-size: 22px;
  font-weight: 900;
}

@keyframes onb-pulse {
  0%, 100% { fill: var(--onb-land); }
  50% { fill: color-mix(in srgb, var(--color-correct) 55%, transparent); }
}
@keyframes onb-tap {
  0%, 100% { transform: translate(172px, 104px); }
  45%, 60% { transform: translate(152px, 84px); }
  52% { transform: translate(152px, 84px) scale(0.9); }
}

.onb-enter-active,
.onb-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.onb-enter-from {
  opacity: 0;
  transform: translateX(12px);
}
.onb-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

@media (prefers-reduced-motion: reduce) {
  .onb-pulse,
  .onb-cursor {
    animation: none;
  }
}
</style>
