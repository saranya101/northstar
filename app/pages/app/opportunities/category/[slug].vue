<script setup>
import { OPPORTUNITY_MODES, USER_OPPORTUNITY_STATUSES } from '~~/shared/schemas/opportunities'
import { getOpportunitySection } from '~~/shared/opportunities/taxonomy'
import { OPPORTUNITY_STATUS_LABELS } from '~~/shared/utils/opportunities'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })

const route = useRoute()
const router = useRouter()
const section = computed(() => getOpportunitySection(String(route.params.slug || '')))

if (!section.value) {
  throw createError({ statusCode: 404, statusMessage: 'Opportunity section not found.' })
}

useSeoMeta({
  title: () => `${section.value.label} · Northstar`,
  description: () => section.value.description
})

const { state, loading, error, load } = useOpportunities()
const { user } = useCurrentSession()
const filters = reactive({
  search: '',
  tag: '',
  status: '',
  mode: '',
  closingSoon: false,
  sort: 'deadline',
  page: 1,
  pageSize: 20
})

const validValue = (value, allowed, fallback = '') => allowed.includes(value) ? value : fallback

function routeFilters(query) {
  return {
    search: typeof query.search === 'string' ? query.search.slice(0, 120) : '',
    tag: validValue(query.tag, section.value.subcategories),
    status: validValue(query.status, USER_OPPORTUNITY_STATUSES),
    mode: validValue(query.mode, OPPORTUNITY_MODES),
    closingSoon: query.closingSoon === 'true',
    sort: validValue(query.sort, ['deadline', 'newest', 'title'], 'deadline'),
    page: Math.max(1, Number.parseInt(query.page, 10) || 1),
    pageSize: validValue(Number(query.pageSize), [10, 20, 50], 20)
  }
}

function filterQuery(values = filters) {
  return Object.fromEntries(Object.entries({
    search: values.search || undefined,
    tag: values.tag || undefined,
    status: values.status || undefined,
    mode: values.mode || undefined,
    closingSoon: values.closingSoon ? 'true' : undefined,
    sort: values.sort === 'deadline' ? undefined : values.sort,
    page: values.page > 1 ? String(values.page) : undefined,
    pageSize: values.pageSize === 20 ? undefined : String(values.pageSize)
  }).filter(([, value]) => value !== undefined))
}

function apiQuery() {
  return {
    ...filterQuery(filters),
    categories: section.value.categories.join(','),
    page: filters.page,
    pageSize: filters.pageSize
  }
}

let syncingRoute = false
let timer

function refresh() {
  return load(apiQuery())
}

let activeSlug = ''

watch([() => route.params.slug, () => route.query, user], async ([slug, query, currentUser]) => {
  if (!section.value) {
    showError({ statusCode: 404, statusMessage: 'Opportunity section not found.' })
    return
  }

  if (activeSlug && activeSlug !== slug) state.value = null
  activeSlug = String(slug || '')

  syncingRoute = true
  Object.assign(filters, routeFilters(query))
  await nextTick()
  syncingRoute = false

  if (currentUser) void refresh()
}, { immediate: true })

const filterSignature = computed(() => JSON.stringify({
  search: filters.search,
  tag: filters.tag,
  status: filters.status,
  mode: filters.mode,
  closingSoon: filters.closingSoon,
  sort: filters.sort,
  pageSize: filters.pageSize
}))

watch(filterSignature, () => {
  if (syncingRoute) return
  filters.page = 1
  clearTimeout(timer)
  timer = setTimeout(() => router.replace({ query: filterQuery(filters) }), 250)
})

function selectTag(tag) {
  filters.tag = filters.tag === tag ? '' : tag
}

function goToPage(page) {
  if (page < 1 || page > (state.value?.pageCount || 1) || page === filters.page) return
  void router.push({ query: filterQuery({ ...filters, page }) })
}
</script>

