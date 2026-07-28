<script setup>
import { getOpportunitySections } from '~~/shared/opportunities/taxonomy'
import {
  OPPORTUNITY_CATEGORY_LABELS,
} from '~~/shared/utils/opportunities'
import {
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_MODES,
} from '~~/shared/schemas/opportunities'
import {
  opportunityCadenceMs,
} from '~/utils/opportunity-cadence'
import {
  filterAndSortOpportunities,
  OPPORTUNITY_RESULT_PAGE_SIZE,
  visibleOpportunityResults,
} from '~/utils/opportunity-results'

definePageMeta({
  layout: 'app',
  middleware: ['auth', 'onboarded'],
})

useSeoMeta({
  title: 'Opportunity Radar · Northstar',
  description: 'Discover internships, competitions, volunteering and programmes worth pursuing.',
})

const {
  discovery,
  discoveryLoading,
  error,
  refreshing,
  refreshResult,
  refreshError,
  loadDiscovery,
  refreshNow,
} = useOpportunities()

const { user } = useCurrentSession()
const sections = getOpportunitySections()
const selectedSource = ref('all')
const selectedCategory = ref('')
const selectedMode = ref('')
const selectedSort = ref('')
const visibleCount = ref(OPPORTUNITY_RESULT_PAGE_SIZE)
const clock = ref(Date.now())
let cadenceTimer = null
let clockTimer = null

const sectionStats = computed(() => new Map(
  (discovery.value?.sections || [])
    .map(section => [section.slug, section]),
))

const sourceFilters = computed(() => [
  {
    key: 'all',
    label: 'All trusted sources',
  },
  ...(discovery.value?.availableSources || []).map(source => ({
    key: source.key,
    label: source.name,
  })),
])

const effectiveSort = computed(() =>
  selectedSort.value
  || discovery.value?.appliedPreferences?.defaultSort
  || 'RECOMMENDED',
)

const temporaryFilters = computed(() => ({
  source: selectedSource.value,
  category: selectedCategory.value,
  mode: selectedMode.value,
  sort: effectiveSort.value,
}))

function preview(items) {
  return filterAndSortOpportunities(
    items,
    {
      ...temporaryFilters.value,
      sort: 'RECOMMENDED',
    },
  ).slice(0, 6)
}

const filteredClosingSoon = computed(() =>
  preview(discovery.value?.closingSoon || []),
)

const filteredNewest = computed(() =>
  preview(discovery.value?.newest || []),
)

const filteredSaved = computed(() =>
  preview(discovery.value?.saved || []),
)

const filteredResults = computed(() =>
  filterAndSortOpportunities(
    discovery.value?.results || [],
    temporaryFilters.value,
  ),
)

const visibleResults = computed(() =>
  visibleOpportunityResults(
    filteredResults.value,
    visibleCount.value,
  ),
)

const hasMoreResults = computed(() =>
  visibleResults.value.length < filteredResults.value.length,
)

const hasActiveFilters = computed(() =>
  selectedSource.value !== 'all'
  || Boolean(selectedCategory.value)
  || Boolean(selectedMode.value)
  || Boolean(selectedSort.value),
)

const sortLabel = computed(() => ({
  RECOMMENDED: 'Recommended',
  NEWEST: 'Newest',
  DEADLINE: 'Deadline',
  PORTFOLIO_VALUE: 'Portfolio value',
})[effectiveSort.value] || 'Recommended')

const preferenceSummary = computed(() => {
  const preferences = discovery.value?.appliedPreferences
  if (!preferences) return 'Using your Opportunity Radar preferences'

  const parts = []
  if (preferences.preferredSources?.length) {
    parts.push(`${preferences.preferredSources.length} preferred source${preferences.preferredSources.length === 1 ? '' : 's'}`)
  }
  if (preferences.preferredCategories?.length) {
    parts.push(`${preferences.preferredCategories.length} preferred categor${preferences.preferredCategories.length === 1 ? 'y' : 'ies'}`)
  }
  if (preferences.portfolioGoals?.length) {
    parts.push(`${preferences.portfolioGoals.length} portfolio goal${preferences.portfolioGoals.length === 1 ? '' : 's'}`)
  }

  return parts.length
    ? parts.join(' · ')
    : 'All opportunities allowed by your saved preferences'
})

