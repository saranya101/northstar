<script setup>
import { OPPORTUNITY_CATEGORIES, USER_OPPORTUNITY_STATUSES } from '~~/shared/schemas/opportunities'
import { OPPORTUNITY_CATEGORY_LABELS, OPPORTUNITY_STATUS_LABELS, calendarDayDifference } from '~~/shared/utils/opportunities'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Opportunity Inbox · Northstar', description: 'Capture and track opportunities in one place.' })
const { state, loading, error, load } = useOpportunities()
const { user } = useCurrentSession()
const route = useRoute()
const router = useRouter()
const filters = reactive({ search: '', category: '', status: '', closingSoon: false, sort: 'deadline', page: 1, pageSize: 20 })
const validValue = (value, allowed, fallback = '') => allowed.includes(value) ? value : fallback
function routeFilters(query) {
  return {
    search: typeof query.search === 'string' ? query.search.slice(0, 120) : '',
    category: validValue(query.category, OPPORTUNITY_CATEGORIES), status: validValue(query.status, USER_OPPORTUNITY_STATUSES),
    closingSoon: query.closingSoon === 'true', sort: validValue(query.sort, ['deadline', 'newest', 'title'], 'deadline'),
    page: Math.max(1, Number.parseInt(query.page, 10) || 1), pageSize: validValue(Number(query.pageSize), [10, 20, 50], 20)
  }
}
function filterQuery(values = filters) {
  return Object.fromEntries(Object.entries({ search: values.search || undefined, category: values.category || undefined, status: values.status || undefined, closingSoon: values.closingSoon ? 'true' : undefined, sort: values.sort === 'deadline' ? undefined : values.sort, page: values.page > 1 ? String(values.page) : undefined, pageSize: values.pageSize === 20 ? undefined : String(values.pageSize) }).filter(([, value]) => value !== undefined))
}
let syncingRoute = false
let timer
function refresh() { return load({ ...filterQuery(filters), page: filters.page, pageSize: filters.pageSize }) }
watch(() => route.query, async query => {
  syncingRoute = true
  Object.assign(filters, routeFilters(query))
  await nextTick()
  syncingRoute = false
  if (user.value) void refresh()
}, { immediate: true })
const filterSignature = computed(() => JSON.stringify({ search: filters.search, category: filters.category, status: filters.status, closingSoon: filters.closingSoon, sort: filters.sort, pageSize: filters.pageSize }))
watch(filterSignature, () => {
  if (syncingRoute) return
  filters.page = 1
  clearTimeout(timer)
  timer = setTimeout(() => router.replace({ query: filterQuery(filters) }), 250)
})
watch(user, current => { if (current) void refresh() }, { immediate: true })
function goToPage(page) { if (page < 1 || page > (state.value?.pageCount || 1) || page === filters.page) return; void router.push({ query: filterQuery({ ...filters, page }) }) }
const closingSoon = computed(() => state.value?.items.filter(item => item.deadline && calendarDayDifference(item.deadline) >= 0 && calendarDayDifference(item.deadline) <= 7) || [])
const closingIds = computed(() => new Set(closingSoon.value.map(item => item.id)))
const upcoming = computed(() => state.value?.items.filter(item => !closingIds.value.has(item.id) && item.startAt && new Date(item.startAt) > new Date()) || [])
const featuredIds = computed(() => new Set([...closingIds.value, ...upcoming.value.map(item => item.id)]))
const tracked = computed(() => state.value?.items.filter(item => !featuredIds.value.has(item.id)) || [])
</script>

