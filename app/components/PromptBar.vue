<script setup lang="ts">
import type { RegionItem } from '~/types/game'
import { isoToFlag } from '~/utils/geo'
import { packForScope } from '~/utils/countryPacks'

const emit = defineEmits<{ answer: [item: RegionItem] }>()

const game = useGameStore()
const { t } = useI18n()
const { formatScope, shortCity, packText, capitalize } = useScopeLabel()

/** Paket negara sesi ini, kalau cakupannya salah satu paket. */
const activePack = computed(() => packForScope(game.datasetScope))
const answered = computed(() => game.phase === 'answered')

const hotkeys = ['A', 'B', 'C', 'D']

/** Opsi ini sudah dicoret oleh 50:50? */
function isEliminated(choice: RegionItem) {
  return !answered.value && game.eliminatedIds.includes(choice.id)
}

function choiceClass(choice: RegionItem) {
  if (!answered.value) {
    // Opsi yang dicoret tetap di tempatnya, tidak dihapus dari daftar:
    // memindahkan tombol setelah pemain sudah mengarahkan kursor ke salah
    // satunya membuat petunjuk terasa seperti gangguan, bukan bantuan.
    if (isEliminated(choice)) {
      return 'border-slate-200/50 dark:border-white/5 bg-slate-100/40 dark:bg-slate-950/40 text-slate-400 dark:text-slate-600 line-through opacity-45'
    }
    return 'border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 hover:border-sky-500/60 hover:bg-sky-50/50 dark:hover:bg-slate-800 shadow-sm'
  }
  if (choice.id === game.currentTarget?.id) {
    return 'border-emerald-500/80 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/30'
  }
  if (choice.id === game.lastAnswerId) {
    return 'border-rose-500/80 bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold ring-1 ring-rose-500/30'
  }
  return 'border-slate-200/50 dark:border-white/5 bg-slate-100/40 dark:bg-slate-950/40 text-slate-400 dark:text-slate-600 opacity-50'
}

