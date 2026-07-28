<script setup>
import {
  OPPORTUNITY_CATEGORY_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  opportunityTiming,
} from '~~/shared/utils/opportunities'
import {
  formatOpportunityDate,
  opportunityModeLabel,
  opportunitySourceNames,
} from '~/utils/opportunity-presentation'

const props = defineProps({
  opportunity: {
    type: Object,
    required: true,
  },
})

const sources = computed(() =>
  opportunitySourceNames(props.opportunity),
)

const timing = computed(() => {
  if (
    props.opportunity.isPublic
    && !props.opportunity.active
  ) {
    return {
      state: 'closed',
      label: 'Unavailable',
    }
  }

  return opportunityTiming(props.opportunity)
})

const isNew = computed(() => {
  if (
    !props.opportunity.isPublic
    || !props.opportunity.firstSeenAt
  ) {
    return false
  }

  const firstSeenAt = new Date(
    props.opportunity.firstSeenAt,
  ).getTime()

  if (Number.isNaN(firstSeenAt)) {
    return false
  }

  return Date.now() - firstSeenAt <= 7 * 86_400_000
})

const categoryLabel = computed(() =>
  OPPORTUNITY_CATEGORY_LABELS[
    props.opportunity.category
  ] || 'Other',
)

const applicationStatus = computed(() =>
  OPPORTUNITY_STATUS_LABELS[
    props.opportunity.personal?.status
  ] || 'Not tracked',
)

const modeLabel = computed(() =>
  opportunityModeLabel(props.opportunity.mode),
)

const portfolio = computed(() =>
  props.opportunity.portfolioValue || null,
)

const portfolioSkills = computed(() =>
  Array.isArray(portfolio.value?.skillSignals)
    ? portfolio.value.skillSignals.slice(0, 2)
    : [],
)

const makeItCount = computed(() =>
  Array.isArray(portfolio.value?.maximiseActions)
    ? portfolio.value.maximiseActions[0] || ''
    : '',
)

const expanded = ref(false)
const disclosureId = computed(() =>
  `opportunity-value-${props.opportunity.id}`,
)

const primaryDate = computed(() => {
  if (props.opportunity.deadline) {
    return {
      label: 'Deadline',
      value: props.opportunity.deadline,
    }
  }

  if (props.opportunity.startAt) {
    return {
      label: 'Event',
      value: props.opportunity.startAt,
    }
  }

  return null
})

const hasMode = computed(() =>
  props.opportunity.mode
  && props.opportunity.mode !== 'UNKNOWN',
)

const goalMatches = computed(() =>
  Array.isArray(portfolio.value?.goalMatches)
    ? portfolio.value.goalMatches.slice(0, 3)
    : [],
)

const evidenceIdeas = computed(() =>
  Array.isArray(portfolio.value?.evidenceIdeas)
    ? portfolio.value.evidenceIdeas.slice(0, 3)
    : [],
)

const maximiseActions = computed(() =>
  Array.isArray(portfolio.value?.maximiseActions)
    ? portfolio.value.maximiseActions.slice(0, 2)
    : [],
)

const recommendationReasons = computed(() =>
  Array.isArray(props.opportunity.recommendationReasons)
    ? props.opportunity.recommendationReasons.slice(0, 2)
    : [],
)

const hasDisclosure = computed(() =>
  Boolean(
    portfolio.value?.summary
    || props.opportunity.location
    || hasMode.value
    || goalMatches.value.length
    || evidenceIdeas.value.length
    || maximiseActions.value.length
    || recommendationReasons.value.length,
  ),
)
</script>

