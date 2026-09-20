<script setup lang="ts">
/**
 * Deret ronde: satu petak per soal, terisi begitu ronde itu terjawab.
 *
 * Angka "Ronde 4/10" menjawab berapa yang tersisa, tapi tidak menjawab
 * bagaimana jalannya sejauh ini — dan itu yang menentukan apakah pemain
 * masih mengejar rekor atau sudah main santai. Deret ini menampilkan
 * keduanya dalam satu baris setinggi HUD.
 */
const game = useGameStore()
const { t } = useI18n()

type Slot = 'correct' | 'near' | 'wrong' | 'current' | 'pending'

const slots = computed<Slot[]>(() =>
  Array.from({ length: game.totalRounds }, (_, i) => {
    const row = game.history[i]
    if (row) {
      if (row.correct) return 'correct'
      // Nyaris-kena dibedakan dari meleset jauh: kalau keduanya tampil
      // merah, deret ini menyembunyikan satu-satunya hal yang membuat
      // poin parsial terasa berbeda dari nol.
      return row.pointsEarned > 0 ? 'near' : 'wrong'
    }
    return i + 1 === game.currentRound ? 'current' : 'pending'
  }),
)

/**
 * Di sesi panjang, petaknya dipersempit supaya deretnya tidak mendorong
 * tombol lain keluar dari HUD di layar ponsel.
 */
const dense = computed(() => game.totalRounds > 12)
</script>

<template>
  <div
    class="pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 px-2.5 shadow-md backdrop-blur-md"
    role="img"
    :aria-label="t('hud.trackLabel', {
      current: game.currentRound,
      total: game.totalRounds,
      correct: game.correctCount,
    })"
  >
    <span
      v-for="(slot, i) in slots"
      :key="i"
      class="rounded-full transition-all duration-300"
      :class="[
        dense ? 'w-1' : 'w-1.5',
        slot === 'current' ? 'h-4' : 'h-2.5',
        {
          'bg-emerald-500': slot === 'correct',
          'bg-amber-500': slot === 'near',
          'bg-rose-500/80': slot === 'wrong',
          'bg-sky-500 round-track-active': slot === 'current',
          'bg-slate-300 dark:bg-slate-700': slot === 'pending',
        },
      ]"
    />
  </div>
</template>
