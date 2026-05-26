<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectsStore } from '../stores/projects';
import {
  Plus, Folder, Globe, Trash2, Edit3, PlayCircle, History as HistoryIcon, Chrome,
} from 'lucide-vue-next';
import ProjectFormModal from '../components/ProjectFormModal.vue';

const router = useRouter();
const store = useProjectsStore();
const showModal = ref(false);
const editing = ref(null);

onMounted(() => store.fetchAll());

function openCreate() {
  editing.value = null;
  showModal.value = true;
}
function openEdit(p) {
  editing.value = p;
  showModal.value = true;
}
async function handleSave(data) {
  if (editing.value) await store.update(editing.value.id, data);
  else await store.create(data);
  showModal.value = false;
}
async function handleDelete(p) {
  if (!confirm(`"${p.name}" loyihasini o'chirilsinmi?`)) return;
  await store.remove(p.id);
}
function startScan(p) {
  router.push(`/projects/${p.id}/scan`);
}
function viewHistory(p) {
  router.push(`/projects/${p.id}/history`);
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-5">
      <div>
        <p class="text-sm text-text-secondary">
          {{ store.items.length }} ta loyiha · Bir tugma bilan skan boshlang
        </p>
      </div>
      <button class="btn-primary" @click="openCreate">
        <Plus class="w-4 h-4" /> Yangi loyiha
      </button>
    </div>

    <div v-if="store.loading" class="text-text-secondary text-sm">Yuklanmoqda...</div>
    <div v-else-if="store.error" class="card text-critical text-sm">{{ store.error }}</div>

    <div v-else-if="store.items.length === 0" class="card text-center py-12">
      <Folder class="w-12 h-12 mx-auto text-text-muted mb-3" />
      <h3 class="text-text-primary font-medium mb-1">Loyihalar yo'q</h3>
      <p class="text-sm text-text-secondary mb-4">Birinchi loyihangizni qo'shing va skan boshlang</p>
      <button class="btn-primary mx-auto" @click="openCreate">
        <Plus class="w-4 h-4" /> Loyiha qo'shish
      </button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div v-for="p in store.items" :key="p.id"
        class="card hover:border-accent/40 transition-colors group">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-8 h-8 rounded-md bg-accent-subtle flex items-center justify-center shrink-0">
              <Folder class="w-4 h-4 text-accent" />
            </div>
            <div class="min-w-0">
              <h3 class="font-semibold text-text-primary truncate">{{ p.name }}</h3>
              <p class="text-xs text-text-muted truncate font-mono">{{ p.path }}</p>
            </div>
          </div>
          <div class="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <button class="btn-ghost p-1.5" @click="openEdit(p)" title="Edit">
              <Edit3 class="w-3.5 h-3.5" />
            </button>
            <button class="btn-ghost p-1.5 hover:text-critical" @click="handleDelete(p)" title="O'chirish">
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div class="space-y-2 mb-4 text-xs">
          <div class="flex items-center gap-2 text-text-secondary">
            <span class="badge-muted">{{ p.framework }}</span>
            <span class="badge-muted">{{ p.scenario }}</span>
            <span v-if="p.chrome_profile" class="badge-muted flex items-center gap-1">
              <Chrome class="w-3 h-3" /> {{ p.chrome_profile }}
            </span>
          </div>
          <div v-if="p.url" class="flex items-center gap-1.5 text-text-muted">
            <Globe class="w-3 h-3" />
            <span class="truncate">{{ p.url }}</span>
          </div>
        </div>

        <div class="flex gap-2">
          <button class="btn-primary flex-1 justify-center" @click="startScan(p)">
            <PlayCircle class="w-4 h-4" /> Skan
          </button>
          <button class="btn-secondary" @click="viewHistory(p)" title="Tarix">
            <HistoryIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <ProjectFormModal
      v-if="showModal"
      :editing="editing"
      @save="handleSave"
      @close="showModal = false"
    />
  </div>
</template>
