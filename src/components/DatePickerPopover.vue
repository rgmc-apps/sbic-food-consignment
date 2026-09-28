<template>
  <div class="dp">
    <!-- ── Day view ── -->
    <template v-if="pickerMode === 'days'">
      <div class="dp-header">
        <button type="button" class="dp-nav" aria-label="Previous month" @click="prevMonth">
          <ion-icon :icon="chevronBackOutline" />
        </button>
        <button type="button" class="dp-month dp-month--link" @click="pickerMode = 'months'">
          {{ monthLabel }}
          <ion-icon :icon="chevronDownOutline" class="dp-month-caret" />
        </button>
        <button type="button" class="dp-nav" aria-label="Next month" @click="nextMonth">
          <ion-icon :icon="chevronForwardOutline" />
        </button>
      </div>

      <div class="dp-weekdays">
        <span v-for="(w, i) in weekdayLabels" :key="i">{{ w }}</span>
      </div>

      <Transition name="view-fade" mode="out-in">
        <div class="dp-grid" :key="`${viewYear}-${viewMonth}`">
          <button
            v-for="cell in cells"
            :key="cell.iso"
            type="button"
            class="dp-day"
            :class="{
              'dp-day--out': !cell.inMonth,
              'dp-day--today': cell.isToday,
              'dp-day--selected': cell.isSelected,
            }"
            @click="pickDay(cell)"
          >
            {{ cell.day }}
          </button>
        </div>
      </Transition>

      <button type="button" class="dp-today-btn" @click="pickToday">
        <ion-icon :icon="todayOutline" />
        Today
      </button>
    </template>

    <!-- ── Month view — jump straight to any month without stepping through
         each one, then drill further into the year grid via the year label. ── -->
    <template v-else-if="pickerMode === 'months'">
      <div class="dp-header">
        <button type="button" class="dp-nav" aria-label="Previous year" @click="prevYear">
          <ion-icon :icon="chevronBackOutline" />
        </button>
        <button type="button" class="dp-month dp-month--link" @click="pickerMode = 'years'">
          {{ viewYear }}
          <ion-icon :icon="chevronDownOutline" class="dp-month-caret" />
        </button>
        <button type="button" class="dp-nav" aria-label="Next year" @click="nextYear">
          <ion-icon :icon="chevronForwardOutline" />
        </button>
      </div>

      <Transition name="view-fade" mode="out-in">
        <div class="dp-cell-grid" :key="viewYear">
          <button
            v-for="(name, m) in MONTH_NAMES"
            :key="m"
            type="button"
            class="dp-cell"
            :class="{
              'dp-cell--today': m === todayMonth && viewYear === todayYear,
              'dp-cell--selected': m === viewMonth,
            }"
            @click="pickMonth(m)"
          >
            {{ name }}
          </button>
        </div>
      </Transition>
    </template>

    <!-- ── Year view — a scrollable 12-year window either side of today. ── -->
    <template v-else>
      <div class="dp-header">
        <button type="button" class="dp-nav" aria-label="Previous years" @click="prevYearRange">
          <ion-icon :icon="chevronBackOutline" />
        </button>
        <p class="dp-month">{{ yearRangeStart }}–{{ yearRangeStart + YEAR_GRID_SIZE - 1 }}</p>
        <button type="button" class="dp-nav" aria-label="Next years" @click="nextYearRange">
          <ion-icon :icon="chevronForwardOutline" />
        </button>
      </div>

      <Transition name="view-fade" mode="out-in">
        <div class="dp-cell-grid" :key="yearRangeStart">
          <button
            v-for="y in yearRange"
            :key="y"
            type="button"
            class="dp-cell"
            :class="{
              'dp-cell--today': y === todayYear,
              'dp-cell--selected': y === viewYear,
            }"
            @click="pickYear(y)"
          >
            {{ y }}
          </button>
        </div>
      </Transition>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IonIcon, popoverController } from '@ionic/vue';
import { chevronBackOutline, chevronForwardOutline, chevronDownOutline, todayOutline } from 'ionicons/icons';
import { todayISO } from '@/utils/format';

const props = defineProps<{ modelValue?: string }>();

// Data goes back to the caller via popoverController.dismiss(data, role) — see
// the equivalent comment in ItemSelectorModal.vue for why emit() cannot work here.

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

const todayIso = todayISO();
const todayReal = new Date();
const todayMonth = todayReal.getMonth();
const todayYear = todayReal.getFullYear();

