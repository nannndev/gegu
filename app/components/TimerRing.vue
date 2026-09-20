<script setup lang="ts">
/**
 * Cincin waktu: sisa detik sebagai busur yang menyusut.
 *
 * Menggantikan angka telanjang karena yang dibutuhkan pemain di tengah ronde
 * bukan bilangan persisnya, tapi rasa "masih lama / sudah mepet" yang bisa
 * ditangkap lewat sudut mata sementara perhatiannya di peta.
 */
const props = defineProps<{
  secondsLeft: number
  totalSeconds: number
}>()

const RADIUS = 13
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const clamped = computed(() => Math.max(0, Math.min(props.secondsLeft, props.totalSeconds)))

const fraction = computed(() =>
  props.totalSeconds > 0 ? clamped.value / props.totalSeconds : 0,
)

/** Busur digambar dari penuh ke kosong lewat dash offset. */
const dashOffset = computed(() => CIRCUMFERENCE * (1 - fraction.value))

/**
 * Tiga tahap warna, bukan gradasi mulus: perubahan warna hanya berguna kalau
 * terbaca sebagai peringatan, dan pergeseran satu langkah hue per detik tidak
 * pernah cukup mencolok untuk itu.
 */
const urgency = computed(() => {
  if (clamped.value <= 3) return 'critical'
  if (fraction.value <= 0.4) return 'warn'
  return 'calm'
})
</script>

<template>
  <div
    class="pointer-events-auto relative inline-flex h-9 w-9 items-center justify-center"
    :class="urgency === 'critical' ? 'timer-ring-critical' : ''"
    role="timer"
    aria-live="off"
  >
    <svg class="h-9 w-9 -rotate-90" viewBox="0 0 32 32" aria-hidden="true">
      <circle
        cx="16"
        cy="16"
        :r="RADIUS"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        class="text-slate-200 dark:text-slate-700"
      />
      <circle
        cx="16"
        cy="16"
        :r="RADIUS"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="dashOffset"
        class="timer-ring-arc"
        :class="{
          'text-sky-500': urgency === 'calm',
          'text-amber-500': urgency === 'warn',
          'text-rose-500': urgency === 'critical',
        }"
      />
    </svg>

    <span
      class="absolute font-mono text-[11px] font-bold tabular-nums"
      :class="{
        'text-slate-700 dark:text-slate-200': urgency === 'calm',
        'text-amber-600 dark:text-amber-400': urgency === 'warn',
        'text-rose-600 dark:text-rose-400': urgency === 'critical',
      }"
    >
      {{ Math.ceil(clamped) }}
    </span>
  </div>
</template>
