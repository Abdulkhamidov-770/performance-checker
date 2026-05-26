<script setup>
import { onMounted, ref } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { Key, Save, Trash2, Eye, EyeOff } from 'lucide-vue-next';

const store = useSettingsStore();
const editing = ref({});
const showValue = ref({});

const apiKeys = [
  { key: 'GEMINI_API_KEY', label: 'Google Gemini API Key', hint: 'AIza... · aistudio.google.com da bepul olinadi' },
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic Claude API Key', hint: 'sk-ant-... · console.anthropic.com' },
];

onMounted(() => store.fetchAll());

async function save(key) {
  const value = editing.value[key];
  if (!value) return;
  await store.update(key, value);
  editing.value[key] = '';
}
async function clear(key) {
  if (!confirm(`${key} ni o'chirilsinmi?`)) return;
  await store.remove(key);
}
</script>

<template>
  <div class="max-w-2xl space-y-6">
    <div>
      <h2 class="text-base font-semibold text-text-primary mb-1">API Keylar</h2>
      <p class="text-sm text-text-secondary">AI qatlam (Layer 3) uchun kerak. Lokal SQLite ga saqlanadi.</p>
    </div>

    <div class="space-y-3">
      <div v-for="k in apiKeys" :key="k.key" class="card space-y-2">
        <div class="flex items-center gap-2">
          <Key class="w-4 h-4 text-text-secondary" />
          <h3 class="text-sm font-medium text-text-primary">{{ k.label }}</h3>
          <span v-if="store.items[k.key]?.hasValue" class="badge-success">O'rnatildi</span>
          <span v-else class="badge-muted">Bo'sh</span>
          <span v-if="store.items[k.key]?.fromEnv" class="badge-info ml-1">env</span>
        </div>
        <p class="text-xs text-text-muted">{{ k.hint }}</p>
        <div v-if="store.items[k.key]?.hasValue" class="text-xs font-mono text-text-secondary">
          {{ store.items[k.key].value }}
        </div>
        <div class="flex gap-2 mt-2">
          <div class="relative flex-1">
            <input :type="showValue[k.key] ? 'text' : 'password'"
              v-model="editing[k.key]" class="input pr-9 font-mono text-xs"
              :placeholder="`Yangi ${k.label}`" />
            <button type="button" @click="showValue[k.key] = !showValue[k.key]"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
              <component :is="showValue[k.key] ? EyeOff : Eye" class="w-3.5 h-3.5" />
            </button>
          </div>
          <button class="btn-primary" @click="save(k.key)" :disabled="!editing[k.key]">
            <Save class="w-3.5 h-3.5" /> Saqlash
          </button>
          <button v-if="store.items[k.key]?.hasValue && !store.items[k.key]?.fromEnv"
            class="btn-ghost hover:text-critical" @click="clear(k.key)">
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
