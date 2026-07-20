<script setup>
const visual = ref(null)
let canMove = false
let frame

function setDepth(x, y) {
  if (!visual.value) return
  visual.value.style.setProperty('--depth-x', `${x}px`)
  visual.value.style.setProperty('--depth-y', `${y}px`)
}

function onPointerMove(event) {
  if (!canMove || event.pointerType === 'touch') return
  const bounds = visual.value.getBoundingClientRect()
  const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 10
  const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 10
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => setDepth(x, y))
}

function resetDepth() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => setDepth(0, 0))
}

function resetOutsideVisual(event) {
  if (!canMove || !visual.value) return
  const bounds = visual.value.getBoundingClientRect()

  if (
    event.clientX < bounds.left
    || event.clientX > bounds.right
    || event.clientY < bounds.top
    || event.clientY > bounds.bottom
  ) {
    resetDepth()
  }
}

onMounted(() => {
  canMove = window.matchMedia('(pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.addEventListener('pointermove', resetOutsideVisual, { passive: true })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  window.removeEventListener('pointermove', resetOutsideVisual)
})
</script>

<template>
  <div
    ref="visual"
    class="semester-map"
    aria-hidden="true"
    @pointermove="onPointerMove"
    @pointerleave="resetDepth"
    @mouseleave="resetDepth"
  >
    <div class="semester-map__meta">
      <span>Semester alignment</span>
      <span>Academic week</span>
    </div>

    <div class="semester-map__canvas">
      <div class="semester-map__orbit semester-map__orbit--outer" />
      <div class="semester-map__orbit semester-map__orbit--inner" />
      <div class="semester-map__axis semester-map__axis--x" />
      <div class="semester-map__axis semester-map__axis--y" />
      <div class="semester-map__star" />

      <span class="semester-map__node semester-map__node--plan"><i />Plan</span>
      <span class="semester-map__node semester-map__node--focus"><i />Focus</span>
      <span class="semester-map__node semester-map__node--review"><i />Review</span>
      <span class="semester-map__node semester-map__node--adapt"><i />Adapt</span>

      <div class="semester-map__weeks">
        <span>W01</span><span>W04</span><span>W08</span><span>W12</span>
      </div>
    </div>

    <div class="semester-map__caption">
      <span class="semester-map__bearing">NE · 037°</span>
      <span>Direction before urgency</span>
    </div>
  </div>
</template>

<style scoped>
.semester-map {
  --depth-x: 0px;
  --depth-y: 0px;
  position: relative;
  z-index: 1;
  width: min(100%, 620px);
  margin-top: auto;
  padding-top: 2.5rem;
  perspective: 900px;
}

.semester-map__meta,
.semester-map__caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--ns-text-muted);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.semester-map__canvas {
  position: relative;
  height: clamp(210px, 26vw, 310px);
  margin: 0.8rem 0;
  overflow: hidden;
  border: 1px solid rgba(23, 110, 104, 0.24);
  border-radius: 0.9rem;
  background: rgba(251, 250, 246, 0.34);
  transform: translate3d(var(--depth-x), var(--depth-y), 0);
  transition: transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
}

.semester-map__canvas::before {
  position: absolute;
  inset: 10%;
  border: 1px dashed rgba(23, 110, 104, 0.2);
  border-radius: 0.65rem;
  content: "";
}

.semester-map__orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 1px solid rgba(23, 110, 104, 0.32);
  border-radius: 50%;
  transform: translate(-50%, -50%) rotate(-12deg);
}

.semester-map__orbit--outer {
  width: 58%;
  aspect-ratio: 1.8;
}

.semester-map__orbit--inner {
  width: 32%;
  aspect-ratio: 1;
  border-style: dashed;
}

.semester-map__axis {
  position: absolute;
  top: 50%;
  left: 50%;
  background: rgba(23, 110, 104, 0.18);
  transform: translate(-50%, -50%);
}

.semester-map__axis--x { width: 72%; height: 1px; }
.semester-map__axis--y { width: 1px; height: 68%; }

.semester-map__star {
  position: absolute;
  width: 2.35rem;
  height: 2.35rem;
  top: 50%;
  left: 50%;
  background: var(--ns-accent);
  clip-path: polygon(50% 0, 59% 41%, 100% 50%, 59% 59%, 50% 100%, 41% 59%, 0 50%, 41% 41%);
  transform: translate(-50%, -50%) rotate(8deg);
  box-shadow: 0 0 0 8px rgba(23, 110, 104, 0.08);
}

.semester-map__node {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 0.42rem;
  color: var(--ns-text-secondary);
  font-size: 0.7rem;
  font-weight: 580;
  letter-spacing: 0.04em;
}

.semester-map__node i {
  width: 0.42rem;
  height: 0.42rem;
  border: 1px solid var(--ns-accent);
  border-radius: 50%;
  background: var(--ns-panel);
  box-shadow: 0 0 0 3px rgba(23, 110, 104, 0.08);
}

.semester-map__node--plan { left: 12%; top: 22%; }
.semester-map__node--focus { right: 12%; top: 29%; }
.semester-map__node--review { left: 18%; bottom: 22%; }
.semester-map__node--adapt { right: 17%; bottom: 17%; }

.semester-map__weeks {
  position: absolute;
  display: flex;
  right: 4%;
  bottom: 50%;
  gap: 0.8rem;
  color: color-mix(in srgb, var(--ns-text-muted) 70%, transparent);
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  transform: rotate(90deg) translateX(50%);
  transform-origin: right bottom;
}

.semester-map__bearing {
  color: var(--ns-accent);
}

@media (prefers-reduced-motion: reduce) {
  .semester-map__canvas {
    transform: none;
    transition: none;
  }
}
</style>
