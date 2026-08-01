<script setup>
defineProps({
  groups: { type: Array, default: () => [] }
})

defineEmits(['select-event'])

function dateHeading(value) {
  const date = new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat('en-SG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date)
}

function eventTime(event) {
  if (event.allDay) return 'All day'
  const value = String(event.start || '')
  const local = value.match(/T(\d{2}):(\d{2})/)
  const endLocal = String(event.end || '').match(/T(\d{2}):(\d{2})/)
  if (local && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    return `${local[1]}:${local[2]}${endLocal ? `–${endLocal[1]}:${endLocal[2]}` : ''}`
  }
  const start = new Date(event.start)
  const end = new Date(event.end)
  if (Number.isNaN(start.getTime())) return 'Time unavailable'
  const formatter = new Intl.DateTimeFormat('en-SG', {
    timeZone: event.timeZone || 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  return `${formatter.format(start)}${Number.isNaN(end.getTime()) ? '' : `–${formatter.format(end)}`}`
}
</script>

<template>
  <section class="calendar-agenda" aria-label="Calendar agenda">
    <article v-for="group in groups" :key="group.dateKey">
      <header>
        <time :datetime="group.dateKey">{{ dateHeading(group.dateKey) }}</time>
        <span>{{ group.events.length }} event{{ group.events.length === 1 ? '' : 's' }}</span>
      </header>

      <button
        v-for="event in group.events"
        :key="event.id"
        type="button"
        class="calendar-agenda__event"
        @click="$emit('select-event', event)"
      >
        <span class="calendar-agenda__marker" :class="`is-${event.category.toLowerCase()}`" />
        <time>{{ eventTime(event) }}</time>
        <div>
          <p>{{ event.moduleCode }} · {{ event.subtitle }}</p>
          <h3>{{ event.title }}</h3>
          <span>
            <template v-if="event.weight !== null">{{ event.weight }}% · </template>
            <template v-if="event.location">{{ event.location }} · </template>
            {{ event.sourceLabel }}
          </span>
        </div>
        <UIcon name="i-lucide-chevron-right" />
      </button>
    </article>
  </section>
</template>
