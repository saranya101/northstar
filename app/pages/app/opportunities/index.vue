<script setup>
import { getOpportunitySections } from '~~/shared/opportunities/taxonomy'
import {
  OPPORTUNITY_SOURCE_FILTERS,
  filterOpportunitiesBySource,
  opportunityMatchesSource,
} from '~/utils/opportunity-presentation'

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
  loadDiscovery,
} = useOpportunities()

const { user } = useCurrentSession()
const sections = getOpportunitySections()
const selectedSource = ref('all')

const sectionStats = computed(() => new Map(
  (discovery.value?.sections || [])
    .map(section => [section.slug, section]),
))

const allDiscoveryItems = computed(() => [
  ...(discovery.value?.closingSoon || []),
  ...(discovery.value?.newest || []),
  ...(discovery.value?.saved || []),
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

const selectedSourceLabel = computed(() =>
  OPPORTUNITY_SOURCE_FILTERS.find(
    source => source.key === selectedSource.value,
  )?.label || 'All sources',
)

const emptySourceLabel = computed(() =>
  selectedSource.value === 'all'
    ? 'any source'
    : selectedSourceLabel.value,
)

watch(
  user,
  current => {
    if (current) {
      void loadDiscovery(true)
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
          Filter the current radar without changing saved
          opportunities or requesting another scan.
        </span>
      </div>

      <div
        class="opportunity-source-filter__controls"
        role="group"
        aria-label="Filter discovery by source"
      >
        <button
          v-for="source in OPPORTUNITY_SOURCE_FILTERS"
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
            Application deadlines within the next seven days.
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