<template>
  <article class="opportunity-card">
    <header class="opportunity-card__top">
      <div class="opportunity-card__sources">
        <OpportunitiesOpportunitySourceBadge
          v-for="source in sources"
          :key="source"
          :name="source"
        />
      </div>

      <span
        :class="`deadline-state deadline-state--${timing.state}`"
      >
        {{ timing.label }}
      </span>
    </header>

    <div class="opportunity-card__badges">
      <UBadge
        color="neutral"
        variant="soft"
      >
        {{ categoryLabel }}
      </UBadge>

      <UBadge
        v-if="isNew"
        color="primary"
        variant="soft"
      >
        New
      </UBadge>
    </div>

    <div class="opportunity-card__identity">
      <h3>
        <NuxtLink :to="`/app/opportunities/${opportunity.id}`">
          {{ opportunity.title }}
        </NuxtLink>
      </h3>
      <p>{{ opportunity.organisation }}</p>
    </div>

    <section
      v-if="portfolio"
      class="opportunity-card__portfolio"
      :aria-label="`${portfolio.level} portfolio value`"
    >
      <header>
        <span :class="`portfolio-level portfolio-level--${portfolio.level.toLowerCase()}`">
          {{ portfolio.level }} portfolio value
          <strong>{{ portfolio.score }}</strong>
        </span>
        <h4>{{ portfolio.headline }}</h4>
      </header>

      <div v-if="portfolioSkills.length" class="opportunity-card__skills">
        <span v-for="skill in portfolioSkills" :key="skill">{{ skill }}</span>
      </div>

      <p v-if="makeItCount">
        <strong>Make it count:</strong> {{ makeItCount }}
      </p>

    </section>

    <dl
      v-if="primaryDate || opportunity.personal"
      class="opportunity-card__meta"
    >
      <div v-if="primaryDate">
        <dt>{{ primaryDate.label }}</dt>
        <dd>{{ formatOpportunityDate(primaryDate.value) }}</dd>
      </div>
      <div v-if="opportunity.personal">
        <dt>Tracking</dt>
        <dd>{{ applicationStatus }}</dd>
      </div>
    </dl>

    <div
      v-if="portfolio && hasDisclosure"
      class="opportunity-card__disclosure"
    >
      <button
        type="button"
        :aria-expanded="expanded"
        :aria-controls="disclosureId"
        @click="expanded = !expanded"
      >
        Why it matters
        <UIcon
          :name="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          aria-hidden="true"
        />
      </button>

      <div
        v-show="expanded"
        :id="disclosureId"
        class="opportunity-card__disclosure-content"
      >
        <p v-if="portfolio.summary">{{ portfolio.summary }}</p>

        <dl
          v-if="opportunity.location || hasMode"
          class="opportunity-card__secondary-meta"
        >
          <div v-if="opportunity.location">
            <dt>Location</dt>
            <dd>{{ opportunity.location }}</dd>
          </div>
          <div v-if="hasMode">
            <dt>Mode</dt>
            <dd>{{ modeLabel }}</dd>
          </div>
        </dl>

        <div v-if="goalMatches.length">
          <strong>Goals supported</strong>
          <p>{{ goalMatches.join(' · ') }}</p>
        </div>

        <div v-if="evidenceIdeas.length">
          <strong>Evidence to collect</strong>
          <ul>
            <li v-for="idea in evidenceIdeas" :key="idea">{{ idea }}</li>
          </ul>
        </div>

        <div v-if="maximiseActions.length">
          <strong>How to maximise it</strong>
          <ul>
            <li v-for="action in maximiseActions" :key="action">{{ action }}</li>
          </ul>
        </div>

        <div v-if="recommendationReasons.length">
          <strong>Why recommended</strong>
          <ul>
            <li v-for="reason in recommendationReasons" :key="reason">{{ reason }}</li>
          </ul>
        </div>
      </div>
    </div>

    <footer class="opportunity-card__actions">
      <span
        v-if="opportunity.isPublic && opportunity.lastVerifiedAt"
        :title="`Verified ${formatOpportunityDate(opportunity.lastVerifiedAt)}`"
      >
        <UIcon name="i-lucide-badge-check" aria-hidden="true" />
        Verified
      </span>
      <NuxtLink :to="`/app/opportunities/${opportunity.id}`">
        View opportunity
        <UIcon name="i-lucide-arrow-right" aria-hidden="true" />
      </NuxtLink>
    </footer>
  </article>
</template>
