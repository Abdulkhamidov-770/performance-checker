<script setup>
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, FileText, ExternalLink, AlertCircle, AlertTriangle, Info } from 'lucide-vue-next';
import { api } from '../composables/useApi';

const props = defineProps({ scanId: { type: String, required: true } });
const router = useRouter();
const report = ref(null);
const findings = ref([]);
const loading = ref(true);
const error = ref('');
const activeFile = ref(null);

onMounted(async () => {
  try {
    report.value = await api.get(`/reports/${props.scanId}`);
    const data = await api.get(`/reports/${props.scanId}/findings`);
    findings.value = data.findings || [];
    // birinchi HTML faylni avtomatik tanlash
    const html = report.value.files.find(f => f.ext === 'html');
    if (html) activeFile.value = html;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});

const grouped = computed(() => {
  const g = { critical: [], warning: [], info: [] };
  for (const f of findings.value) {
    (g[f.severity] || g.info).push(f);
  }
  return g;
});

const severityIcon = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button class="btn-ghost" @click="router.back()"><ArrowLeft class="w-4 h-4" /></button>
        <div>
          <h2 class="text-lg font-semibold text-text-primary">Hisobot</h2>
          <p class="text-xs text-text-muted font-mono">{{ scanId }}</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button v-for="f in report?.files?.filter(f => f.ext === 'html') || []" :key="f.url"
          class="btn-secondary"
          @click="activeFile = f">
          <FileText class="w-3.5 h-3.5" /> {{ f.name }}
        </button>
        <a v-if="activeFile" :href="activeFile.url" target="_blank" class="btn-ghost">
          <ExternalLink class="w-3.5 h-3.5" />
        </a>
      </div>
    </div>

    <div v-if="loading" class="text-text-secondary text-sm">Yuklanmoqda...</div>
    <div v-else-if="error" class="card text-critical">{{ error }}</div>

    <div v-else class="grid grid-cols-12 gap-4">
      <!-- Findings panel -->
      <div class="col-span-12 lg:col-span-4 space-y-3 max-h-[80vh] overflow-y-auto">
        <div v-for="severity in ['critical', 'warning', 'info']" :key="severity">
          <h3 class="text-xs font-medium uppercase tracking-wide mb-2"
            :class="{
              'text-critical': severity === 'critical',
              'text-warning': severity === 'warning',
              'text-info': severity === 'info',
            }">
            {{ severity }} ({{ grouped[severity].length }})
          </h3>
          <div v-for="f in grouped[severity]" :key="f.file + f.line + f.rule"
            class="card p-3 mb-2 hover:border-accent/40 cursor-pointer">
            <div class="flex items-start gap-2">
              <component :is="severityIcon[severity]" class="w-3.5 h-3.5 mt-0.5 shrink-0"
                :class="{
                  'text-critical': severity === 'critical',
                  'text-warning': severity === 'warning',
                  'text-info': severity === 'info',
                }" />
              <div class="min-w-0 flex-1">
                <div class="text-xs font-mono text-text-secondary mb-0.5">{{ f.rule }}</div>
                <div class="text-sm text-text-primary mb-1">{{ f.message }}</div>
                <div v-if="f.file" class="text-[11px] text-text-muted font-mono truncate">
                  {{ f.file }}<span v-if="f.line">:{{ f.line }}</span>
                </div>
                <div v-if="f.fix" class="text-xs text-success mt-1">💡 {{ f.fix }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!findings.length" class="card text-center py-6 text-text-muted text-sm">
          Findings yo'q
        </div>
      </div>

      <!-- HTML iframe -->
      <div class="col-span-12 lg:col-span-8">
        <div v-if="activeFile" class="card p-0 overflow-hidden h-[80vh]">
          <iframe :src="activeFile.url" class="w-full h-full bg-white" />
        </div>
        <div v-else class="card text-center py-12 text-text-muted">
          HTML hisobot mavjud emas
        </div>
      </div>
    </div>
  </div>
</template>
