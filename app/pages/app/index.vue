<script setup>
definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Academic overview · Northstar', description: 'Your active semester, assessment readiness and grade position.' })

const { user } = useCurrentSession()
const { state: overview, loading, error, load } = useAcademicOverview()

const hasModules = computed(() => Boolean(overview.value?.modules?.length))
const attentionItems = computed(() => overview.value?.attention || [])
const attentionPreviewLimit = 6
const attentionExpanded = ref(false)
const visibleAttentionItems = computed(() => attentionExpanded.value ? attentionItems.value : attentionItems.value.slice(0, attentionPreviewLimit))
const canToggleAttention = computed(() => attentionItems.value.length > attentionPreviewLimit)
const upcomingAssessments = computed(() => overview.value?.upcomingAssessments || [])
const modules = computed(() => overview.value?.modules || [])

const readiness = {
  READY: { label: 'Ready', color: 'success' },
  MISSING_DATES: { label: 'Missing dates', color: 'warning' },
  INCOMPLETE_ASSESSMENT_STRUCTURE: { label: 'Incomplete assessment structure', color: 'warning' },
  NO_ASSESSMENTS: { label: 'No assessments', color: 'neutral' }
}

const attentionIcons = {
  MISSING_DATE: 'i-lucide-calendar-x-2',
  MISSING_WEIGHT: 'i-lucide-scale',
  NO_ASSESSMENTS: 'i-lucide-clipboard-list',
  INCOMPLETE_ASSESSMENT_STRUCTURE: 'i-lucide-circle-alert',
  NO_TARGET_GRADE: 'i-lucide-goal',
  REVIEW_REQUIRED_IMPORT: 'i-lucide-file-search'
}

const typeLabel = value => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
const numberLabel = value => Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
const percentage = value => `${numberLabel(value)}%`
const targetGrade = module => module.targetGrade || 'Not set'
const requiredAverage = module => module.grade.requiredAverage === null ? 'Not calculable' : percentage(module.grade.requiredAverage)
const formatDateTime = value => new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Singapore' }).format(new Date(value))
function daysLabel(value) {
  if (value === 0) return 'Today'
  if (value === 1) return '1 day remaining'
  return `${value} days remaining`
}

async function refresh() { await load(true) }

watch(attentionItems, items => {
  if (items.length <= attentionPreviewLimit) attentionExpanded.value = false
})

watch(user, currentUser => {
  if (currentUser) void load(true)
}, { immediate: true })

onActivated(() => {
  if (user.value) void load(true)
})
</script>

