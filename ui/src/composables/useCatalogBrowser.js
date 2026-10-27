import { computed, ref } from 'vue';
export function useCatalogBrowser(items, matches = () => true) {
  const search = ref('');
  const sort = ref('asc');
  const layout = ref('grid');
  const visible = computed(() =>
    items.value
      .filter(
        (item) =>
          (item.name || item['equipment-type'] || '')
            .toLowerCase()
            .includes(search.value.trim().toLowerCase()) && matches(item)
      )
      .sort((a, b) => {
        if (sort.value === 'muscle')
          return (
            (a.primaryGroupName || '').localeCompare(
              b.primaryGroupName || ''
            ) || a.name.localeCompare(b.name)
          );
        return (a.name || a['equipment-type'] || '').localeCompare(
          b.name || b['equipment-type'] || ''
        );
      })
  );
  return { search, sort, layout, visible };
}
