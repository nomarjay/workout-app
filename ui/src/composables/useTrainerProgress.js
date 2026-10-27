import { ref } from 'vue';

export function useTrainerProgress(assignments) {
  const activeIndex = ref(0);
  const completed = ref([]);
  function markDirty(index) {
    completed.value = completed.value.filter((item) => item !== index);
  }
  function completeExercise(index) {
    if (!completed.value.includes(index))
      completed.value = [...completed.value, index];
    const next = assignments.value.findIndex(
      (item) => !completed.value.includes(item.exerciseIndex)
    );
    activeIndex.value = next < 0 ? null : next;
  }
  function resetProgress() {
    completed.value = [];
    if (activeIndex.value === null) activeIndex.value = 0;
  }
  return { activeIndex, completed, markDirty, completeExercise, resetProgress };
}
