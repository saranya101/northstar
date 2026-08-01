<script setup>
const props = defineProps({
  days: { type: Array, default: () => [] }
})

defineEmits(['select-event'])

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function eventTime(event) {
  if (event.allDay) return 'All day'
  const value = String(event.start || '')
  const local = value.match(/T(\d{2}):(\d{2})/)
  if (local && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) return `${local[1]}:${local[2]}`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: event.timeZone || 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

function dateLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`)
  return new Intl.DateTimeFormat('en-SG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date)
}
</script>

<template>
  <section class="calendar-month" aria-label="Month calendar">
    <div class="calendar-month__weekdays" aria-hidden="true">
      <span v-for="label in weekdayLabels" :key="label">{{ label }}</span>
    </div>

    <ol class="calendar-month__grid">
      <li
        v-for="day in props.days"
        :key="day.dateKey"
        :class="{
          'is-outside': !day.currentMonth,
          'is-today': day.today
        }"
      >
        <div class="calendar-day__heading">
          <time :datetime="day.dateKey" :aria-label="dateLabel(day.dateKey)">
            {{ day.dayNumber }}
          </time>
          <span v-if="day.today">Today</span>
        </div>

        <div class="calendar-day__events">
          <button
            v-for="event in day.events"
            :key="event.id"
            type="button"
            class="calendar-event-chip"
            :class="`calendar-event-chip--${event.category.toLowerCase()}`"
            :aria-label="`${eventTime(event)} ${event.moduleCode} ${event.title}`"
            @click="$emit('select-event', event)"
          >
            <time>{{ eventTime(event) }}</time>
            <strong>{{ event.moduleCode }}</strong>
            <span>{{ event.title }}</span>
          </button>
        </div>
      </li>
    </ol>
  </section>
</template>
