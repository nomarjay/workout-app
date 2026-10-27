<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { calendarDays, dateFromKey, formatDate } from '../utils/dashboard.js';
const props = defineProps({
  today: String,
  selected: String,
  schedules: Array,
  workouts: Array,
  disabled: Boolean,
});
const emit = defineEmits(['select', 'action']);
const menu = ref(null);
const menuElement = ref(null);
let menuTrigger;
const menuSchedule = computed(() =>
  props.schedules.find((item) => item.date === menu.value?.date)
);
async function openMenu(event, date) {
  if (props.disabled) return;
  menuTrigger = event.currentTarget;
  const rect = menuTrigger.getBoundingClientRect();
  menu.value = {
    date,
    x: Math.max(
      8,
      Math.min(event.clientX || rect.left, window.innerWidth - 260)
    ),
    y: Math.max(
      8,
      Math.min(event.clientY || rect.bottom, window.innerHeight - 360)
    ),
  };
  await nextTick();
  menuElement.value?.querySelector('button')?.focus();
}
function closeMenu(restore = false) {
  menu.value = null;
  if (restore) menuTrigger?.focus();
}
function act(action) {
  const date = menu.value.date;
  closeMenu(true);
  emit('action', { date, action });
}
function outside(event) {
  if (!menuElement.value?.contains(event.target)) closeMenu();
}
function menuKeys(event) {
  if (event.key === 'Escape' || event.key === 'Tab') {
    closeMenu(event.key === 'Escape');
    return;
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const items = [...menuElement.value.querySelectorAll('button')];
  const current = items.indexOf(document.activeElement);
  const index =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
      ? items.length - 1
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) %
        items.length;
  items[index]?.focus();
}
onMounted(() => document.addEventListener('pointerdown', outside));
onUnmounted(() => document.removeEventListener('pointerdown', outside));
watch(
  () => props.disabled,
  (value) => {
    if (value) closeMenu();
  }
);
const month = ref(dateFromKey(props.selected));
watch(
  () => props.selected,
  (value) => {
    month.value = dateFromKey(value);
  }
);
const days = computed(() =>
  calendarDays(month.value.getFullYear(), month.value.getMonth())
);
const monthName = computed(() =>
  new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    month.value
  )
);
const scheduledDates = computed(
  () => new Set(props.schedules.map((item) => item.date))
);
function shift(direction) {
  month.value = new Date(
    month.value.getFullYear(),
    month.value.getMonth() + direction,
    1,
    12
  );
}
function showToday() {
  month.value = dateFromKey(props.today);
  emit('select', props.today);
}
function dayLabel(date) {
  const schedule = props.schedules.find((item) => item.date === date);
  const workout =
    schedule && props.workouts.find((item) => item.id === schedule.workoutId);
  return `${formatDate(date)}${date === props.today ? ', today' : ''}${
    workout ? `, ${workout.name} scheduled` : ''
  }`;
}
</script>
<template>
  <section
    class="panel rounded-[18px] border border-(--color-border) bg-(--color-surface) p-5 shadow-none min-[601px]:p-[22px] min-[1051px]:p-7 calendar-card"
    aria-labelledby="calendar-heading"
  >
    <div
      class="dashboard-section-heading mb-5 flex flex-wrap items-center justify-between gap-3 [&_h2]:text-2xl [&_h2]:tracking-[-.5px] [&_.hint]:mb-0"
    >
      <div>
        <p
          class="eyebrow text-xs font-bold tracking-[.08em] text-(--color-text-subtle)"
        >
          MAKE ROOM FOR MOVEMENT
        </p>
        <h2 id="calendar-heading">Your calendar</h2>
      </div>
      <button
        class="small-button px-2.5 py-[7px]"
        :disabled="disabled"
        @click="showToday"
      >
        Today
      </button>
    </div>
    <p
      class="calendar-today rounded-lg bg-(--color-today-background) px-3 py-2.5 text-sm leading-[1.6] text-(--color-text-muted) [&_time]:font-semibold [&_time]:text-(--color-text)"
    >
      Today is
      <time :datetime="today">{{
        formatDate(today, { month: 'long', day: 'numeric', year: 'numeric' })
      }}</time>
    </p>
    <div
      class="calendar-navigation mt-5 mb-3 flex items-center justify-between gap-2 [&_button]:px-3 [&_button]:py-2 [&_h3]:m-0 [&_h3]:text-[17px]"
    >
      <button
        :disabled="disabled"
        aria-label="Previous month"
        @click="shift(-1)"
      >
        ←
      </button>
      <h3 aria-live="polite">{{ monthName }}</h3>
      <button :disabled="disabled" aria-label="Next month" @click="shift(1)">
        →
      </button>
    </div>
    <div
      class="calendar-weekdays grid grid-cols-7 gap-1 py-2 text-center text-[13px] text-(--color-text-subtle)"
      aria-hidden="true"
    >
      <span
        v-for="(day, index) in ['S', 'M', 'T', 'W', 'T', 'F', 'S']"
        :key="index"
        >{{ day }}</span
      >
    </div>
    <div
      class="calendar-days grid grid-cols-7 gap-1"
      role="group"
      :aria-label="monthName"
    >
      <button
        v-for="day in days"
        :key="day.date"
        :disabled="disabled"
        class="relative flex min-h-11 items-center justify-center rounded-lg border border-transparent px-0! pt-2! pb-3! text-base"
        :class="{
          'text-(--color-text-disabled)': !day.inMonth && day.date !== selected,
          'border-(--color-accent-strong)! font-bold': day.date === today,
          'bg-(--color-primary)! text-(--color-on-primary)!':
            day.date === selected,
        }"
        :aria-label="dayLabel(day.date)"
        :aria-pressed="day.date === selected"
        :aria-current="day.date === today ? 'date' : undefined"
        aria-haspopup="menu"
        @contextmenu.prevent="openMenu($event, day.date)"
        @keydown.shift.f10.prevent="openMenu($event, day.date)"
        @click="
          closeMenu();
          emit('select', day.date);
        "
      >
        <span>{{ day.day }}</span
        ><span
          v-if="scheduledDates.has(day.date)"
          class="schedule-dot absolute bottom-[5px] left-[calc(50%-2px)] inline-block size-1 rounded-full"
          :class="
            day.date === selected
              ? 'bg-(--color-schedule-dot-selected)'
              : 'bg-(--color-accent)'
          "
          aria-hidden="true"
        ></span>
      </button>
    </div>
    <div
      class="calendar-legend mt-4 flex flex-wrap items-center gap-3.5 text-sm text-(--color-text-muted) [&>span]:flex [&>span]:items-center [&>span]:gap-1.5"
    >
      <span
        ><i
          class="schedule-dot inline-block size-1 rounded-full bg-(--color-accent)"
        ></i>
        Scheduled workout</span
      ><span
        ><i
          class="today-marker size-[9px] rounded-[3px] border border-(--color-accent-strong)"
        ></i>
        Today</span
      >
    </div>
    <p class="hint text-[15px] leading-[1.6] text-(--color-text-muted)">
      Select a date to view it. Right-click a date for workout actions.
    </p>
    <button
      class="small-button px-2.5 py-[7px]"
      :disabled="disabled"
      aria-haspopup="menu"
      @click="openMenu($event, selected)"
    >
      Actions for selected day
    </button>
    <Teleport to="body"
      ><div
        v-if="menu"
        ref="menuElement"
        class="calendar-context-menu fixed z-[1000] max-h-[calc(100vh-16px)] w-[244px] overflow-y-auto rounded-xl border border-(--color-border-menu) bg-(--glass-menu) p-2 shadow-[0_12px_40px_var(--color-shadow-menu)] [&_p]:mx-2 [&_p]:mt-1 [&_p]:mb-2 [&_p]:text-xs [&_p]:text-(--color-text-muted) [&_button]:block [&_button]:w-full [&_button]:border-0 [&_button]:p-2.5 [&_button]:text-left [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-(--color-accent-strong) [&_button:focus-visible]:outline-offset-[-2px]"
        role="menu"
        :aria-label="`Workout actions for ${formatDate(menu.date)}`"
        :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
        @keydown="menuKeys"
      >
        <p>{{ formatDate(menu.date) }}</p>
        <button role="menuitem" @click="act('view')">View day</button>
        <button v-if="!menuSchedule" role="menuitem" @click="act('create')">
          Schedule a workout
        </button>
        <template v-else>
          <button role="menuitem" @click="act('start')">Start workout</button>
          <button role="menuitem" @click="act('schedule')">
            Edit scheduled workout
          </button>
          <button role="menuitem" @click="act('edit')">
            Edit workout routine
          </button>
          <button role="menuitem" @click="act('frequency')">
            Change repeat frequency
          </button>
          <button
            role="menuitem"
            class="delete text-(--color-danger)"
            @click="act('delete')"
          >
            Remove scheduled workout
          </button>
        </template>
      </div></Teleport
    >
  </section>
</template>
