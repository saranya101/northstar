<script setup>
import { summarizeFocusSessions } from '#shared/focus/history'

definePageMeta({ layout: 'app', middleware: ['auth', 'onboarded'] })
useSeoMeta({ title: 'Today · Northstar', description: 'Your daily academic command centre.' })
const { user } = useCurrentSession()
const { data, plannedBlocks, focusState, loading, error, load } = useToday()
const command = ref('')
const now = new Date()
const greeting = computed(() => `${now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'}${user.value?.name ? `, ${user.value.name.split(' ')[0]}` : ''}`)
const dateLabel = new Intl.DateTimeFormat('en-SG', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)
const time = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const focusMinutes = computed(() => Math.round(summarizeFocusSessions(focusState.value.sessions || [], now).todayFocusedSeconds / 60))
const recentFocus = computed(() => { const item = [...(focusState.value.sessions || [])].sort((a, b) => String(b.endedAt).localeCompare(String(a.endedAt)))[0]; return item ? { ...item, focusedSeconds: item.actualFocusedSeconds } : null })
const activeFocus = computed(() => focusState.value.activeTimer || null)
const classState = item => { const minutes = now.getHours() * 60 + now.getMinutes(); return minutes >= item.startMinutes && minutes < item.endMinutes ? 'Now' : minutes < item.startMinutes ? 'Next' : 'Completed' }
const preparationItems = item => [
  ['Material', item.preparation.materialStatus], ['Notes', item.preparation.notesStatus],
  ['Practice', item.preparation.practiceStatus], ['Required work', item.preparation.requiredWorkStatus]
]
const preparationMark = status => status === 'DONE' ? '✓' : status === 'NOT_REQUIRED' ? 'N/A' : status === 'IN_PROGRESS' ? '—' : '·'
const upcomingTime = value => new Intl.DateTimeFormat('en-SG', { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Singapore' }).format(new Date(`${value}+08:00`))
const openInbox = () => navigateTo({ path: '/app/inbox', query: command.value.trim() ? { text: command.value.trim() } : {} })
const actionRoute = (kind) => { const action = data.value?.recommendation; if (!action) return '/app/tasks'; if (kind === 'focus') return { path: '/app/focus', query: { taskId: action.kind === 'TASK' ? action.id : undefined, module: action.moduleCode, goal: action.title } }; if (kind === 'plan') return { path: '/app/planner', query: { taskId: action.id, title: action.title, estimatedMinutes: action.estimatedMinutes || 60 } }; return action.to }
watch(user, value => { if (value) void load() }, { immediate: true })
</script>

<template>
  <main class="app-page v2-page today-page">
    <header class="today-heading"><div><p>{{ dateLabel }}</p><h1>{{ greeting }}</h1></div><span>{{ data?.semester || 'Your academic day' }}</span></header>
    <form class="northstar-command" @submit.prevent="openInbox"><UIcon name="i-lucide-sparkles" /><input v-model="command" aria-label="Ask Northstar or paste an academic update" placeholder="Ask Northstar or paste an academic update…"><UButton type="submit" size="sm">Review text</UButton></form>
    <p v-if="error" class="module-alert" role="alert">{{ error }}</p><p v-if="loading && !data" role="status">Loading today’s academic state…</p>
    <template v-else-if="data">
      <section class="next-action" aria-labelledby="next-action-title"><div class="v2-section-heading"><div><p>Next action</p><h2 id="next-action-title">{{ data.recommendation?.title || 'Nothing urgent right now' }}</h2></div><UBadge v-if="data.recommendation" color="primary">{{ data.recommendation.moduleCode || 'General' }}</UBadge></div><p v-if="data.recommendation">{{ [data.recommendation.estimatedMinutes ? `${data.recommendation.estimatedMinutes} min` : null, data.recommendation.timingNote].filter(Boolean).join(' · ') || 'Open the source for details.' }}</p><p v-else>Your confirmed academic records do not contain an overdue or due-today action.</p><div class="v2-inline-actions"><UButton v-if="data.recommendation" :to="actionRoute('focus')" icon="i-lucide-timer">Start Focus</UButton><UButton v-if="data.recommendation" :to="actionRoute('plan')" color="neutral" variant="outline">Plan</UButton><UButton :to="data.recommendation ? actionRoute('open') : '/app/tasks?view=BACKLOG'" color="neutral" variant="ghost">{{ data.recommendation ? 'Open' : 'View backlog' }}</UButton></div></section>
      <section class="v2-panel upcoming-classes" aria-labelledby="upcoming-classes-title">
        <div class="v2-section-heading"><div><p>Next 72 hours</p><h2 id="upcoming-classes-title">Upcoming classes</h2></div><NuxtLink to="/app/timetable">Timetable</NuxtLink></div>
        <div v-if="data.upcomingClasses.length" class="upcoming-class-list">
          <article v-for="item in data.upcomingClasses" :key="item.id">
            <div class="upcoming-class-main"><strong>{{ item.moduleCode }}</strong><span>{{ item.moduleTitle }}</span><time>{{ upcomingTime(item.start) }} · {{ item.venue || 'Venue TBC' }}</time></div>
            <div class="preparation-facts"><span v-for="fact in preparationItems(item)" :key="fact[0]"><small>{{ fact[0] }}</small><b :class="`is-${fact[1].toLowerCase()}`">{{ preparationMark(fact[1]) }}</b></span></div>
            <div class="upcoming-class-action"><small>{{ item.preparation.readiness === 'READY' ? 'Ready' : 'Needs preparation' }}</small><UButton :to="item.preparationLink" size="xs" color="neutral" variant="outline">Prepare</UButton></div>
          </article>
        </div>
        <div v-else class="v2-empty"><strong>No confirmed classes in the next 72 hours.</strong><span>Only safely mapped timetable occurrences are shown.</span></div>
      </section>
      <div class="today-grid">
        <section class="v2-panel"><div class="v2-section-heading"><div><p>Schedule</p><h2>Today’s classes</h2></div><NuxtLink to="/app/timetable">Timetable</NuxtLink></div><div v-if="data.classes.length" class="v2-dense-list"><div v-for="item in data.classes" :key="item.id"><time>{{ time(item.startMinutes) }}</time><div><strong>{{ item.moduleCode }} · {{ item.classType.toLowerCase() }}</strong><span>{{ item.moduleTitle }}</span></div><small>{{ classState(item) }} · {{ item.venue || 'Venue TBC' }}</small></div></div><div v-else class="v2-empty"><strong>No classes found for today.</strong><span>Only confirmed timetable sessions are shown.</span></div></section>
        <section class="v2-panel"><div class="v2-section-heading"><div><p>Execution</p><h2>Tasks</h2></div><NuxtLink to="/app/tasks">All tasks</NuxtLink></div><div v-if="data.tasks.length" class="v2-dense-list"><NuxtLink v-for="item in data.tasks.slice(0,6)" :key="item.id" :to="`/app/tasks?view=ALL`"><span class="status-dot" :class="`is-${item.status.toLowerCase()}`" /><div><strong>{{ item.moduleCode || 'General' }} · {{ item.title }}</strong><span>{{ item.timingNote || (item.dueAt ? new Date(item.dueAt).toLocaleString() : 'Backlog') }}</span></div><small>{{ item.status.replaceAll('_',' ').toLowerCase() }}</small></NuxtLink></div><div v-else class="v2-empty"><strong>No open tasks.</strong><NuxtLink to="/app/tasks?create=1">Create a task</NuxtLink></div></section>
        <section class="v2-panel"><div class="v2-section-heading"><div><p>Coming up</p><h2>Assessments</h2></div><NuxtLink to="/app/calendar">Calendar</NuxtLink></div><div v-if="data.assessments.length" class="v2-dense-list"><NuxtLink v-for="item in data.assessments.slice(0,5)" :key="item.id" :to="`/app/assessments/${item.id}`"><div><strong>{{ item.moduleCode }} · {{ item.name }}</strong><span>{{ item.weight === null ? 'Weight not recorded' : `${item.weight}%` }}</span></div><time>{{ new Date(item.date).toLocaleDateString() }}</time></NuxtLink></div><div v-else class="v2-empty"><strong>No upcoming dated assessments.</strong><span>Week references remain undated until confirmed.</span></div></section>
        <section class="v2-panel"><div class="v2-section-heading"><div><p>Requirements</p><h2>Coursework</h2></div><NuxtLink to="/app/modules">Modules</NuxtLink></div><div v-if="data.coursework.length" class="v2-dense-list"><NuxtLink v-for="item in data.coursework.slice(0,5)" :key="item.id" :to="`/app/recurring-coursework/${item.requirementId}`"><div><strong>{{ item.moduleCode }} · {{ item.title }}</strong><span>{{ item.timingNote || 'No timing note' }}</span></div><small>{{ item.status.replaceAll('_',' ').toLowerCase() }}</small></NuxtLink></div><div v-else class="v2-empty"><strong>No coursework needs attention.</strong><span>Submitted, missed, and upcoming occurrences appear here.</span></div></section>
        <section class="v2-panel"><div class="v2-section-heading"><div><p>Local plan</p><h2>Today’s plan</h2></div><NuxtLink to="/app/planner">Planner</NuxtLink></div><div v-if="plannedBlocks.length" class="v2-dense-list"><div v-for="block in plannedBlocks" :key="block.id"><time>{{ time(block.startMinutes) }}</time><div><strong>{{ block.moduleCode || 'General' }} · {{ block.title }}</strong><span>{{ block.goal || 'Study block' }}</span></div><small>{{ block.status.toLowerCase() }}</small></div></div><div v-else class="v2-empty"><strong>No study blocks planned today.</strong><NuxtLink to="/app/planner">Plan study time</NuxtLink></div></section>
        <section class="v2-panel"><div class="v2-section-heading"><div><p>Local focus</p><h2>Focus</h2></div><NuxtLink to="/app/focus">Open timer</NuxtLink></div><dl class="v2-inline-stats"><div><dt>Focused today</dt><dd>{{ focusMinutes }} min</dd></div><div><dt>Active session</dt><dd>{{ activeFocus ? `${activeFocus.moduleCode || 'General'} · ${activeFocus.goal || 'Focus'}` : 'None' }}</dd></div><div><dt>Recent session</dt><dd>{{ recentFocus ? `${Math.round((recentFocus.focusedSeconds || 0)/60)} min` : 'None' }}</dd></div></dl><p class="v2-local-note"><UIcon name="i-lucide-hard-drive" /> Stored only in this browser.</p></section>
      </div>
    </template>
  </main>
</template>

<style scoped>
.upcoming-classes{margin-bottom:12px}.upcoming-class-list{display:grid}.upcoming-class-list article{display:grid;grid-template-columns:minmax(180px,1fr) minmax(300px,1.4fr) auto;align-items:center;gap:16px;min-height:76px;border-top:1px solid #ebe7df}.upcoming-class-list article:first-child{border-top:0}.upcoming-class-main{display:grid}.upcoming-class-main strong{font-size:.82rem}.upcoming-class-main span,.upcoming-class-main time,.upcoming-class-action small{color:var(--v2-muted);font-size:.7rem}.preparation-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.preparation-facts span{display:flex;align-items:center;justify-content:space-between;gap:4px}.preparation-facts small{color:var(--v2-muted);font-size:.68rem}.preparation-facts b{font-size:.72rem}.preparation-facts .is-done{color:var(--v2-success)}.preparation-facts .is-not_required{color:var(--v2-muted)}.upcoming-class-action{display:grid;justify-items:end;gap:5px}@media(max-width:760px){.upcoming-class-list article{grid-template-columns:1fr}.upcoming-class-action{grid-auto-flow:column;align-items:center;justify-content:space-between;justify-items:start;padding-bottom:10px}}@media(max-width:480px){.preparation-facts{grid-template-columns:repeat(2,1fr)}}
</style>
