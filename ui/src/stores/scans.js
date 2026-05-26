import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../composables/useApi';

export const useScansStore = defineStore('scans', () => {
  const items = ref([]);
  const loading = ref(false);

  async function fetchAll(projectId) {
    loading.value = true;
    try {
      const q = projectId ? `?projectId=${projectId}` : '';
      items.value = await api.get('/scans' + q);
    } finally {
      loading.value = false;
    }
  }

  async function start(payload) {
    return await api.post('/scans', payload);
  }

  async function cancel(jobId) {
    return await api.post(`/scans/${jobId}/cancel`);
  }

  async function getScan(id) {
    return await api.get(`/scans/${id}`);
  }

  return { items, loading, fetchAll, start, cancel, getScan };
});
