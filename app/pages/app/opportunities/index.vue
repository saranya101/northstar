<script setup>
import { getOpportunitySections } from '~~/shared/opportunities/taxonomy'
import {
  filterOpportunitiesBySource,
  opportunityMatchesSource,
  opportunitySourcePresentation,
} from '~/utils/opportunity-presentation'
import {
  opportunityCadenceMs,
} from '~/utils/opportunity-cadence'

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
const clock = ref(Date.now())
let cadenceTimer = null
let clockTimer = null

const sectionStats = computed(() => new Map(
  (discovery.value?.sections || [])
    .map(section => [section.slug, section]),
))

const allDiscoveryItems = computed(() => [
  ...(discovery.value?.results || []),
  ...(discovery.value?.closingSoon || []),
  ...(discovery.value?.newest || []),
  ...(discovery.value?.saved || []),
])

const sourceFilters = computed(() => [
  {
    key: 'all',
    label: 'All trusted sources',
    icon: 'i-lucide-layers-3',
  },
  ...(discovery.value?.availableSources || []).map(source => ({
    key: source.key,
    label: source.name,
    icon: opportunitySourcePresentation(source.name).icon,
  })),
])

const uniqueDiscoveryItems = computed(() => {
  const seen = new Set()

  return allDiscoveryItems.value.filter(item => {
    if (!item?.id || seen.has(item.id)) {
      return false
    }

    seen.add(item.id)
    return true
  })
})

function sourceCount(sourceKey) {
  return uniqueDiscoveryItems.value
    .filter(item =>
      opportunityMatchesSource(item, sourceKey),
    )
    .length
}

const filteredClosingSoon = computed(() =>
  filterOpportunitiesBySource(
    discovery.value?.closingSoon,
    selectedSource.value,
  ),
)

const filteredNewest = computed(() =>
  filterOpportunitiesBySource(
    discovery.value?.newest,
    selectedSource.value,
  ),
)

const filteredSaved = computed(() =>
  filterOpportunitiesBySource(
    discovery.value?.saved,
    selectedSource.value,
  ),
)

const filteredResults = computed(() =>
  filterOpportunitiesBySource(
    discovery.value?.results,
    selectedSource.value,
  ),
)

const selectedSourceLabel = computed(() =>
  sourceFilters.value.find(
    source => source.key === selectedSource.value,
  )?.label || 'All sources',
)

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