// Keyboard shortcuts for Mode B: A, B, C, D or 1, 2, 3, 4
function handleKeyDown(e: KeyboardEvent) {
  if (game.mode !== 'B' || answered.value || !game.choices.length) return
  const key = e.key.toUpperCase()

  let selectedIndex = -1
  if (['A', 'B', 'C', 'D'].includes(key)) {
    selectedIndex = ['A', 'B', 'C', 'D'].indexOf(key)
  }
  else if (['1', '2', '3', '4'].includes(key)) {
    selectedIndex = Number(key) - 1
  }

  if (selectedIndex >= 0 && selectedIndex < game.choices.length) {
    const item = game.choices[selectedIndex]
    // Opsi yang sudah dicoret ditolak juga lewat papan ketik: kalau tidak,
    // menekan tombolnya masih menjawab sesuatu yang layarnya bilang mati.
    if (item && !isEliminated(item)) emit('answer', item)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

const challengeBadge = computed(() => {
  // Badge cakupan menyebut benua/provinsi/state — itu separuh jawabannya di
  // Mode A. Hardcore menggantinya dengan penanda kesulitan saja.
  if (game.isHardcore) return t('prompt.badge.hardcore')
  if (game.datasetScope === 'id-provinces') return t('prompt.badge.provinces')
  if (game.datasetScope === 'world') return t('scope.world')
  if (game.datasetScope === 'us-states') return t('prompt.badge.usStates')
  if (game.datasetScope === 'my-states') return t('prompt.badge.myStates')
  if (game.datasetScope === 'jp-prefectures') return t('prompt.badge.jpPrefectures')
  if (game.datasetScope === 'it-provinces') return t('prompt.badge.itProvinces')
  if (game.datasetScope === 'de-states') return t('prompt.badge.deStates')
  if (activePack.value) return formatScope({ scope: game.datasetScope })
  return formatScope({
    scope: game.datasetScope,
    provinceName: game.provinceName,
    cityName: game.cityName,
    stateName: game.stateName,
    mixedParts: game.scopeParts?.mixedParts,
  })
})

/**
 * Cakupan yang menentukan bunyi pertanyaan.
 *
 * Di mode campuran ini bukan `datasetScope` — scope-nya `id-mixed` sepanjang
 * sesi, sementara levelnya berganti tiap ronde. Membaca scope saja membuat
 * soal kecamatan ditanya sebagai "negara mana", karena `id-mixed` jatuh ke
 * cabang terakhir yang kebetulan milik peta dunia. Yang benar adalah level
 * target ronde berjalan, sama seperti yang sudah dipakai `MapView` untuk
 * memilih koleksi yang digambar.
 */
const promptScope = computed(() => {
  if (game.datasetScope !== 'id-mixed') return game.datasetScope
  const level = game.currentTarget?.level
  if (level === 'district') return 'id-kecamatan'
  if (level === 'country') return 'id-kabupaten'
  return 'id-provinces'
})

/**
 * Bendera di sebelah nama wilayah.
 *
 * Diturunkan dari scope, bukan ditulis `🇮🇩` untuk semua yang bukan dunia:
 * begitu ada negara ketiga, cabang "selain dunia berarti Indonesia" mulai
 * memasang bendera yang salah.
 */
/** Warna titik berdenyut di bilah soal, mengikuti negara cakupannya. */
const PACK_DOT: Record<string, string> = {
  sky: 'bg-sky-500', rose: 'bg-rose-500', blue: 'bg-blue-500',
  amber: 'bg-amber-500', emerald: 'bg-emerald-500', red: 'bg-red-500',
}

const scopeDotClass = computed(() => {
  if (game.isHardcore) return 'bg-rose-600'
  if (game.datasetScope === 'world') return 'bg-sky-500'
  // Paket negara dicek sebelum rantai awalan di bawah: kodenya bebas
  // (in-, ca-, …) dan bisa saja kebetulan berawalan sama dengan negara lain.
  if (activePack.value) return PACK_DOT[activePack.value.accent]
  if (game.datasetScope.startsWith('us')) return 'bg-blue-500'
  if (game.datasetScope.startsWith('my')) return 'bg-amber-500'
  if (game.datasetScope.startsWith('jp')) return 'bg-rose-400'
  if (game.datasetScope.startsWith('it')) return 'bg-emerald-500'
  if (game.datasetScope.startsWith('de')) return 'bg-red-500'
  return 'bg-rose-500'
})

const promptFlag = computed(() => {
  if (game.isHardcore) return '☠️'
  if (game.datasetScope === 'world') {
    return isoToFlag(game.currentTarget?.iso) || '🌐'
  }
  if (activePack.value) return activePack.value.flag
  if (game.datasetScope.startsWith('us')) return '🇺🇸'
  if (game.datasetScope.startsWith('my')) return '🇲🇾'
  if (game.datasetScope.startsWith('jp')) return '🇯🇵'
  if (game.datasetScope.startsWith('it')) return '🇮🇹'
  if (game.datasetScope.startsWith('de')) return '🇩🇪'
  return '🇮🇩'
})

const modeAInstruction = computed(() => {
  const name = game.currentTarget?.name ?? ''
  if (promptScope.value === 'id-kecamatan') return t('prompt.a.kecamatan', { name })
  if (promptScope.value === 'id-kabupaten') return t('prompt.a.kabupaten', { name })
  if (promptScope.value === 'id-provinces') return t('prompt.a.provinces')
  if (promptScope.value === 'us-states') return t('prompt.a.usStates', { name })
  if (promptScope.value === 'us-county') return t('prompt.a.usCounty', { name })
  if (promptScope.value === 'my-states') return t('prompt.a.myStates', { name })
  if (promptScope.value === 'jp-prefectures') return t('prompt.a.jpPrefectures', { name })
  if (promptScope.value === 'it-provinces') return t('prompt.a.itProvinces', { name })
  if (promptScope.value === 'de-states') return t('prompt.a.deStates', { name })
  if (activePack.value) {
    return t('pack.promptA', { name, country: packText(activePack.value).country })
  }
  return t('prompt.a.world')
})

const modeBQuestion = computed(() => {
  if (promptScope.value === 'id-kecamatan') {
    // Mode campuran menarik kecamatan dari beberapa kota acak, jadi tidak ada
    // satu "kota ini" yang benar — pertanyaannya dibiarkan tanpa penyebutan kota.
    if (game.datasetScope === 'id-mixed') return t('prompt.b.kecamatanMixed')
    return t('prompt.b.kecamatan', {
      city: shortCity(game.cityName) || t('prompt.b.cityFallback'),
    })
  }
  if (promptScope.value === 'id-kabupaten') {
    if (game.datasetScope === 'id-mixed') return t('prompt.b.kabupatenMixed')
    return t('prompt.b.kabupaten', {
      province: game.provinceName || t('prompt.b.provinceFallback'),
    })
  }
  if (promptScope.value === 'id-provinces') return t('prompt.b.provinces')
  if (promptScope.value === 'us-states') return t('prompt.b.usStates')
  if (promptScope.value === 'my-states') return t('prompt.b.myStates')
  if (promptScope.value === 'jp-prefectures') return t('prompt.b.jpPrefectures')
  if (promptScope.value === 'it-provinces') return t('prompt.b.itProvinces')
  if (promptScope.value === 'de-states') return t('prompt.b.deStates')
  if (activePack.value) {
    const txt = packText(activePack.value)
    return t('pack.promptB', { unitOne: capitalize(txt.unitOne), country: txt.country })
  }
  if (promptScope.value === 'us-county') {
    return t('prompt.b.usCounty', {
      state: game.stateName || t('prompt.b.stateFallback'),
    })
  }
  return t('prompt.b.world')
})
</script>

<template>
  <div class="raycast-card rounded-2xl p-4 sm:p-5 shadow-2xl">
    <!-- Mode A: Find on Map -->
    <template v-if="game.mode === 'A'">
      <div class="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-2.5">
        <div class="flex items-center gap-2">
          <span
            class="inline-flex h-2 w-2 rounded-full animate-pulse"
            :class="scopeDotClass"
          />
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {{ challengeBadge }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <!-- Chip benua/provinsi mempersempit peta drastis, jadi hardcore memakainya sebagai tanda tanya. -->
          <span
            v-if="game.currentTarget"
            class="rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors"
            :class="game.revealedRegion === game.currentTarget.region
              ? 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300'
              : 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'"
          >
            {{ game.isHardcore ? t('prompt.badge.hidden') : game.currentTarget.region }}
          </span>
          <span
            class="font-mono text-[11px] font-bold"
            :class="game.hintUsedThisRound ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400'"
          >
            {{ t('prompt.points', { n: game.nextPoints }) }}
          </span>
        </div>
      </div>

      <div class="mt-3 flex items-baseline justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5">
            <!-- Bendera langsung menyebut negaranya; hardcore memakai tengkorak. -->
            <span class="text-2xl select-none" aria-hidden="true">
              {{ promptFlag }}
            </span>
            <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white drop-shadow-sm">
              {{ game.currentTarget?.name }}
            </h2>
          </div>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {{ modeAInstruction }}
          </p>
        </div>
      </div>
    </template>

    <!-- Mode B: Multiple Choice from Highlighted Outline -->
    <template v-else>
      <div class="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-2.5">
        <div class="flex items-center gap-2">
          <span class="inline-flex h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
          <span class="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            {{ challengeBadge }}
          </span>
        </div>
        <span
          class="font-mono text-[11px] font-bold"
          :class="game.hintUsedThisRound ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400'"
        >
          {{ t('prompt.points', { n: game.nextPoints }) }}
        </span>
      </div>

      <p class="mt-2.5 text-sm font-bold text-slate-900 dark:text-white sm:text-base">
        {{ modeBQuestion }}
      </p>

      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          v-for="(choice, index) in game.choices"
          :key="choice.id"
          type="button"
          :disabled="answered || isEliminated(choice)"
          class="group flex min-h-11 items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-all disabled:cursor-default active:scale-98"
          :class="choiceClass(choice)"
          @click="emit('answer', choice)"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <kbd class="shadcn-kbd text-[10px]">
              {{ hotkeys[index] }}
            </kbd>
            <span class="truncate">
              {{ choice.name }}
            </span>
          </div>

          <span
            v-if="answered && choice.id === game.currentTarget?.id"
            class="shrink-0 text-emerald-600 dark:text-emerald-400 font-bold text-xs"
          >
            ✓ {{ t('common.correct') }}
          </span>
          <span
            v-else-if="answered && choice.id === game.lastAnswerId"
            class="shrink-0 text-rose-600 dark:text-rose-400 font-bold text-xs"
          >
            ✗ {{ t('common.wrong') }}
          </span>
        </button>
      </div>
    </template>
  </div>
</template>
