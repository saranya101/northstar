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

const tags = computed(() =>
  Array.isArray(props.opportunity.tags)
    ? props.opportunity.tags.slice(0, 4)
    : [],
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

const showEventEnd = computed(() => {
  if (!props.opportunity.endAt) {
    return false
  }

  if (!props.opportunity.startAt) {
    return true
  }

  return formatOpportunityDate(props.opportunity.endAt)
    !== formatOpportunityDate(props.opportunity.startAt)
})
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

    <div
      v-if="
        opportunity.deadline
        || opportunity.startAt
        || opportunity.endAt
      "
      class="opportunity-card__dates"
    >
      <div
        v-if="opportunity.deadline"
        class="opportunity-card__date"
      >
        <span class="opportunity-card__date-icon">
          <UIcon
            name="i-lucide-calendar-clock"
            aria-hidden="true"
          />
        </span>

        <div>
          <span>Application deadline</span>
          <strong>
            {{ formatOpportunityDate(opportunity.deadline) }}
          </strong>
        </div>
      </div>

      <div
        v-if="opportunity.startAt"
        class="opportunity-card__date"
      >
        <span class="opportunity-card__date-icon">
          <UIcon
            name="i-lucide-calendar-days"
            aria-hidden="true"
          />
        </span>

        <div>
          <span>Event date</span>
          <strong>
            {{ formatOpportunityDate(opportunity.startAt) }}
          </strong>
        </div>
      </div>

      <div
        v-if="showEventEnd"
        class="opportunity-card__date"
      >
        <span class="opportunity-card__date-icon">
          <UIcon
            name="i-lucide-calendar-range"
            aria-hidden="true"
          />
        </span>

        <div>
          <span>Event ends</span>
          <strong>
            {{ formatOpportunityDate(opportunity.endAt) }}
          </strong>
        </div>
      </div>
    </div>

    <dl class="opportunity-card__meta">
      <div>
        <dt>
          <UIcon
            name="i-lucide-map-pin"
            aria-hidden="true"
          />
          Location
        </dt>

        <dd
          :title="opportunity.location || 'Not specified'"
        >
          {{ opportunity.location || 'Not specified' }}
        </dd>
      </div>

      <div>
        <dt>
          <UIcon
            name="i-lucide-monitor-smartphone"
            aria-hidden="true"
          />
          Mode
        </dt>

        <dd>{{ modeLabel }}</dd>
      </div>

      <div>
        <dt>
          <UIcon
            name="i-lucide-list-checks"
            aria-hidden="true"
          />
          Application status
        </dt>

        <dd>{{ applicationStatus }}</dd>
      </div>
    </dl>

    <div
      v-if="tags.length"
      class="opportunity-tags"
    >
      <span
        v-for="tag in tags"
        :key="tag"
      >
        {{ tag }}
      </span>
    </div>

    <section
      v-if="portfolio"
      class="opportunity-card__portfolio"
      :aria-label="`${portfolio.level} portfolio value`"
    >
      <header>
        <span :class="`portfolio-level portfolio-level--${portfolio.level.toLowerCase()}`">
          {{ portfolio.level }}
        </span>
        <strong>{{ portfolio.headline }}</strong>
      </header>

      <div v-if="portfolioSkills.length" class="opportunity-card__skills">
        <span v-for="skill in portfolioSkills" :key="skill">{{ skill }}</span>
      </div>

      <p v-if="makeItCount">
        <strong>Make it count:</strong> {{ makeItCount }}
      </p>

      <details>
        <summary>Why it matters</summary>
        <p>{{ portfolio.summary }}</p>
        <ul v-if="opportunity.recommendationReasons?.length">
          <li v-for="reason in opportunity.recommendationReasons.slice(0, 2)" :key="reason">{{ reason }}</li>
        </ul>
      </details>
    </section>

    <footer
      v-if="
        opportunity.isPublic
        && opportunity.lastVerifiedAt
      "
      class="opportunity-card__footer"
    >
      <UIcon
        name="i-lucide-badge-check"
        aria-hidden="true"
      />

      Verified
      {{ formatOpportunityDate(opportunity.lastVerifiedAt) }}
    </footer>
  </article>
</template>