const emptySourceLabel = computed(() =>
  selectedSource.value === 'all'
    ? 'any source'
    : selectedSourceLabel.value,
)

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
    <header class="app-page__header">
      <div>
        <p class="app-page__eyebrow">Opportunity Radar</p>
        <h1>Find what is worth pursuing</h1>
        <span>
          Discover internships, competitions, volunteering,
          leadership roles and programmes in one place.
        </span>
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
        <UButton
          to="/app/opportunities#saved-opportunities"
          color="neutral"
          variant="outline"
        >
          View saved
        </UButton>

        <UButton
          to="/app/opportunities/new"
          icon="i-lucide-plus"
          size="lg"
        >
          Add opportunity
        </UButton>
      </div>
    </header>

    <div class="opportunity-refresh-status" aria-live="polite">
      <span>
        Last source refresh:
        {{ formatRefreshTime(discovery?.lastGlobalSourceRefreshAt) }}
      </span>
      <span v-if="discovery?.lastManualRefreshAt">
        Your last refresh:
        {{ formatRefreshTime(discovery.lastManualRefreshAt) }}
      </span>
      <span v-if="coolingDown">
        Refresh available {{ formatRefreshTime(nextAllowedAt) }}
      </span>
      <span v-else-if="discovery?.appliedPreferences?.feedRefreshCadence === 'MANUAL'">
        Automatic feed checks are off
      </span>
    </div>

    <p v-if="refreshError" class="module-alert" role="alert">{{ refreshError }}</p>

    <p
      v-if="error"
      class="module-alert"
      role="alert"
    >
      {{ error }}
    </p>

    <section
      class="opportunity-source-filter"
      aria-labelledby="source-filter-heading"
    >
      <div class="opportunity-source-filter__intro">
        <p class="app-page__eyebrow">Trusted feeds</p>
        <h2 id="source-filter-heading">
          Choose a discovery source
        </h2>
        <span>
          Results from Devpost, Volunteer.gov.sg, NTU Events and future connected sources.
          Counts show unique opportunities currently displayed.
          This filter does not request another scan.
        </span>
      </div>

      <div
        class="opportunity-source-filter__controls"
        role="group"
        aria-label="Filter discovery by source"
      >
        <button
          v-for="source in sourceFilters"
          :key="source.key"
          type="button"
          class="opportunity-source-filter__button"
          :class="{
            'opportunity-source-filter__button--active':
              selectedSource === source.key,
          }"
          :aria-pressed="selectedSource === source.key"
          @click="selectedSource = source.key"
        >
          <UIcon
            :name="source.icon"
            aria-hidden="true"
          />

          <span>{{ source.label }}</span>

          <strong>{{ sourceCount(source.key) }}</strong>
        </button>
      </div>
    </section>

    <section class="opportunity-section" aria-labelledby="personalised-results-heading">
      <div class="opportunity-section__heading">
        <div>
          <p>Personalised</p>
          <h2 id="personalised-results-heading">For your portfolio</h2>
          <span>Ordered using your saved {{ discovery?.appliedPreferences?.defaultSort?.toLowerCase().replaceAll('_', ' ') || 'recommended' }} preference.</span>
        </div>
        <strong class="opportunity-section__count">{{ filteredResults.length }}</strong>
      </div>
      <div v-if="filteredResults.length" class="opportunity-grid opportunity-grid--results">
        <OpportunitiesOpportunityCard v-for="item in filteredResults" :key="item.id" :opportunity="item" />
      </div>
      <div v-else class="opportunity-preview-empty">
        <span class="opportunity-preview-empty__icon"><UIcon name="i-lucide-radar" /></span>
        <div><strong>No matching opportunities yet</strong><span>Adjust your Opportunity Radar settings or choose all trusted sources.</span></div>
      </div>
    </section>

    <section aria-labelledby="opportunity-sections-heading">
      <div class="opportunity-section__heading">
        <div>
          <p>Explore</p>
          <h2 id="opportunity-sections-heading">
            Browse by opportunity type
          </h2>
          <span>
            Move between career, community, competition
            and learning opportunities.
          </span>
        </div>
      </div>

      <div
        v-if="discoveryLoading && !discovery"
        class="opportunity-radar-grid"
        aria-label="Loading opportunity sections"
      >
        <div
          v-for="item in 8"
          :key="item"
          class="app-skeleton opportunity-radar-card opportunity-radar-card--skeleton"
        >
          <span />
          <span />
          <span />
        </div>
      </div>

      <div
        v-else
        class="opportunity-radar-grid"
      >
        <NuxtLink
          v-for="section in sections"
          :key="section.slug"
          :to="`/app/opportunities/category/${section.slug}`"
          class="opportunity-radar-card"
        >
          <span class="opportunity-radar-card__icon">
            <UIcon :name="section.icon" />
          </span>

          <div class="opportunity-radar-card__copy">
            <h3>{{ section.label }}</h3>
            <p>{{ section.description }}</p>
          </div>

          <div class="opportunity-radar-card__counts">
            <span>
              <strong>
                {{ sectionStats.get(section.slug)?.activeCount || 0 }}
              </strong>
              active
            </span>

            <span
              v-if="
                sectionStats.get(section.slug)?.closingSoonCount
              "
            >
              <strong>
                {{
                  sectionStats.get(section.slug)
                    .closingSoonCount
                }}
              </strong>
              closing soon
            </span>
          </div>

          <span class="opportunity-radar-card__link">
            Explore
            <UIcon name="i-lucide-arrow-right" />
          </span>
        </NuxtLink>
      </div>
    </section>

    <section
      class="opportunity-section"
      aria-labelledby="closing-soon-heading"
    >
      <div class="opportunity-section__heading">
        <div>
          <p>Time-sensitive</p>
          <h2 id="closing-soon-heading">Closing soon</h2>
          <span>
            Application deadlines within the next
            {{ discovery?.appliedPreferences?.closingSoonDays || 7 }} days.
          </span>
        </div>

        <strong class="opportunity-section__count">
          {{ filteredClosingSoon.length }}
        </strong>
      </div>

      <div
        v-if="filteredClosingSoon.length"
        class="opportunity-grid"
      >
        <OpportunitiesOpportunityCard
          v-for="item in filteredClosingSoon"
          :key="item.id"
          :opportunity="item"
        />
      </div>

      <div
        v-else
        class="opportunity-preview-empty"
      >
        <span class="opportunity-preview-empty__icon">
          <UIcon name="i-lucide-calendar-check" />
        </span>

        <div>
          <strong>
            No opportunities from
            {{ emptySourceLabel }} are closing soon
          </strong>

          <span>
            Switch sources or check recently discovered
            opportunities for something new.
          </span>
        </div>
      </div>
    </section>

    <section
      class="opportunity-section"
      aria-labelledby="new-opportunities-heading"
    >
      <div class="opportunity-section__heading">
        <div>
          <p>Recently discovered</p>
          <h2 id="new-opportunities-heading">
            New opportunities
          </h2>
          <span>
            Fresh additions from public feeds and your own links.
          </span>
        </div>

        <strong class="opportunity-section__count">
          {{ filteredNewest.length }}
        </strong>
      </div>

      <div
        v-if="filteredNewest.length"
        class="opportunity-grid"
      >
        <OpportunitiesOpportunityCard
          v-for="item in filteredNewest"
          :key="item.id"
          :opportunity="item"
        />
      </div>

      <div
        v-else
        class="opportunity-preview-empty"
      >
        <span class="opportunity-preview-empty__icon">
          <UIcon name="i-lucide-radar" />
        </span>

        <div>
          <strong>
            No recent opportunities from
            {{ emptySourceLabel }}
          </strong>

          <span>
            Public opportunities will appear here after
            a successful source scan.
          </span>
        </div>
      </div>
    </section>

    <section
      id="saved-opportunities"
      class="opportunity-section"
      aria-labelledby="saved-opportunities-heading"
    >
      <div class="opportunity-section__heading">
        <div>
          <p>Your pipeline</p>
          <h2 id="saved-opportunities-heading">
            Saved and applying
          </h2>
          <span>
            Track opportunities from first interest
            through submission.
          </span>
        </div>

        <strong class="opportunity-section__count">
          {{ filteredSaved.length }}
        </strong>
      </div>

      <div
        v-if="filteredSaved.length"
        class="opportunity-grid"
      >
        <OpportunitiesOpportunityCard
          v-for="item in filteredSaved"
          :key="item.id"
          :opportunity="item"
        />
      </div>

      <div
        v-else
        class="opportunity-preview-empty"
      >
        <span class="opportunity-preview-empty__icon">
          <UIcon name="i-lucide-bookmark" />
        </span>

        <div>
          <strong>
            No saved opportunities from
            {{ emptySourceLabel }}
          </strong>

          <span>
            Open an opportunity to start tracking
            your application status.
          </span>
        </div>

        <UButton
          to="/app/opportunities/new"
          color="neutral"
          variant="outline"
        >
          Add opportunity
        </UButton>
      </div>
    </section>
  </main>
</template>

<style src="~/assets/css/opportunity-discovery.css"></style>
