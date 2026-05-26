import { defineStore } from 'pinia';
import { ref } from 'vue';
import { nanoid as gen } from '@vueuse/core';

let counter = 0;
function nextId() {
  return `toast-${++counter}-${Date.now()}`;
}

export const useToastStore = defineStore('toast', () => {
  const items = ref([]);

  function show(message, options = {}) {
    const toast = {
      id: nextId(),
      type: options.type || 'info', // success | error | warning | info
      title: options.title || null,
      message,
      duration: options.duration ?? 4000,
    };
    items.value.push(toast);
    if (toast.duration > 0) {
      setTimeout(() => dismiss(toast.id), toast.duration);
    }
    return toast.id;
  }

  function success(message, options) { return show(message, { ...options, type: 'success' }); }
  function error(message, options) { return show(message, { ...options, type: 'error', duration: 6000 }); }
  function warning(message, options) { return show(message, { ...options, type: 'warning' }); }
  function info(message, options) { return show(message, { ...options, type: 'info' }); }

  function dismiss(id) {
    const i = items.value.findIndex(t => t.id === id);
    if (i !== -1) items.value.splice(i, 1);
  }

  return { items, show, success, error, warning, info, dismiss };
});
