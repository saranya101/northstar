<script setup>
import { getOpportunitySections } from '~~/shared/opportunities/taxonomy'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({
  title: 'Opportunity Radar · Northstar',
  description: 'Discover internships, competitions, volunteering and programmes worth pursuing.'
})

const { discovery, discoveryLoading, error, loadDiscovery } = useOpportunities()
const { user } = useCurrentSession()
const sections = getOpportunitySections()

const sectionStats = computed(() => new Map(
  (discovery.value?.sections || []).map(section => [section.slug, section])
))

watch(user, current => {
  if (current) void loadDiscovery(true)
}, { immediate: true })
</script>

<template>
  <main class="app-page opportunities-page opportunity-radar-page">
    <header class="app-page__header">
      <div>
        <p class="app-page__eyebrow">Opportunity Radar</p>
        <h1>Find what is worth pursuing</h1>
        <span>Discover internships, competitions, volunteering, leadership roles and programmes in one place.</span>
      </div>
      <div class="opportunity-radar-actions">
        <UButton to="/app/opportunities#saved-opportunities" color="neutral" variant="outline">View saved</UButton>
        <UButton to="/app/opportunities/new" icon="i-lucide-plus" size="lg">Add opportunity</UButton>
      </div>
    </header>

    <p v-if="error" class="module-alert" role="alert">{{ error }}</p>

    <section aria-labelledby="opportunity-sections-heading">
      <div class="opportunity-section__heading">
        <div>
          <p>Explore</p>
          <h2 id="opportunity-sections-heading">Browse by opportunity type</h2>
        </div>
      </div>

      <div v-if="discoveryLoading && !discovery" class="opportunity-radar-grid" aria-label="Loading opportunity sections">
        <div v-for="item in 8" :key="item" class="app-skeleton opportunity-radar-card opportunity-radar-card--skeleton">
          <span /><span /><span />
        </div>
      </div>

      <div v-else class="opportunity-radar-grid">
        <NuxtLink
          v-for="section in sections"
          :key="section.slug"
          :to="`/app/opportunities/category/${section.slug}`"
          class="opportunity-radar-card"
        >
          <span class="opportunity-radar-card__icon"><UIcon :name="section.icon" /></span>
          <div class="opportunity-radar-card__copy">
            <h3>{{ section.label }}</h3>
            <p>{{ section.description }}</p>
          </div>
          <div class="opportunity-radar-card__counts">
            <span><strong>{{ sectionStats.get(section.slug)?.activeCount || 0 }}</strong> active</span>
            <span v-if="sectionStats.get(section.slug)?.closingSoonCount">
              <strong>{{ sectionStats.get(section.slug).closingSoonCount }}</strong> closing soon
            </span>
          </div>
          <span class="opportunity-radar-card__link">Explore <UIcon name="i-lucide-arrow-right" /></span>
        </NuxtLink>
      </div>
    </section>

    <section class="opportunity-section" aria-labelledby="closing-soon-heading">
      <div class="opportunity-section__heading">
        <div><p>Time-sensitive</p><h2 id="closing-soon-heading">Closing soon</h2></div>
      </div>
      <div v-if="discovery?.closingSoon?.length" class="opportunity-grid">
        <OpportunitiesOpportunityCard v-for="item in discovery.closingSoon" :key="item.id" :opportunity="item" />
      </div>
      <div v-else class="opportunity-preview-empty">
        <UIcon name="i-lucide-calendar-check" />
        <span>No active opportunities are closing within the next seven days.</span>
      </div>
    </section>

    <section class="opportunity-section" aria-labelledby="new-opportunities-heading">
      <div class="opportunity-section__heading">
        <div><p>Recently discovered</p><h2 id="new-opportunities-heading">New opportunities</h2></div>
      </div>
      <div v-if="discovery?.newest?.length" class="opportunity-grid">
        <OpportunitiesOpportunityCard v-for="item in discovery.newest" :key="item.id" :opportunity="item" />
      </div>
      <div v-else class="opportunity-preview-empty">
        <UIcon name="i-lucide-radar" />
        <span>New public opportunities will appear here after source scans.</span>
      </div>
    </section>

    <section id="saved-opportunities" class="opportunity-section" aria-labelledby="saved-opportunities-heading">
      <div class="opportunity-section__heading">
        <div><p>Your pipeline</p><h2 id="saved-opportunities-heading">Saved and applying</h2></div>
      </div>
      <div v-if="discovery?.saved?.length" class="opportunity-grid">
        <OpportunitiesOpportunityCard v-for="item in discovery.saved" :key="item.id" :opportunity="item" />
      </div>
      <div v-else class="opportunity-preview-empty">
        <UIcon name="i-lucide-bookmark" />
        <span>Save an opportunity to start building your application pipeline.</span>
      </div>
    </section>
  </main>
</template>

<style src="~/assets/css/opportunity-discovery.css"></style>
