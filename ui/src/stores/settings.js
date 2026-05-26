import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../composables/useApi';

export const useSettingsStore = defineStore('settings', () => {
  const items = ref({});
  const loading = ref(false);

  async function fetchAll() {
    loading.value = true;
    try {
      items.value = await api.get('/settings');
    } finally {
      loading.value = false;
    }
  }

  async function update(key, value) {
    await api.put('/settings', { key, value });
    await fetchAll();
  }

  async function remove(key) {
    await api.del(`/settings/${key}`);
    await fetchAll();
  }

  return { items, loading, fetchAll, update, remove };
});