const initial = (() => {
  if (props.modelValue) {
    const d = new Date(`${props.modelValue}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
})();

// Day grid (default) → Month grid → Year grid, drilling down/up exactly like
// a native OS date picker — lets a user jump straight to a far-off month or
// year instead of stepping through prevMonth/nextMonth one click at a time.
type PickerMode = 'days' | 'months' | 'years';
const pickerMode = ref<PickerMode>('days');

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Date(2023, i, 1).toLocaleDateString(undefined, { month: 'short' }),
);

const YEAR_GRID_SIZE = 12;
const yearRangeStart = ref(Math.floor(initial.getFullYear() / YEAR_GRID_SIZE) * YEAR_GRID_SIZE);
const yearRange = computed(() => Array.from({ length: YEAR_GRID_SIZE }, (_, i) => yearRangeStart.value + i));

const viewYear = ref(initial.getFullYear());
const viewMonth = ref(initial.getMonth());
const selectedIso = ref(props.modelValue || todayIso);

const monthLabel = computed(() =>
  new Date(viewYear.value, viewMonth.value, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
);

const weekdayLabels = computed(() => {
  const sunday = new Date(2023, 0, 1); // a known Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d.toLocaleDateString(undefined, { weekday: 'narrow' });
  });
});

interface DayCell {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

const cells = computed<DayCell[]>(() => {
  const y = viewYear.value;
  const m = viewMonth.value;
  const startOffset = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrevMonth = new Date(y, m, 0).getDate();

  const out: DayCell[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const pm = m === 0 ? 11 : m - 1;
    const py = m === 0 ? y - 1 : y;
    const iso = toIso(py, pm, day);
    out.push({ iso, day, inMonth: false, isToday: iso === todayIso, isSelected: iso === selectedIso.value });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = toIso(y, m, day);
    out.push({ iso, day, inMonth: true, isToday: iso === todayIso, isSelected: iso === selectedIso.value });
  }

  let nextDay = 1;
  while (out.length % 7 !== 0) {
    const nm = m === 11 ? 0 : m + 1;
    const ny = m === 11 ? y + 1 : y;
    const iso = toIso(ny, nm, nextDay);
    out.push({ iso, day: nextDay, inMonth: false, isToday: iso === todayIso, isSelected: iso === selectedIso.value });
    nextDay++;
  }

  return out;
});

function prevMonth(): void {
  if (viewMonth.value === 0) {
    viewMonth.value = 11;
    viewYear.value -= 1;
  } else {
    viewMonth.value -= 1;
  }
}

function nextMonth(): void {
  if (viewMonth.value === 11) {
    viewMonth.value = 0;
    viewYear.value += 1;
  } else {
    viewMonth.value += 1;
  }
}

function pickDay(cell: DayCell): void {
  popoverController.dismiss(cell.iso, 'picked');
}

function pickToday(): void {
  popoverController.dismiss(todayIso, 'picked');
}

function prevYear(): void {
  viewYear.value -= 1;
}

function nextYear(): void {
  viewYear.value += 1;
}

function pickMonth(m: number): void {
  viewMonth.value = m;
  pickerMode.value = 'days';
}

function prevYearRange(): void {
  yearRangeStart.value -= YEAR_GRID_SIZE;
}

function nextYearRange(): void {
  yearRangeStart.value += YEAR_GRID_SIZE;
}

function pickYear(y: number): void {
  viewYear.value = y;
  pickerMode.value = 'months';
}
</script>

<style scoped>
.dp {
  width: 296px;
  max-width: calc(100vw - 32px);
  padding: 16px;
}

.dp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.dp-month {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--app-fg);
  margin: 0;
}

.dp-month--link {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  border-radius: var(--app-radius-sm);
  background: transparent;
  cursor: pointer;
  transition: background-color 0.15s var(--ease-out-quart);
  -webkit-tap-highlight-color: transparent;
}

.dp-month--link:active {
  background: var(--app-surface-alt);
}

.dp-month-caret {
  font-size: 13px;
  color: var(--app-text-muted);
}

.dp-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--app-blue);
  font-size: 18px;
  cursor: pointer;
  transition: background-color 0.15s var(--ease-out-quart);
  -webkit-tap-highlight-color: transparent;
}

.dp-nav:active {
  background: var(--app-blue-pale);
}

.dp-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
}

.dp-weekdays span {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  font-size: var(--text-2xs);
  font-weight: 700;
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: var(--app-text-muted);
}

.dp-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  row-gap: 2px;
}

.dp-day {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 40px;
  aspect-ratio: 1;
  margin: 0 auto;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--app-fg);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s var(--ease-out-quart), color 0.15s var(--ease-out-quart);
  -webkit-tap-highlight-color: transparent;
}

.dp-day:active {
  background: var(--app-blue-pale);
}

.dp-day--out {
  color: var(--app-text-muted);
  font-weight: 400;
  opacity: 0.55;
}

.dp-day--today {
  box-shadow: inset 0 0 0 1.5px var(--app-blue);
  color: var(--app-blue);
}

.dp-day--selected,
.dp-day--selected:active {
  background: var(--app-blue);
  color: #ffffff;
  font-weight: 700;
  box-shadow: none;
}

/* ── Month / year grids — same visual language as the day grid (ring =
   today/this year, solid fill = the currently active view), just a coarser
   3-column layout since there are only 12 cells at a time. ── */
.dp-cell-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 4px 0 8px;
}

.dp-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  border: none;
  border-radius: var(--app-radius-sm);
  background: transparent;
  color: var(--app-fg);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s var(--ease-out-quart), color 0.15s var(--ease-out-quart);
  -webkit-tap-highlight-color: transparent;
}

.dp-cell:active {
  background: var(--app-blue-pale);
}

.dp-cell--today {
  box-shadow: inset 0 0 0 1.5px var(--app-blue);
  color: var(--app-blue);
}

.dp-cell--selected,
.dp-cell--selected:active {
  background: var(--app-blue);
  color: #ffffff;
  font-weight: 700;
  box-shadow: none;
}

.dp-today-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 12px;
  padding: 10px;
  border: none;
  border-top: 1px solid var(--app-border);
  border-radius: 0;
  background: transparent;
  color: var(--app-blue);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s var(--ease-out-quart);
  -webkit-tap-highlight-color: transparent;
}

.dp-today-btn ion-icon {
  font-size: 16px;
}

.dp-today-btn:active {
  background: var(--app-surface-alt);
}
</style>
