<script setup>
import {
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_MODES,
} from '~~/shared/schemas/opportunities'
import {
  OPPORTUNITY_CLOSING_SOON_DAYS,
  OPPORTUNITY_DEFAULT_SORTS,
  OPPORTUNITY_FEED_CADENCES,
  OPPORTUNITY_PORTFOLIO_GOALS,
} from '~~/shared/schemas/opportunity-preferences'
import {
  OPPORTUNITY_CATEGORY_LABELS,
} from '~~/shared/utils/opportunities'

const emit = defineEmits(['saved'])
const {
  preferences,
  loading,
  saving,
  error,
  fieldErrors,
  defaults,
  load,
  save,
} = useOpportunityPreferences()

const form = reactive(defaults())
const skillsText = ref('')

const labels = {
  MANUAL: 'Manual',
  HOURLY: 'Hourly',
  EVERY_6_HOURS: 'Every 6 hours',
  EVERY_12_HOURS: 'Every 12 hours',
  DAILY: 'Daily',
  RECOMMENDED: 'Recommended',
  NEWEST: 'Newest',
  DEADLINE: 'Deadline',
  PORTFOLIO_VALUE: 'Portfolio value',
  IN_PERSON: 'In person',
  ONLINE: 'Online',
  HYBRID: 'Hybrid',
  UNKNOWN: 'Not specified',
  LEADERSHIP: 'Leadership',
  TECHNICAL_SKILLS: 'Technical skills',
  COMMUNITY_IMPACT: 'Community impact',
  BUSINESS_EXPERIENCE: 'Business experience',
  RESEARCH_EXPERIENCE: 'Research experience',
  ENTREPRENEURSHIP: 'Entrepreneurship',
  SCHOLARSHIP_EVIDENCE: 'Scholarship evidence',
  TRANSFER_APPLICATION_EVIDENCE: 'Transfer application evidence',
  NETWORKING: 'Networking',
  RESUME_BUILDING: 'Resume building',
}

function syncForm(value) {
  if (!value) return
  for (const key of Object.keys(defaults())) {
    form[key] = Array.isArray(value[key])
      ? [...value[key]]
      : value[key]
  }
  skillsText.value = (value.skillGoals || []).join(', ')
}

function toggle(key, value) {
  const values = form[key]
  const index = values.indexOf(value)
  if (index >= 0) values.splice(index, 1)
  else values.push(value)
}

function payload() {
  const {
    lastManualRefreshAt: _lastManualRefreshAt,
    ...editable
  } = form

  return {
    ...editable,
    skillGoals: skillsText.value
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
  }
}

async function submit() {
  const result = await save(payload())
  if (result) {
    syncForm(result)
    emit('saved')
  }
}

function reset() {
  syncForm(defaults())
}

onMounted(async () => syncForm(await load(true)))
</script>

<template>
  <section class="settings-card radar-settings" aria-labelledby="radar-settings-heading">
    <header>
      <p>Personal discovery</p>
      <h2 id="radar-settings-heading">Opportunity Radar</h2>
      <span>
        Refresh frequency controls how often this browser checks your personalised feed while the app is open.
        Public sources are synced globally; source choices filter your feed and do not disable collection.
        Manual disables automatic feed checks.
      </span>
    </header>

    <div v-if="loading && !preferences" class="app-skeleton radar-settings__loading"><span /><span /><span /></div>

    <form v-else class="radar-settings__form" @submit.prevent="submit">
      <div class="radar-settings__selects">
        <label><span>Feed refresh frequency</span><select v-model="form.feedRefreshCadence"><option v-for="value in OPPORTUNITY_FEED_CADENCES" :key="value" :value="value">{{ labels[value] }}</option></select></label>
        <label><span>Closing soon window</span><select v-model.number="form.closingSoonDays"><option v-for="value in OPPORTUNITY_CLOSING_SOON_DAYS" :key="value" :value="value">{{ value }} days</option></select></label>
        <label><span>Default sort</span><select v-model="form.defaultSort"><option v-for="value in OPPORTUNITY_DEFAULT_SORTS" :key="value" :value="value">{{ labels[value] }}</option></select></label>
      </div>

      <fieldset>
        <legend>Preferred sources <small>Empty means all trusted sources</small></legend>
        <label v-for="source in preferences?.availableSources || []" :key="source.key" class="radar-choice">
          <input type="checkbox" :checked="form.preferredSources.includes(source.key)" @change="toggle('preferredSources', source.key)">
          <span>{{ source.name }}</span>
        </label>
      </fieldset>

      <fieldset>
        <legend>Preferred categories <small>Empty means all categories</small></legend>
        <div class="radar-settings__choices">
          <label v-for="category in OPPORTUNITY_CATEGORIES" :key="category" class="radar-choice">
            <input type="checkbox" :checked="form.preferredCategories.includes(category)" @change="toggle('preferredCategories', category)">
            <span>{{ OPPORTUNITY_CATEGORY_LABELS[category] || category }}</span>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Preferred modes <small>Empty means all modes</small></legend>
        <label v-for="mode in OPPORTUNITY_MODES" :key="mode" class="radar-choice">
          <input type="checkbox" :checked="form.preferredModes.includes(mode)" @change="toggle('preferredModes', mode)">
          <span>{{ labels[mode] }}</span>
        </label>
      </fieldset>

      <fieldset>
        <legend>Portfolio goals</legend>
        <div class="radar-settings__choices">
          <label v-for="goal in OPPORTUNITY_PORTFOLIO_GOALS" :key="goal" class="radar-choice">
            <input type="checkbox" :checked="form.portfolioGoals.includes(goal)" @change="toggle('portfolioGoals', goal)">
            <span>{{ labels[goal] }}</span>
          </label>
        </div>
      </fieldset>

      <label class="radar-settings__skills">
        <span>Skill goals</span>
        <UInput v-model="skillsText" placeholder="JavaScript, research, public speaking" />
        <small>Separate skills or opportunity tags with commas.</small>
      </label>

      <div class="radar-settings__toggles">
        <label class="radar-choice"><input v-model="form.hideExpired" type="checkbox"><span>Hide expired opportunities</span></label>
        <label class="radar-choice"><input v-model="form.includeOther" type="checkbox"><span>Include uncategorised events</span></label>
      </div>

      <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
      <p v-for="(message, key) in fieldErrors" :key="key" class="radar-settings__error">{{ message }}</p>

      <footer>
        <UButton type="button" color="neutral" variant="ghost" @click="reset">Reset to defaults</UButton>
        <UButton type="submit" :loading="saving">Save Opportunity Radar</UButton>
      </footer>
    </form>
  </section>
</template>