<template>
  <main class="app-page academic-overview-page">
    <header class="app-page__header academic-overview-header">
      <div>
        <p class="app-page__eyebrow">Academic overview</p>
        <h1>Semester command centre</h1>
        <span>Your semester at a glance, built from confirmed academic records.</span>
      </div>
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" size="md" aria-label="Refresh academic overview" :loading="loading" @click="refresh">Refresh</UButton>
    </header>

    <div v-if="loading && !overview" class="academic-overview-skeleton" aria-label="Loading academic overview">
      <div class="app-skeleton academic-overview-skeleton__summary"><span v-for="item in 6" :key="item" /></div>
      <div class="app-skeleton academic-overview-skeleton__panel"><span v-for="item in 4" :key="item" /></div>
      <div class="app-skeleton academic-overview-skeleton__panel"><span v-for="item in 4" :key="item" /></div>
    </div>

    <section v-else-if="error && !overview" class="module-empty" aria-labelledby="overview-error-title">
      <span class="module-empty__icon"><UIcon name="i-lucide-triangle-alert" /></span>
      <p>Unable to load</p>
      <h2 id="overview-error-title">Academic overview unavailable</h2>
      <span>{{ error }}</span>
      <UButton icon="i-lucide-refresh-cw" :loading="loading" @click="refresh">Try again</UButton>
    </section>

    <template v-else-if="overview">
      <section class="academic-summary" aria-labelledby="semester-summary-title">
        <div class="academic-summary__semester">
          <div><p>Active semester</p><h2 id="semester-summary-title">{{ overview.activeSemester.label }}</h2></div>
          <NuxtLink to="/app/modules">Manage modules <UIcon name="i-lucide-arrow-right" /></NuxtLink>
        </div>
        <dl class="academic-summary__grid">
          <div><dt>Active modules</dt><dd>{{ overview.summary.activeModuleCount }}</dd></div>
          <div><dt>Academic units</dt><dd>{{ numberLabel(overview.summary.totalAcademicUnits) }}</dd></div>
          <div><dt>Confirmed assessments</dt><dd>{{ overview.summary.totalConfirmedAssessments }}</dd></div>
          <div><dt>Complete structures</dt><dd>{{ overview.summary.completeAssessmentStructureCount }}</dd></div>
          <div><dt>Missing information</dt><dd>{{ overview.summary.missingAssessmentInformationCount }}</dd></div>
        </dl>
      </section>

      <section v-if="!hasModules" class="module-empty academic-overview-empty" aria-labelledby="overview-empty-title">
        <span class="module-empty__icon"><UIcon name="i-lucide-book-open" /></span>
        <p>No active modules</p>
        <h2 id="overview-empty-title">Build your active semester</h2>
        <span>Import your timetable or add modules manually before Northstar can calculate assessment readiness.</span>
        <div class="academic-overview-empty__actions"><UButton to="/app/timetable/import">Import timetable</UButton><UButton to="/app/modules" color="neutral" variant="outline">Manage modules</UButton></div>
      </section>

      <template v-else>
        <section class="academic-panel academic-panel--attention overview-attention" aria-labelledby="needs-attention-title">
          <div class="academic-section-heading">
            <div><p>Action queue</p><h2 id="needs-attention-title">Needs attention</h2></div>
            <span class="academic-count-badge">{{ attentionItems.length }} item{{ attentionItems.length === 1 ? '' : 's' }}</span>
          </div>
          <div v-if="attentionItems.length" id="needs-attention-list" class="attention-list">
            <NuxtLink v-for="item in visibleAttentionItems" :key="item.id" :to="item.to" class="attention-item">
              <span class="attention-item__icon"><UIcon :name="attentionIcons[item.kind] || 'i-lucide-circle-alert'" /></span>
              <div><strong>{{ item.title }}</strong><p>{{ item.description }}</p></div>
              <UIcon name="i-lucide-chevron-right" />
            </NuxtLink>
          </div>
          <div v-if="canToggleAttention" class="attention-list__footer">
            <button type="button" aria-controls="needs-attention-list" :aria-expanded="attentionExpanded" @click="attentionExpanded = !attentionExpanded">
              {{ attentionExpanded ? 'Show fewer' : `Show all ${attentionItems.length}` }}
              <UIcon :name="attentionExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" />
            </button>
          </div>
          <div v-else-if="!attentionItems.length" class="academic-empty-state academic-empty-state--compact"><UIcon name="i-lucide-circle-check-big" /><div><strong>No academic records need attention</strong><p>All active modules have complete assessment structures, confirmed dates and target grades.</p></div></div>
        </section>

        <section class="academic-panel academic-panel--upcoming" aria-labelledby="upcoming-assessments-title">
          <div class="academic-section-heading">
            <div><p>Confirmed calendar dates only</p><h2 id="upcoming-assessments-title">Upcoming assessments</h2></div>
            <span>{{ upcomingAssessments.length }} upcoming</span>
          </div>
          <div v-if="upcomingAssessments.length" class="upcoming-assessment-list">
            <NuxtLink v-for="assessment in upcomingAssessments" :key="assessment.id" :to="assessment.to" class="upcoming-assessment-card">
              <div class="upcoming-assessment-card__main"><span>{{ assessment.moduleCode }}</span><strong>{{ assessment.name }}</strong><small>{{ typeLabel(assessment.type) }}</small></div>
              <div class="upcoming-assessment-card__date"><strong>{{ formatDateTime(assessment.date) }}</strong><small>{{ daysLabel(assessment.daysRemaining) }}</small></div>
              <UBadge color="neutral" variant="outline">{{ assessment.weight === null ? 'Weight TBA' : percentage(assessment.weight) }}</UBadge>
              <UIcon name="i-lucide-chevron-right" />
            </NuxtLink>
          </div>
          <div v-else class="academic-empty-state academic-empty-state--compact"><UIcon name="i-lucide-calendar-clock" /><div><strong>No confirmed assessment dates yet</strong><p>Your assessments may already be saved, but dates are still awaiting official confirmation. Teaching-week references are not converted into dates.</p></div></div>
        </section>

        <section class="academic-panel academic-panel--quiet academic-panel--grade" aria-labelledby="grade-position-title">
          <div class="academic-section-heading">
            <div><p>Deterministic calculations</p><h2 id="grade-position-title">Grade position</h2></div>
            <span>No predicted letter grades</span>
          </div>
          <div class="grade-position-grid">
            <NuxtLink v-for="module in modules" :key="module.enrolmentId" :to="`${module.to}#assessments`" class="grade-position-card">
              <div class="grade-position-card__heading"><div><span>{{ module.code }}</span><strong>{{ module.title }}</strong></div><UIcon name="i-lucide-chevron-right" /></div>
              <dl>
                <div><dt>Target grade</dt><dd>{{ targetGrade(module) }}</dd></div>
                <div><dt>Confirmed weight</dt><dd>{{ percentage(module.grade.confirmedWeight) }}</dd></div>
                <div><dt>Graded weight</dt><dd>{{ percentage(module.grade.gradedWeight) }}</dd></div>
                <div><dt>Current weighted score</dt><dd>{{ percentage(module.grade.currentWeightedScore) }}</dd></div>
                <div><dt>Remaining weight</dt><dd>{{ percentage(module.grade.remainingWeight) }}</dd></div>
                <div class="grade-position-card__required" :class="{ 'is-calculable': module.grade.requiredAverage !== null }"><dt>Required remaining average</dt><dd>{{ requiredAverage(module) }}</dd></div>
              </dl>
            </NuxtLink>
          </div>
        </section>

        <section class="academic-panel academic-panel--quiet academic-panel--readiness" aria-labelledby="module-readiness-title">
          <div class="academic-section-heading">
            <div><p>Active teaching load</p><h2 id="module-readiness-title">Module readiness</h2></div>
            <NuxtLink to="/app/modules">View all modules <UIcon name="i-lucide-arrow-right" /></NuxtLink>
          </div>
          <div class="module-readiness-grid">
            <article v-for="module in modules" :key="module.enrolmentId" class="module-readiness-card">
              <span class="module-readiness-card__colour" :class="`module-colour--${module.colour.toLowerCase()}`" aria-hidden="true" />
              <div class="module-readiness-card__body">
                <div class="module-readiness-card__heading"><div><span>{{ module.code }}</span><h3>{{ module.title }}</h3></div><UBadge :color="readiness[module.readiness].color" variant="soft">{{ readiness[module.readiness].label }}</UBadge></div>
                <dl>
                  <div><dt>Assessments</dt><dd>{{ module.assessmentCount }}</dd></div>
                  <div><dt>Confirmed weight</dt><dd>{{ percentage(module.confirmedWeight) }}</dd></div>
                  <div><dt>Known deadlines</dt><dd>{{ module.knownDeadlineCount }}</dd></div>
                  <div><dt>Sessions</dt><dd>{{ module.sessionCount }}</dd></div>
                  <div><dt>Target grade</dt><dd>{{ targetGrade(module) }}</dd></div>
                </dl>
                <NuxtLink :to="module.to" class="module-readiness-card__action">Open module <UIcon name="i-lucide-arrow-right" /></NuxtLink>
              </div>
            </article>
          </div>
        </section>
      </template>
    </template>
  </main>
</template>
