import type { ScopeParts } from '~/composables/useScopeLabel'
import type { DatasetScope, GameMode, RegionItem, RegionLevel } from '~/types/game'

export type PrimaryScope = 'world' | 'indonesia'
export type IndonesiaLevel = 'provinces' | 'kabupaten' | 'kecamatan' | 'mixed'

export interface MixedLevels {
  province: boolean
  kabupaten: boolean
  kecamatan: boolean
}

/** Konfigurasi yang diingat antar kunjungan. */
interface PersistedSetup {
  primaryScope: PrimaryScope
  indonesiaLevel: IndonesiaLevel
  mode: GameMode
  timerEnabled: boolean
  rounds: number
  regionFilter: string
  province: string
  cityId: string
}

const STORAGE_KEY = 'geoguess_setup_v1'

/**
 * State panel setup di menu utama.
 *
 * Dipisahkan dari komponen halaman karena tiga kartu setup, ringkasan misi,
 * dan tombol mulai semuanya membaca state yang sama — kalau tinggal di
 * `index.vue`, setiap sub-komponen harus menerima belasan prop.
 */
export function useGameSetup() {
  const geo = useGeoData()
  const { playClick } = useAudio()
  const { t } = useI18n()
  const { formatScope, unitFor } = useScopeLabel()

  const primaryScope = useState<PrimaryScope>('setup-primary', () => 'indonesia')
  const indonesiaLevel = useState<IndonesiaLevel>('setup-id-level', () => 'kecamatan')
  const selectedProvince = useState('setup-province', () => 'DKI Jakarta')
  const kecamatanProvince = useState('setup-kec-province', () => 'Daerah Khusus Ibukota Jakarta')
  const regionFilter = useState('setup-region-filter', () => 'all')
  const selectedMode = useState<GameMode>('setup-mode', () => 'A')
  const timerEnabled = useState('setup-timer', () => false)
  const selectedRounds = useState('setup-rounds', () => 8)
  const mixedCityCount = useState('setup-mixed-cities', () => 4)
  const mixedLevels = useState<MixedLevels>('setup-mixed-levels', () => ({
    province: true,
    kabupaten: true,
    kecamatan: true,
  }))
  const mixedPending = useState('setup-mixed-pending', () => false)

  const activeScope = computed<DatasetScope>(() => {
    if (primaryScope.value === 'world') return 'world'
    if (indonesiaLevel.value === 'provinces') return 'id-provinces'
    if (indonesiaLevel.value === 'kabupaten') return 'id-kabupaten'
    if (indonesiaLevel.value === 'mixed') return 'id-mixed'
    return 'id-kecamatan'
  })

  const mixedLevelCount = computed(() =>
    Object.values(mixedLevels.value).filter(Boolean).length,
  )

  /**
   * Perkiraan jumlah soal mode campuran. Angkanya ditaksir, bukan dihitung:
   * pool sebenarnya baru dibangun saat sesi dimulai karena kecamatannya
   * diundi dari kota acak.
   */
  const mixedEstimate = computed(() => {
    let n = 0
    if (mixedLevels.value.province) n += 38
    if (mixedLevels.value.kabupaten) n += 514
    if (mixedLevels.value.kecamatan) n += mixedCityCount.value * 13
    return n
  })

  const poolSize = computed(() =>
    activeScope.value === 'id-mixed'
      ? mixedEstimate.value
      : geo.itemsInRegion(regionFilter.value).length,
  )

  /** Ronde tidak boleh melebihi jumlah wilayah yang tersedia. */
  const effectiveRounds = computed(() => Math.min(selectedRounds.value, poolSize.value))

  const roundOptions = computed(() => {
    const total = poolSize.value
    const all = { label: t('setup.session.roundsAll', { n: total }), value: total }
    if (total <= 5) return [all]
    if (total <= 10) return [{ label: '5', value: 5 }, all]
    return [
      { label: '5', value: 5 },
      { label: '10', value: 10 },
      total <= 20 ? all : { label: '20', value: 20 },
    ]
  })

  /** Kunci rekor: satu papan skor per cakupan, bukan satu angka global. */
  const scopeKey = computed(() => {
    const s = activeScope.value
    if (s === 'world') return regionFilter.value === 'all' ? 'world' : `world:${regionFilter.value}`
    if (s === 'id-provinces') return 'id-provinces'
    if (s === 'id-kabupaten') return `id-kabupaten:${selectedProvince.value}`
    if (s === 'id-mixed') return 'id-mixed'
    return `id-kecamatan:${geo.activeKecamatanCity.value?.id ?? ''}`
  })

  const unitLabel = computed(() => unitFor(activeScope.value))

  /**
   * Penyusun label cakupan, masih bebas bahasa. Ini yang diteruskan ke store
   * saat sesi dimulai — kalau yang disimpan teks jadinya, mengganti bahasa di
   * tengah sesi menyisakan label bahasa lama di layar hasil.
   */
  const scopeParts = computed<ScopeParts>(() => {
    const mixedParts = (['province', 'kabupaten', 'kecamatan'] as const)
      .filter(key => mixedLevels.value[key])

    return {
      scope: activeScope.value,
      regionFilter: regionFilter.value,
      provinceName: selectedProvince.value,
      cityName: geo.activeKecamatanCity.value?.city ?? '',
      mixedParts: [...mixedParts],
    }
  })

  const scopeLabel = computed(() => formatScope(scopeParts.value))

  const cityShortName = computed(() =>
    (geo.activeKecamatanCity.value?.city ?? '').replace(/^(Kota|Kabupaten)( Administrasi)? /, ''),
  )

  const modeLabel = computed(() =>
    selectedMode.value === 'A' ? t('setup.mode.a.title') : t('setup.mode.b.title'),
  )

  /** Setel ulang filter & ronde setelah cakupan berganti. */
  async function syncScope() {
    const scope = activeScope.value
    if (scope !== 'id-mixed') await geo.setScope(scope)

    if (scope === 'id-kabupaten') {
      regionFilter.value = selectedProvince.value
      selectedRounds.value = Math.min(10, poolSize.value || 5)
    }
    else {
      regionFilter.value = 'all'
      selectedRounds.value = scope === 'id-kecamatan'
        ? Math.min(10, poolSize.value || 8)
        : 10
    }
  }

  async function setPrimaryScope(scope: PrimaryScope) {
    if (primaryScope.value === scope) return
    primaryScope.value = scope
    playClick()
    await syncScope()
  }

  async function setIndonesiaLevel(level: IndonesiaLevel) {
    if (indonesiaLevel.value === level) return
    indonesiaLevel.value = level
    playClick()
    await syncScope()
  }

  function setProvince(province: string) {
    selectedProvince.value = province
    if (activeScope.value === 'id-kabupaten') {
      regionFilter.value = province
      selectedRounds.value = Math.min(10, geo.itemsInRegion(province).length || 5)
    }
    playClick()
  }

  async function setCity(cityId: string) {
    playClick()
    await geo.setKecamatanCity(cityId)
    const city = geo.activeKecamatanCity.value
    if (city) kecamatanProvince.value = city.province
    regionFilter.value = 'all'
    selectedRounds.value = Math.min(10, poolSize.value || 8)
  }

  function setMode(mode: GameMode) {
    if (selectedMode.value === mode) return
    selectedMode.value = mode
    playClick()
  }

  function toggleTimer() {
    timerEnabled.value = !timerEnabled.value
    playClick()
  }

  function toggleMixedLevel(key: keyof MixedLevels) {
    // Minimal satu level harus aktif; kalau semua mati, pool-nya kosong.
    if (mixedLevels.value[key] && mixedLevelCount.value === 1) return
    mixedLevels.value[key] = !mixedLevels.value[key]
    playClick()
  }

  /** Bangun pool soal final untuk sesi ini. */
  async function buildPool(): Promise<RegionItem[]> {
    if (activeScope.value !== 'id-mixed') {
      return geo.itemsInRegion(regionFilter.value)
    }

    mixedPending.value = true
    try {
      const levels: RegionLevel[] = []
      if (mixedLevels.value.province) levels.push('province')
      if (mixedLevels.value.kabupaten) levels.push('country')
      if (mixedLevels.value.kecamatan) levels.push('district')
      return await geo.buildMixedPool({ levels, cityCount: mixedCityCount.value })
    }
    finally {
      mixedPending.value = false
    }
  }

  function persist() {
    if (!import.meta.client) return
    const blob: PersistedSetup = {
      primaryScope: primaryScope.value,
      indonesiaLevel: indonesiaLevel.value,
      mode: selectedMode.value,
      timerEnabled: timerEnabled.value,
      rounds: selectedRounds.value,
      regionFilter: regionFilter.value,
      province: selectedProvince.value,
      cityId: geo.activeKecamatanCity.value?.id ?? '',
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(blob))
    }
    catch {}
  }

  /**
   * Pulihkan konfigurasi terakhir. Dipanggil sekali saat menu dibuka; scope
   * dan kota ikut dimuat ulang supaya panelnya langsung siap dipakai.
   */
  async function restore() {
    if (!import.meta.client) return
    let saved: PersistedSetup | null = null
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) saved = JSON.parse(raw) as PersistedSetup
    }
    catch {}
    if (!saved) return

    if (saved.primaryScope === 'world' || saved.primaryScope === 'indonesia') {
      primaryScope.value = saved.primaryScope
    }
    if (['provinces', 'kabupaten', 'kecamatan', 'mixed'].includes(saved.indonesiaLevel)) {
      indonesiaLevel.value = saved.indonesiaLevel
    }
    if (saved.mode === 'A' || saved.mode === 'B') selectedMode.value = saved.mode
    timerEnabled.value = Boolean(saved.timerEnabled)
    if (saved.province) selectedProvince.value = saved.province

    const scope = activeScope.value
    if (scope === 'id-kecamatan' && saved.cityId) {
      await geo.setKecamatanCity(saved.cityId).catch(() => {})
      const city = geo.activeKecamatanCity.value
      if (city) kecamatanProvince.value = city.province
    }
    else if (scope !== 'id-mixed') {
      await geo.setScope(scope).catch(() => {})
    }

    regionFilter.value = scope === 'id-kabupaten'
      ? selectedProvince.value
      : saved.regionFilter || 'all'

    // Rondenya divalidasi terhadap pool yang baru dimuat, bukan dipakai apa
    // adanya: cakupan tersimpan bisa lebih kecil dari saat terakhir dipakai.
    const total = poolSize.value
    selectedRounds.value = total > 0 ? Math.min(saved.rounds || 10, total) : 10
  }

  return {
    // state
    primaryScope,
    indonesiaLevel,
    selectedProvince,
    kecamatanProvince,
    regionFilter,
    selectedMode,
    timerEnabled,
    selectedRounds,
    mixedLevels,
    mixedCityCount,
    mixedPending,
    mixedLevelCount,
    // derived
    activeScope,
    poolSize,
    effectiveRounds,
    roundOptions,
    scopeKey,
    scopeParts,
    scopeLabel,
    unitLabel,
    modeLabel,
    cityShortName,
    mixedEstimate,
    // actions
    setPrimaryScope,
    setIndonesiaLevel,
    setProvince,
    setCity,
    setMode,
    toggleTimer,
    toggleMixedLevel,
    syncScope,
    buildPool,
    persist,
    restore,
  }
}
