import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../composables/useApi';

export const useProjectsStore = defineStore('projects', () => {
  const items = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function fetchAll() {
    loading.value = true;
    error.value = null;
    try {
      items.value = await api.get('/projects');
    } catch (e) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  async function create(data) {
    const created = await api.post('/projects', data);
    items.value.unshift(created);
    return created;
  }

  async function update(id, data) {
    const updated = await api.put(`/projects/${id}`, data);
    const idx = items.value.findIndex(p => p.id === id);
    if (idx !== -1) items.value[idx] = updated;
    return updated;
  }

  async function remove(id) {
    await api.del(`/projects/${id}`);
    items.value = items.value.filter(p => p.id !== id);
  }

  function getById(id) {
    return items.value.find(p => p.id === Number(id));
  }

  return { items, loading, error, fetchAll, create, update, remove, getById };
});