<template>
  <main class="app-page opportunities-page">
    <header class="app-page__header"><div><p class="app-page__eyebrow">Opportunity Inbox</p><h1>Keep useful opportunities moving</h1><span>Capture internships, programmes, events and projects, then track what happens next.</span></div><UButton to="/app/opportunities/new" icon="i-lucide-plus" size="lg">Add opportunity</UButton></header>
    <section class="opportunity-summary" aria-label="Opportunity summary"><div><strong>{{ state?.total || 0 }}</strong><span>tracked</span></div><div><strong>{{ state?.summary.closingSoonCount || 0 }}</strong><span>closing soon</span></div><div><strong>{{ state?.summary.applicationsInProgress || 0 }}</strong><span>in progress</span></div></section>
    <section class="opportunity-filters" aria-label="Filter opportunities">
      <label class="opportunity-search"><span>Search</span><UInput v-model="filters.search" icon="i-lucide-search" placeholder="Title or organisation" /></label>
      <label><span>Category</span><select v-model="filters.category"><option value="">All categories</option><option v-for="category in OPPORTUNITY_CATEGORIES" :key="category" :value="category">{{ OPPORTUNITY_CATEGORY_LABELS[category] }}</option></select></label>
      <label><span>Status</span><select v-model="filters.status"><option value="">All statuses</option><option v-for="status in USER_OPPORTUNITY_STATUSES" :key="status" :value="status">{{ OPPORTUNITY_STATUS_LABELS[status] }}</option></select></label>
      <label><span>Sort</span><select v-model="filters.sort"><option value="deadline">Deadline</option><option value="newest">Newest</option><option value="title">Title</option></select></label>
      <label><span>Page size</span><select v-model.number="filters.pageSize"><option :value="10">10 per page</option><option :value="20">20 per page</option><option :value="50">50 per page</option></select></label>
      <label class="opportunity-filter-check"><input v-model="filters.closingSoon" type="checkbox"><span>Closing soon only</span></label>
    </section>
    <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
    <div v-if="loading && !state" class="opportunity-grid" aria-label="Loading opportunities"><div v-for="item in 6" :key="item" class="app-skeleton opportunity-card-skeleton"><span /><span /><span /></div></div>
    <section v-else-if="!state?.items.length" class="module-empty"><span class="module-empty__icon"><UIcon name="i-lucide-inbox" /></span><p>Nothing here yet</p><h2>Build your Opportunity Inbox</h2><span>Add an opportunity manually or paste an announcement for deterministic extraction.</span><UButton to="/app/opportunities/new">Add your first opportunity</UButton></section>
    <template v-else>
      <section v-if="closingSoon.length" class="opportunity-section"><div class="opportunity-section__heading"><div><p>Time-sensitive</p><h2>Closing soon</h2></div><span>{{ closingSoon.length }}</span></div><div class="opportunity-grid"><OpportunitiesOpportunityCard v-for="item in closingSoon" :key="item.id" :opportunity="item" /></div></section>
      <section v-if="upcoming.length" class="opportunity-section"><div class="opportunity-section__heading"><div><p>On the horizon</p><h2>Upcoming</h2></div><span>{{ upcoming.length }}</span></div><div class="opportunity-grid"><OpportunitiesOpportunityCard v-for="item in upcoming" :key="item.id" :opportunity="item" /></div></section>
      <section v-if="tracked.length" class="opportunity-section"><div class="opportunity-section__heading"><div><p>Your pipeline</p><h2>Saved and applying</h2></div><span>{{ tracked.length }}</span></div><div class="opportunity-grid"><OpportunitiesOpportunityCard v-for="item in tracked" :key="item.id" :opportunity="item" /></div></section>
    </template>
    <nav v-if="state?.total" class="opportunity-pagination" aria-label="Opportunity pages"><p>Page <strong>{{ state.page }}</strong> of <strong>{{ Math.max(state.pageCount, 1) }}</strong><span>{{ state.total }} total result{{ state.total === 1 ? '' : 's' }}</span></p><div><UButton color="neutral" variant="outline" icon="i-lucide-chevron-left" :disabled="state.page <= 1 || loading" @click="goToPage(state.page - 1)">Previous</UButton><UButton color="neutral" variant="outline" trailing-icon="i-lucide-chevron-right" :disabled="state.page >= state.pageCount || loading" @click="goToPage(state.page + 1)">Next</UButton></div></nav>
  </main>
</template>