const nextAllowedAt = computed(() =>
  refreshResult.value?.nextAllowedAt
    || (discovery.value?.lastManualRefreshAt
      ? new Date(
          new Date(discovery.value.lastManualRefreshAt).getTime()
          + 15 * 60 * 1000,
        ).toISOString()
      : null),
)

const coolingDown = computed(() =>
  nextAllowedAt.value
  && new Date(nextAllowedAt.value).getTime() > clock.value,
)

function formatRefreshTime(value) {
  if (!value) return 'Not refreshed yet'
  return new Intl.DateTimeFormat('en-SG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function clearFilters() {
  selectedSource.value = 'all'
  selectedCategory.value = ''
  selectedMode.value = ''
  selectedSort.value = ''
}

function loadMore() {
  visibleCount.value += OPPORTUNITY_RESULT_PAGE_SIZE
}

watch(
  () => JSON.stringify([
    selectedSource.value,
    selectedCategory.value,
    selectedMode.value,
    selectedSort.value,
  ]),
  () => {
    visibleCount.value = OPPORTUNITY_RESULT_PAGE_SIZE
  },
)

function clearCadenceTimer() {
  if (cadenceTimer) clearTimeout(cadenceTimer)
  cadenceTimer = null
}

function scheduleCadenceRefresh() {
  clearCadenceTimer()
  const interval = opportunityCadenceMs(
    discovery.value?.appliedPreferences?.feedRefreshCadence,
  )
  if (!interval) return
  cadenceTimer = setTimeout(async () => {
    await loadDiscovery(true)
    scheduleCadenceRefresh()
  }, interval)
}

async function runRefresh() {
  await refreshNow()
  clock.value = Date.now()
}

watch(
  () => discovery.value?.appliedPreferences?.feedRefreshCadence,
  scheduleCadenceRefresh,
)

onMounted(() => {
  clockTimer = setInterval(() => {
    clock.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  clearCadenceTimer()
  if (clockTimer) clearInterval(clockTimer)
})

watch(
  user,
  current => {
    if (current) {
      void loadDiscovery(true).then(scheduleCadenceRefresh)
    }
  },
  { immediate: true },
)
</script>

<template>
  <main class="app-page opportunities-page opportunity-radar-page">
    <header class="app-page__header opportunity-radar-header">
      <div>
        <p class="app-page__eyebrow">Opportunity Radar</p>
        <h1>Find what is worth pursuing</h1>
        <span>Curated opportunities, ranked for your goals and portfolio.</span>
      </div>
      <div class="opportunity-radar-actions">
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          :loading="refreshing"
          :disabled="coolingDown"
          @click="runRefresh"
        >
          Refresh now
        </UButton>
        <UButton to="/app/opportunities#saved-opportunities" color="neutral" variant="outline">
          View saved
        </UButton>
        <UButton to="/app/opportunities/new" icon="i-lucide-plus">
          Add opportunity
        </UButton>
      </div>
    </header>

    <div class="opportunity-refresh-status" aria-live="polite">
      <span>Sources updated {{ formatRefreshTime(discovery?.lastGlobalSourceRefreshAt) }}</span>
      <span v-if="discovery?.lastManualRefreshAt">Your refresh {{ formatRefreshTime(discovery.lastManualRefreshAt) }}</span>
      <span v-if="coolingDown">Available again {{ formatRefreshTime(nextAllowedAt) }}</span>
      <span v-else-if="discovery?.appliedPreferences?.feedRefreshCadence === 'MANUAL'">Automatic feed checks are off</span>
    </div>

    <p v-if="refreshError" class="module-alert" role="alert">{{ refreshError }}</p>
    <p v-if="error" class="module-alert" role="alert">{{ error }}</p>

    <section class="opportunity-filter-toolbar" aria-labelledby="radar-filter-heading">
      <div class="opportunity-filter-toolbar__heading">
        <div>
          <p class="app-page__eyebrow">Results from trusted connected sources</p>
          <h2 id="radar-filter-heading">Filter this view</h2>
        </div>
        <span>{{ filteredResults.length }} matching {{ filteredResults.length === 1 ? 'opportunity' : 'opportunities' }} in this personalised feed</span>
      </div>

      <div class="opportunity-filter-toolbar__controls">
        <label>
          <span>Source</span>
          <select v-model="selectedSource" :class="{ 'is-active': selectedSource !== 'all' }">
            <option value="all">All trusted sources</option>
            <option v-for="source in sourceFilters.slice(1)" :key="source.key" :value="source.key">{{ source.label }}</option>
          </select>
        </label>
        <label>
          <span>Category</span>
          <select v-model="selectedCategory" :class="{ 'is-active': selectedCategory }">
            <option value="">All categories</option>
            <option v-for="category in OPPORTUNITY_CATEGORIES" :key="category" :value="category">{{ OPPORTUNITY_CATEGORY_LABELS[category] || category }}</option>
          </select>
        </label>
        <label>
          <span>Mode</span>
          <select v-model="selectedMode" :class="{ 'is-active': selectedMode }">
            <option value="">All modes</option>
            <option v-for="mode in OPPORTUNITY_MODES" :key="mode" :value="mode">{{ mode === 'IN_PERSON' ? 'In person' : mode === 'UNKNOWN' ? 'Not specified' : mode.charAt(0) + mode.slice(1).toLowerCase() }}</option>
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select v-model="selectedSort" :class="{ 'is-active': selectedSort }">
            <option value="">Saved preference ({{ sortLabel }})</option>
            <option value="RECOMMENDED">Recommended</option>
            <option value="NEWEST">Newest</option>
            <option value="DEADLINE">Deadline</option>
            <option value="PORTFOLIO_VALUE">Portfolio value</option>
          </select>
        </label>
        <button
          type="button"
          class="opportunity-filter-toolbar__clear"
          :disabled="!hasActiveFilters"
          @click="clearFilters"
        >
          <UIcon name="i-lucide-x" aria-hidden="true" />
          Clear filters
        </button>
      </div>
    </section>

    <section aria-labelledby="opportunity-sections-heading">
      <div class="opportunity-section__heading">
        <div>
          <p>Explore</p>
          <h2 id="opportunity-sections-heading">Browse by opportunity type</h2>
          <span>Jump to a focused category when you already know what you need.</span>
        </div>
      </div>
      <div v-if="discoveryLoading && !discovery" class="opportunity-radar-grid" aria-label="Loading opportunity sections">
        <div v-for="item in 8" :key="item" class="app-skeleton opportunity-radar-card opportunity-radar-card--skeleton"><span /><span /><span /></div>
      </div>
      <div v-else class="opportunity-radar-grid">
        <NuxtLink v-for="section in sections" :key="section.slug" :to="`/app/opportunities/category/${section.slug}`" class="opportunity-radar-card">
          <span class="opportunity-radar-card__icon"><UIcon :name="section.icon" /></span>
          <div class="opportunity-radar-card__copy"><h3>{{ section.label }}</h3><p>{{ section.description }}</p></div>
          <div class="opportunity-radar-card__counts">
            <span><strong>{{ sectionStats.get(section.slug)?.activeCount || 0 }}</strong> active</span>
            <span v-if="sectionStats.get(section.slug)?.closingSoonCount"><strong>{{ sectionStats.get(section.slug).closingSoonCount }}</strong> closing soon</span>
          </div>
          <span class="opportunity-radar-card__link">Explore <UIcon name="i-lucide-arrow-right" /></span>
        </NuxtLink>
      </div>
    </section>

    <section class="opportunity-section opportunity-recommended" aria-labelledby="recommended-heading">
      <div class="opportunity-section__heading">
        <div>
          <p>Personalised</p>
          <h2 id="recommended-heading">Recommended for you</h2>
          <span>{{ preferenceSummary }} · Sorted by {{ sortLabel.toLowerCase() }}</span>
        </div>
        <strong class="opportunity-section__count">{{ filteredResults.length }}</strong>
      </div>

      <div v-if="visibleResults.length" class="opportunity-grid opportunity-grid--results">
        <OpportunitiesOpportunityCard v-for="item in visibleResults" :key="item.id" :opportunity="item" />
      </div>
      <div v-else class="opportunity-preview-empty" role="status">
        <span class="opportunity-preview-empty__icon"><UIcon name="i-lucide-radar" /></span>
        <div><strong>No opportunities match this view</strong><span>Your saved preferences are unchanged. Clear temporary filters to widen these results.</span></div>
        <UButton v-if="hasActiveFilters" color="neutral" variant="outline" @click="clearFilters">Clear filters</UButton>
      </div>

      <footer v-if="filteredResults.length" class="opportunity-load-more" aria-live="polite">
        <span>Showing {{ visibleResults.length }} of {{ filteredResults.length }} opportunities</span>
        <UButton v-if="hasMoreResults" color="neutral" variant="outline" @click="loadMore">Load 12 more</UButton>
      </footer>
    </section>

    <section class="opportunity-section opportunity-section--preview" aria-labelledby="closing-soon-heading">
      <div class="opportunity-section__heading">
        <div>
          <p>Time-sensitive view</p>
          <h2 id="closing-soon-heading">Closing soon</h2>
          <span>A separate deadline view; opportunities may also appear in recommendations.</span>
        </div>
        <strong class="opportunity-section__count">{{ filteredClosingSoon.length }}</strong>
      </div>
      <div v-if="filteredClosingSoon.length" class="opportunity-grid">
        <OpportunitiesOpportunityCard v-for="item in filteredClosingSoon" :key="item.id" :opportunity="item" />
      </div>
      <div v-else class="opportunity-preview-empty" role="status">
        <span class="opportunity-preview-empty__icon"><UIcon name="i-lucide-calendar-check" /></span>
        <div><strong>Nothing matching is closing soon</strong><span>{{ hasActiveFilters ? 'Temporary filters may be narrowing this preview.' : 'No deadlines fall inside your saved closing-soon window.' }}</span></div>
        <UButton v-if="hasActiveFilters" color="neutral" variant="ghost" @click="clearFilters">Reset view</UButton>
      </div>
    </section>

    <section class="opportunity-section opportunity-section--preview" aria-labelledby="new-opportunities-heading">
      <div class="opportunity-section__heading">
        <div><p>Recently discovered</p><h2 id="new-opportunities-heading">New opportunities</h2><span>A six-item preview of fresh additions to your feed.</span></div>
        <strong class="opportunity-section__count">{{ filteredNewest.length }}</strong>
      </div>
      <div v-if="filteredNewest.length" class="opportunity-grid">
        <OpportunitiesOpportunityCard v-for="item in filteredNewest" :key="item.id" :opportunity="item" />
      </div>
      <div v-else class="opportunity-preview-empty" role="status">
        <span class="opportunity-preview-empty__icon"><UIcon name="i-lucide-radar" /></span>
        <div><strong>No recent matches</strong><span>{{ hasActiveFilters ? 'Clear temporary filters to see more recent additions.' : 'New trusted-source listings will appear here.' }}</span></div>
      </div>
    </section>

    <section id="saved-opportunities" class="opportunity-section opportunity-section--preview" aria-labelledby="saved-opportunities-heading">
      <div class="opportunity-section__heading">
        <div><p>Your pipeline</p><h2 id="saved-opportunities-heading">Saved and applying</h2><span>Only opportunities you are actively tracking.</span></div>
        <strong class="opportunity-section__count">{{ filteredSaved.length }}</strong>
      </div>
      <div v-if="filteredSaved.length" class="opportunity-grid">
        <OpportunitiesOpportunityCard v-for="item in filteredSaved" :key="item.id" :opportunity="item" />
      </div>
      <div v-else class="opportunity-preview-empty opportunity-preview-empty--compact" role="status">
        <span class="opportunity-preview-empty__icon"><UIcon name="i-lucide-bookmark" /></span>
        <div><strong>No tracked matches</strong><span>Save or start applying to an opportunity to see it here.</span></div>
      </div>
    </section>
  </main>
</template>

<style src="~/assets/css/opportunity-discovery.css"></style>
