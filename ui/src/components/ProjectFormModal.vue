<script setup>
import { reactive, onMounted, ref } from 'vue';
import { X, Loader2 } from 'lucide-vue-next';
import { api } from '../composables/useApi';

const props = defineProps({ editing: Object });
const emit = defineEmits(['save', 'close']);

const form = reactive({
  name: '',
  path: '',
  framework: 'auto',
  url: '',
  scenario: 'desktop',
  chrome_profile: '',
  user_data_dir: '',
  notes: '',
});

const chromeProfiles = ref([]);
const saving = ref(false);
const error = ref('');

onMounted(async () => {
  if (props.editing) Object.assign(form, props.editing);
  try {
    const data = await api.get('/chrome/profiles');
    chromeProfiles.value = data.profiles;
  } catch {}
});

async function save() {
  saving.value = true;
  error.value = '';
  try {
    const payload = { ...form };
    if (!payload.url) payload.url = '';
    if (!payload.chrome_profile) payload.chrome_profile = null;
    if (!payload.user_data_dir) payload.user_data_dir = null;
    if (!payload.notes) payload.notes = null;
    emit('save', payload);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    @click.self="$emit('close')">
    <div class="bg-bg-surface border border-bg-border rounded-lg w-full max-w-xl max-h-[90vh] overflow-auto shadow-2xl">
      <div class="flex items-center justify-between px-5 py-4 border-b border-bg-border">
        <h2 class="text-base font-semibold text-text-primary">
          {{ editing ? 'Loyihani tahrirlash' : 'Yangi loyiha' }}
        </h2>
        <button class="btn-ghost p-1.5" @click="$emit('close')">
          <X class="w-4 h-4" />
        </button>
      </div>

      <form @submit.prevent="save" class="p-5 space-y-4">
        <div>
          <label class="label">Nom *</label>
          <input v-model="form.name" required class="input" placeholder="Education App" />
        </div>

        <div>
          <label class="label">Loyiha yo'li *</label>
          <input v-model="form.path" required class="input font-mono text-xs"
            placeholder="C:\MyComp\vue-projects\my-app" />
          <p class="text-[11px] text-text-muted mt-1">Absolyut yo'l — yo'lda package.json bo'lishi kerak</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Framework</label>
            <select v-model="form.framework" class="select">
              <option value="auto">Auto-detect</option>
              <option value="vue">Vue</option>
              <option value="react">React</option>
            </select>
          </div>
          <div>
            <label class="label">Scenariy</label>
            <select v-model="form.scenario" class="select">
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile (throttled)</option>
              <option value="slow">Slow 3G</option>
            </select>
          </div>
        </div>

        <div>
          <label class="label">Runtime URL (ixtiyoriy)</label>
          <input v-model="form.url" type="url" class="input"
            placeholder="http://localhost:5173" />
          <p class="text-[11px] text-text-muted mt-1">Runtime/Lighthouse skan uchun ishlayotgan URL</p>
        </div>

        <div>
          <label class="label">Chrome profili (login uchun)</label>
          <select v-model="form.chrome_profile" class="select">
            <option value="">— Toza brauzer (login yo'q) —</option>
            <option v-for="p in chromeProfiles" :key="p.name" :value="p.name">
              {{ p.displayName }} ({{ p.name }})
            </option>
          </select>
          <p class="text-[11px] text-text-muted mt-1">
            OIDC/SSO login mavjud Chrome profilidan olinadi
          </p>
        </div>

        <div>
          <label class="label">Eslatma (ixtiyoriy)</label>
          <textarea v-model="form.notes" class="input" rows="2"
            placeholder="Bu loyiha haqida eslatma..." />
        </div>

        <div v-if="error" class="bg-critical/10 border border-critical/30 rounded-md px-3 py-2 text-xs text-critical">
          {{ error }}
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-bg-border">
          <button type="button" class="btn-secondary" @click="$emit('close')">Bekor qilish</button>
          <button type="submit" class="btn-primary" :disabled="saving">
            <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
            {{ editing ? 'Saqlash' : 'Yaratish' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
