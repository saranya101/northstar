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
const openGroups = reactive(new Set(['feed', 'build']))
const savedSignature = ref('')
const statusMessage = ref('')

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

function payload() {
  const {
    lastManualRefreshAt: _lastManualRefreshAt,
    ...editable
  } = form

  return {
    ...editable,
    preferredSources: [...form.preferredSources],
    preferredCategories: [...form.preferredCategories],
    preferredModes: [...form.preferredModes],
    portfolioGoals: [...form.portfolioGoals],
    skillGoals: [...form.skillGoals],
  }
}

const hasUnsavedChanges = computed(() =>
  Boolean(savedSignature.value)
  && JSON.stringify(payload()) !== savedSignature.value,
)

watch(hasUnsavedChanges, dirty => {
  if (dirty) {
    statusMessage.value = ''
  }
})

function syncForm(value, markSaved = false) {
  if (!value) return
  for (const key of Object.keys(defaults())) {
    form[key] = Array.isArray(value[key])
      ? [...value[key]]
      : value[key]
  }
  if (markSaved) {
    savedSignature.value = JSON.stringify(payload())
  }
}

function toggle(key, value) {
  const values = form[key]
  const index = values.indexOf(value)
  if (index >= 0) values.splice(index, 1)
  else values.push(value)
}

function toggleGroup(group) {
  if (openGroups.has(group)) openGroups.delete(group)
  else openGroups.add(group)
}

async function submit() {
  statusMessage.value = ''
  const result = await save(payload())
  if (result) {
    syncForm(result, true)
    statusMessage.value = 'Opportunity Radar preferences saved.'
    emit('saved')
  }
}

async function reset() {
  syncForm(defaults())
  await nextTick()
  statusMessage.value = hasUnsavedChanges.value
    ? 'Defaults selected. Save to apply them.'
    : 'Preferences already use the defaults.'
}

onMounted(async () => syncForm(await load(true), true))
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
      <section class="radar-settings__group">
        <h3>
          <button type="button" :aria-expanded="openGroups.has('feed')" aria-controls="radar-feed-panel" @click="toggleGroup('feed')">
            <span><strong>Feed behaviour</strong><small>Refresh, closing window and default order</small></span>
            <UIcon :name="openGroups.has('feed') ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" aria-hidden="true" />
          </button>
        </h3>
        <div v-show="openGroups.has('feed')" id="radar-feed-panel" class="radar-settings__panel">
          <div class="radar-settings__selects">
            <label><span>Feed refresh frequency</span><select v-model="form.feedRefreshCadence"><option v-for="value in OPPORTUNITY_FEED_CADENCES" :key="value" :value="value">{{ labels[value] }}</option></select></label>
            <label><span>Closing-soon window</span><select v-model.number="form.closingSoonDays"><option v-for="value in OPPORTUNITY_CLOSING_SOON_DAYS" :key="value" :value="value">{{ value }} days</option></select></label>
            <label><span>Default sort</span><select v-model="form.defaultSort"><option v-for="value in OPPORTUNITY_DEFAULT_SORTS" :key="value" :value="value">{{ labels[value] }}</option></select></label>
          </div>
        </div>
      </section>

      <section class="radar-settings__group">
        <h3>
          <button type="button" :aria-expanded="openGroups.has('see')" aria-controls="radar-see-panel" @click="toggleGroup('see')">
            <span><strong>What you want to see</strong><small>Sources, categories and participation modes</small></span>
            <UIcon :name="openGroups.has('see') ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" aria-hidden="true" />
          </button>
        </h3>
        <div v-show="openGroups.has('see')" id="radar-see-panel" class="radar-settings__panel">
          <fieldset>
            <legend>Preferred sources <small>Empty means all trusted sources</small></legend>
            <label v-for="source in preferences?.availableSources || []" :key="source.key" class="radar-choice"><input type="checkbox" :checked="form.preferredSources.includes(source.key)" @change="toggle('preferredSources', source.key)"><span>{{ source.name }}</span></label>
          </fieldset>
          <fieldset>
            <legend>Preferred categories <small>Empty means all categories</small></legend>
            <div class="radar-settings__choices">
              <label v-for="category in OPPORTUNITY_CATEGORIES" :key="category" class="radar-choice"><input type="checkbox" :checked="form.preferredCategories.includes(category)" @change="toggle('preferredCategories', category)"><span>{{ OPPORTUNITY_CATEGORY_LABELS[category] || category }}</span></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Preferred modes <small>Empty means all modes</small></legend>
            <label v-for="mode in OPPORTUNITY_MODES" :key="mode" class="radar-choice"><input type="checkbox" :checked="form.preferredModes.includes(mode)" @change="toggle('preferredModes', mode)"><span>{{ labels[mode] }}</span></label>
          </fieldset>
        </div>
      </section>

      <section class="radar-settings__group">
        <h3>
          <button type="button" :aria-expanded="openGroups.has('build')" aria-controls="radar-build-panel" @click="toggleGroup('build')">
            <span><strong>What you want to build</strong><small>Portfolio goals and custom skills</small></span>
            <UIcon :name="openGroups.has('build') ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" aria-hidden="true" />
          </button>
        </h3>
        <div v-show="openGroups.has('build')" id="radar-build-panel" class="radar-settings__panel">
          <fieldset>
            <legend>Portfolio goals</legend>
            <div class="radar-settings__choices">
              <label v-for="goal in OPPORTUNITY_PORTFOLIO_GOALS" :key="goal" class="radar-choice"><input type="checkbox" :checked="form.portfolioGoals.includes(goal)" @change="toggle('portfolioGoals', goal)"><span>{{ labels[goal] }}</span></label>
            </div>
          </fieldset>
          <SettingsSkillChipInput v-model="form.skillGoals" />
        </div>
      </section>

      <section class="radar-settings__group">
        <h3>
          <button type="button" :aria-expanded="openGroups.has('visibility')" aria-controls="radar-visibility-panel" @click="toggleGroup('visibility')">
            <span><strong>Visibility</strong><small>Expired and uncategorised opportunities</small></span>
            <UIcon :name="openGroups.has('visibility') ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" aria-hidden="true" />
          </button>
        </h3>
        <div v-show="openGroups.has('visibility')" id="radar-visibility-panel" class="radar-settings__panel radar-settings__toggles">
          <label class="radar-choice"><input v-model="form.hideExpired" type="checkbox"><span>Hide expired opportunities</span></label>
          <label class="radar-choice"><input v-model="form.includeOther" type="checkbox"><span>Include uncategorised events</span></label>
        </div>
      </section>

      <p v-if="error" class="module-alert" role="alert">{{ error }}</p>
      <p v-for="(message, key) in fieldErrors" :key="key" class="radar-settings__error">{{ message }}</p>

      <footer class="radar-settings__savebar">
        <span aria-live="polite">{{ statusMessage || (hasUnsavedChanges ? 'You have unsaved changes.' : 'All changes saved.') }}</span>
        <div>
          <UButton type="button" color="neutral" variant="ghost" @click="reset">Reset to defaults</UButton>
          <UButton type="submit" :loading="saving" :disabled="!hasUnsavedChanges">Save Opportunity Radar</UButton>
        </div>
      </footer>
    </form>
  </section>
</template>
