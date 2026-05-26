<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectsStore } from '../stores/projects';
import { useScansStore } from '../stores/scans';
import { ArrowLeft, PlayCircle, Loader2, FileText } from 'lucide-vue-next';
import LiveLog from '../components/LiveLog.vue';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const projects = useProjectsStore();
const scans = useScansStore();

const project = computed(() => projects.getById(props.id));
const layers = ref(['static']);
const runs = ref(3);
const scenario = ref('desktop');
const jobId = ref(null);
const starting = ref(false);
const error = ref('');

onMounted(async () => {
  if (!projects.items.length) await projects.fetchAll();
  if (project.value?.scenario) scenario.value = project.value.scenario;
});

function toggleLayer(l) {
  const i = layers.value.indexOf(l);
  if (i === -1) layers.value.push(l);
  else layers.value.splice(i, 1);
}

async function startScan() {
  if (!project.value) return;
  starting.value = true;
  error.value = '';
  try {
    const result = await scans.start({
      projectId: project.value.id,
      layers: layers.value,
      scenario: scenario.value,
      runs: runs.value,
    });
    jobId.value = result.jobId;
  } catch (e) {
    error.value = e.message;
  } finally {
    starting.value = false;
  }
}

const canStart = computed(() => {
  if (!project.value) return false;
  if (!layers.value.length) return false;
  if (layers.value.includes('runtime') && !project.value.url) return false;
  return true;
});

const layerOptions = [
  { id: 'static',  label: 'Static analiz', desc: 'AST asosida lint + bundle + deps' },
  { id: 'runtime', label: 'Runtime',       desc: 'Playwright + Web Vitals + Lighthouse', requires: 'url' },
  { id: 'ai',      label: 'AI tahlil',     desc: 'Gemini/Claude grounded fix tavsiyalar' },
];
</script>

<template>
  <div v-if="!project" class="text-text-secondary">Loyiha topilmadi.</div>

  <div v-else class="space-y-6">
    <div class="flex items-center gap-3 mb-2">
      <button class="btn-ghost" @click="router.back()">
        <ArrowLeft class="w-4 h-4" />
      </button>
      <div>
        <h2 class="text-lg font-semibold text-text-primary">{{ project.name }}</h2>
        <p class="text-xs text-text-muted font-mono">{{ project.path }}</p>
      </div>
    </div>

    <!-- Scan form -->
    <div v-if="!jobId" class="card space-y-5">
      <div>
        <label class="label">Qatlamlar</label>
        <div class="space-y-2">
          <label v-for="opt in layerOptions" :key="opt.id"
            class="flex items-start gap-3 p-3 rounded-md border border-bg-border hover:border-accent/40 cursor-pointer transition-colors"
            :class="{ 'border-accent bg-accent-subtle': layers.includes(opt.id) }">
            <input type="checkbox" :checked="layers.includes(opt.id)"
              @change="toggleLayer(opt.id)" class="mt-0.5 accent-accent" />
            <div class="flex-1">
              <div class="font-medium text-sm text-text-primary">{{ opt.label }}</div>
              <div class="text-xs text-text-secondary">{{ opt.desc }}</div>
              <div v-if="opt.requires === 'url' && !project.url"
                class="text-[11px] text-warning mt-1">⚠ URL kerak (loyihani tahrirlang)</div>
            </div>
          </label>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label">Scenariy</label>
          <select v-model="scenario" class="select">
            <option value="desktop">Desktop</option>
            <option value="mobile">Mobile</option>
            <option value="slow">Slow 3G</option>
          </select>
        </div>
        <div>
          <label class="label">Runs (trimmed mean)</label>
          <input v-model.number="runs" type="number" min="1" max="10" class="input" />
        </div>
      </div>

      <div v-if="error" class="bg-critical/10 border border-critical/30 rounded-md px-3 py-2 text-xs text-critical">
        {{ error }}
      </div>

      <button class="btn-primary w-full justify-center py-2.5" @click="startScan" :disabled="!canStart || starting">
        <Loader2 v-if="starting" class="w-4 h-4 animate-spin" />
        <PlayCircle v-else class="w-4 h-4" />
        Skan boshlash
      </button>
    </div>

    <!-- Live log -->
    <LiveLog v-else :job-id="jobId" :project-id="project.id" @done="(scanId) => router.push(`/reports/${scanId}`)" />
  </div>
</template>
