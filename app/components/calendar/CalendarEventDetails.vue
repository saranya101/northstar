<script setup>
const props = defineProps({
  open: { type: Boolean, default: false },
  event: { type: Object, default: null }
})

const emit = defineEmits(['update:open', 'export'])

function label(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function dateTime(event) {
  if (!event) return ''
  if (event.allDay) {
    return new Intl.DateTimeFormat('en-SG', { dateStyle: 'full' })
      .format(new Date(`${event.dateKey}T00:00:00`))
  }

  const value = String(event.start || '')
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    const start = new Date(value)
    const end = new Date(event.end)
    const formatter = new Intl.DateTimeFormat('en-SG', {
      dateStyle: 'full',
      timeStyle: 'short'
    })
    return `${formatter.format(start)}${Number.isNaN(end.getTime()) ? '' : ` – ${new Intl.DateTimeFormat('en-SG', { timeStyle: 'short' }).format(end)}`}`
  }

  const start = new Date(event.start)
  const end = new Date(event.end)
  const formatter = new Intl.DateTimeFormat('en-SG', {
    timeZone: event.timeZone || 'Asia/Singapore',
    dateStyle: 'full',
    timeStyle: 'short'
  })
  const endFormatter = new Intl.DateTimeFormat('en-SG', {
    timeZone: event.timeZone || 'Asia/Singapore',
    timeStyle: 'short'
  })
  return `${formatter.format(start)}${Number.isNaN(end.getTime()) ? '' : ` – ${endFormatter.format(end)}`}`
}
</script>

<template>
  <UModal
    :open="props.open"
    :title="props.event?.title || 'Calendar event'"
    description="Confirmed academic calendar information."
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <dl v-if="props.event" class="calendar-event-details">
        <div>
          <dt>Module</dt>
          <dd>{{ props.event.moduleCode }} · {{ props.event.moduleTitle }}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{{ label(props.event.subtitle || props.event.type) }}</dd>
        </div>
        <div>
          <dt>Date and time</dt>
          <dd>{{ dateTime(props.event) }}</dd>
        </div>
        <div v-if="props.event.weight !== null">
          <dt>Weight</dt>
          <dd>{{ props.event.weight }}%</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{{ props.event.location || (props.event.online ? 'Online' : 'Not recorded') }}</dd>
        </div>
        <div>
          <dt>Source status</dt>
          <dd>{{ props.event.sourceLabel }}</dd>
        </div>
      </dl>
      <p v-if="props.event?.description" class="calendar-event-details__description">
        {{ props.event.description }}
      </p>
    </template>

    <template #footer>
      <UButton
        v-if="props.event?.link"
        color="neutral"
        variant="outline"
        :to="props.event.link"
        @click="emit('update:open', false)"
      >
        Open record
      </UButton>
      <UButton
        icon="i-lucide-download"
        :disabled="!props.event"
        @click="emit('export', props.event)"
      >
        Export event
      </UButton>
    </template>
  </UModal>
</template>
