<script setup>
import { focusRouteForBlock, formatClockTime } from '~~/shared/planner/weekly-planner'

const props = defineProps({ days: { type: Array, default: () => [] }, today: { type: String, default: '' } })
const emit = defineEmits(['add', 'edit', 'move', 'delete', 'status'])
const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

function dayLabel(day) { return dayFormatter.format(day.date) }
function statusLabel(value) { return value.charAt(0) + value.slice(1).toLowerCase() }
function sortedItems(day) {
  return [
    ...day.classes.map(item => ({ ...item, kind: 'CLASS' })),
    ...day.blocks.map(item => ({ ...item, kind: 'STUDY' })),
  ].sort((left, right) => left.startMinutes - right.startMinutes || left.kind.localeCompare(right.kind))
}
</script>

<template>
  <div class="planner-calendar-shell">
    <div class="planner-calendar" role="grid" aria-label="Weekly study planner">
      <section v-for="day in days" :key="day.dateKey" class="planner-day" :class="{ 'is-today': day.dateKey === today }" role="gridcell">
        <header class="planner-day__header">
          <div><strong>{{ dayLabel(day) }}</strong><span v-if="day.dateKey === today">Today</span></div>
          <button type="button" :aria-label="`Add study block on ${dayLabel(day)}`" @click="emit('add', day.dateKey)"><UIcon name="i-lucide-plus" /></button>
        </header>
        <div class="planner-day__items">
          <template v-if="sortedItems(day).length">
            <article v-for="item in sortedItems(day)" :key="`${item.kind}-${item.id}`" class="planner-event" :class="[`planner-event--${item.kind.toLowerCase()}`, item.kind === 'STUDY' ? `is-${item.status.toLowerCase()}` : '', item.module?.colour ? `module-colour--${item.module.colour.toLowerCase()}` : '']">
              <template v-if="item.kind === 'CLASS'">
                <div class="planner-event__top"><span>Fixed class</span><UIcon name="i-lucide-lock-keyhole" /></div>
                <strong>{{ item.module?.code || 'Class' }}</strong>
                <p>{{ item.classType }} · {{ item.groupLabel }}</p>
                <small>{{ formatClockTime(item.startMinutes) }}–{{ formatClockTime(item.endMinutes) }}<template v-if="item.venue"> · {{ item.venue }}</template></small>
              </template>
              <template v-else>
                <div class="planner-event__top"><span>{{ item.moduleCode || 'General study' }}</span><em>{{ statusLabel(item.status) }}</em></div>
                <strong>{{ item.title }}</strong>
                <p v-if="item.goal">{{ item.goal }}</p>
                <small>{{ formatClockTime(item.startMinutes) }}–{{ formatClockTime(item.endMinutes) }}</small>
                <div class="planner-event__actions">
                  <button type="button" @click="emit('edit', item)">Edit</button>
                  <button type="button" @click="emit('move', item)">Move</button>
                  <button v-if="item.status !== 'COMPLETED'" type="button" @click="emit('status', item.id, 'COMPLETED')">Complete</button>
                  <button v-if="item.status !== 'SKIPPED'" type="button" @click="emit('status', item.id, 'SKIPPED')">Skip</button>
                  <NuxtLink :to="focusRouteForBlock(item)">Focus</NuxtLink>
                  <button type="button" class="is-danger" @click="emit('delete', item.id)">Delete</button>
                </div>
              </template>
            </article>
          </template>
          <p v-else class="planner-day__empty">No classes or study blocks</p>
        </div>
      </section>
    </div>
  </div>
</template>
