import { computed, nextTick, onDeactivated, ref, watch } from 'vue';

export function readingBoundary(reader, direction) {
  return Boolean(reader && (direction < 0 ? reader.scrollTop <= 2 : reader.scrollTop + reader.clientHeight >= reader.scrollHeight - 2));
}

export function useMuscleReader(reader, getIds) {
  const activeId = ref(getIds()[0] ?? null);
  const position = computed(() => getIds().indexOf(activeId.value));
  const hasPrevious = computed(() => position.value > 0);
  const hasNext = computed(() => position.value >= 0 && position.value < getIds().length - 1);
  let lockedUntil = 0, wheelTotal = 0, lastWheel = 0, touch;
  async function select(id, atEnd = false) {
    if (!getIds().includes(id)) return;
    activeId.value = id;
    wheelTotal = 0;
    await nextTick();
    if (!reader.value) return;
    reader.value.scrollTop = atEnd ? reader.value.scrollHeight : 0;
    reader.value.focus({ preventScroll: true });
  }
  function move(direction, atEnd = false) {
    const id = getIds()[position.value + direction];
    if (id == null) return false;
    lockedUntil = Date.now() + 750;
    select(id, atEnd);
    return true;
  }
  function wheel(event) {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    const direction = Math.sign(event.deltaY);
    if (!readingBoundary(reader.value, direction)) { wheelTotal = 0; return; }
    if (!(direction > 0 ? hasNext.value : hasPrevious.value)) return;
    event.preventDefault();
    const now = Date.now();
    if (now < lockedUntil) return;
    if (now - lastWheel > 180 || Math.sign(wheelTotal) !== direction) wheelTotal = 0;
    lastWheel = now;
    wheelTotal += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? reader.value.clientHeight : 1);
    if (Math.abs(wheelTotal) >= 64) move(direction, direction < 0);
  }
  function keydown(event) {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = ['ArrowDown', 'PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey) ? 1
      : ['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey) ? -1 : 0;
    if (direction && readingBoundary(reader.value, direction) && move(direction, direction < 0)) event.preventDefault();
  }
  function touchstart(event) {
    const finger = event.touches[0];
    touch = finger ? { y: finger.clientY, top: readingBoundary(reader.value, -1), bottom: readingBoundary(reader.value, 1) } : null;
  }
  function touchend(event) {
    const finger = event.changedTouches[0];
    if (!touch || !finger) return;
    const delta = touch.y - finger.clientY;
    if (Date.now() >= lockedUntil && Math.abs(delta) >= 56 && (delta > 0 ? touch.bottom : touch.top)) move(Math.sign(delta), delta < 0);
    touch = null;
  }
  watch(getIds, async ids => {
    if (!ids.includes(activeId.value)) {
      activeId.value = ids[0] ?? null;
      await nextTick();
      if (reader.value) reader.value.scrollTop = 0;
    }
  });
  onDeactivated(() => { lockedUntil = 0; wheelTotal = 0; touch = null; });
  return { activeId, position, hasPrevious, hasNext, select, move, wheel, keydown, touchstart, touchend };
}
