import { computed, ref } from 'vue';
import { compareEquipment, workoutEquipmentKey } from '../utils/equipment.js';
export function useCatalogBrowser(items, matches = () => true) {
  const search = ref('');
  const sort = ref('asc');
  const layout = ref('grid');
  const visible = computed(() => items.value.filter(item =>
    (item.name || item['equipment-type'] || '').toLowerCase().includes(search.value.trim().toLowerCase()) && matches(item))
    .sort((a, b) => {
      if (sort.value === 'muscle') return (a.primaryGroupName || '').localeCompare(b.primaryGroupName || '') || a.name.localeCompare(b.name);
      if (sort.value === 'equipment') return a.exercises
        ? workoutEquipmentKey(a).localeCompare(workoutEquipmentKey(b)) || a.name.localeCompare(b.name)
        : compareEquipment(a, b);
      return sort.value === 'asc' ? (a.name || a['equipment-type'] || '').localeCompare(b.name || b['equipment-type'] || '') : (b.name || b['equipment-type'] || '').localeCompare(a.name || a['equipment-type'] || '');
    }));
  return { search, sort, layout, visible };
}