<template>
  <main class="app-page opportunities-page opportunity-category-page">
    <NuxtLink to="/app/opportunities" class="opportunity-category-back">
      <UIcon name="i-lucide-arrow-left" />
      Opportunity Radar
    </NuxtLink>

    <header class="opportunity-category-header">
      <span class="opportunity-category-header__icon"><UIcon :name="section.icon" /></span>
      <div>
        <p class="app-page__eyebrow">Opportunity category</p>
        <h1>{{ section.label }}</h1>
        <span>{{ section.description }}</span>
      </div>
      <UButton to="/app/opportunities/new" icon="i-lucide-plus">Add opportunity</UButton>
    </header>

    <section class="opportunity-subcategory-panel" aria-labelledby="subcategory-heading">
      <div>
        <p class="app-page__eyebrow">Subcategories</p>
        <h2 id="subcategory-heading">Narrow the feed</h2>
      </div>
      <div class="opportunity-subcategories">
        <button type="button" class="opportunity-chip" :class="{ 'opportunity-chip--active': !filters.tag }" @click="selectTag('')">All</button>
        <button
          v-for="tag in section.subcategories"
          :key="tag"
          type="button"
          class="opportunity-chip"
          :class="{ 'opportunity-chip--active': filters.tag === tag }"
          @click="selectTag(tag)"
        >
          {{ tag }}
        </button>
      </div>
    </section>

    <section class="opportunity-filters" aria-label="Filter opportunities">
      <label class="opportunity-search">
        <span>Search</span>
        <UInput v-model="filters.search" icon="i-lucide-search" placeholder="Title or organisation" />
      </label>
      <label>
        <span>Status</span>
        <select v-model="filters.status">
          <option value="">All statuses</option>
          <option v-for="status in USER_OPPORTUNITY_STATUSES" :key="status" :value="status">{{ OPPORTUNITY_STATUS_LABELS[status] }}</option>
        </select>
      </label>
      <label>
        <span>Mode</span>
        <select v-model="filters.mode">
          <option value="">All modes</option>
          <option value="ONLINE">Online</option>
          <option value="IN_PERSON">In person</option>
          <option value="HYBRID">Hybrid</option>
          <option value="UNKNOWN">Unknown</option>
        </select>
      </label>
      <label>
        <span>Sort</span>
        <select v-model="filters.sort">
          <option value="deadline">Deadline</option>
          <option value="newest">Newest</option>
          <option value="title">Title</option>
        </select>
      </label>
      <label>
        <span>Page size</span>
        <select v-model.number="filters.pageSize">
          <option :value="10">10 per page</option>
          <option :value="20">20 per page</option>
          <option :value="50">50 per page</option>
        </select>
      </label>
      <label class="opportunity-filter-check">
        <input v-model="filters.closingSoon" type="checkbox">
        <span>Closing soon only</span>
      </label>
    </section>

    <div class="opportunity-category-results">
      <p><strong>{{ state?.total || 0 }}</strong> result{{ state?.total === 1 ? '' : 's' }}</p>
      <span v-if="filters.tag">Filtered by {{ filters.tag }}</span>
    </div>

    <p v-if="error" class="module-alert" role="alert">{{ error }}</p>

    <div v-if="loading && !state" class="opportunity-grid" aria-label="Loading opportunities">
      <div v-for="item in 6" :key="item" class="app-skeleton opportunity-card-skeleton"><span /><span /><span /></div>
    </div>

    <section v-else-if="!state?.items.length" class="module-empty">
      <span class="module-empty__icon"><UIcon :name="section.icon" /></span>
      <p>No matches found</p>
      <h2>Nothing in this section yet</h2>
      <span>Try another filter or add an opportunity you found yourself.</span>
      <UButton to="/app/opportunities/new">Add opportunity</UButton>
    </section>

    <div v-else class="opportunity-grid">
      <OpportunitiesOpportunityCard v-for="item in state.items" :key="item.id" :opportunity="item" />
    </div>

    <nav v-if="state?.total" class="opportunity-pagination" aria-label="Opportunity pages">
      <p>
        Page <strong>{{ state.page }}</strong> of <strong>{{ Math.max(state.pageCount, 1) }}</strong>
        <span>{{ state.total }} total result{{ state.total === 1 ? '' : 's' }}</span>
      </p>
      <div>
        <UButton color="neutral" variant="outline" icon="i-lucide-chevron-left" :disabled="state.page <= 1 || loading" @click="goToPage(state.page - 1)">Previous</UButton>
        <UButton color="neutral" variant="outline" trailing-icon="i-lucide-chevron-right" :disabled="state.page >= state.pageCount || loading" @click="goToPage(state.page + 1)">Next</UButton>
      </div>
    </nav>
  </main>
</template>

<style src="~/assets/css/opportunity-discovery.css"></style>
