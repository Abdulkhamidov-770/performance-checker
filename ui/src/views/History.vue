<script setup>
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectsStore } from '../stores/projects';
import { useScansStore } from '../stores/scans';
import { ArrowLeft, ExternalLink } from 'lucide-vue-next';
import { api } from '../composables/useApi';
import TrendChart from '../components/TrendChart.vue';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const projects = useProjectsStore();
const scans = useScansStore();
const snapshots = ref([]);

const project = computed(() => projects.getById(props.id));

onMounted(async () => {
  if (!projects.items.length) await projects.fetchAll();
  await scans.fetchAll(props.id);
  snapshots.value = await api.get(`/history/${props.id}`);
});

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('uz-UZ');
}
function fmtDuration(start, end) {
  if (!start || !end) return '—';
  const s = (new Date(end) - new Date(start)) / 1000;
  return s < 60 ? `${s.toFixed(0)}s` : `${(s / 60).toFixed(1)}m`;
}
function statusBadge(s) {
  return {
    completed: 'badge-success',
    running: 'badge-info',
    failed: 'badge-critical',
    cancelled: 'badge-warning',
  }[s] || 'badge-muted';
}
</script>

<template>
  <div v-if="!project" class="text-text-secondary">Loyiha topilmadi.</div>
  <div v-else class="space-y-6">
    <div class="flex items-center gap-3">
      <button class="btn-ghost" @click="router.back()"><ArrowLeft class="w-4 h-4" /></button>
      <div>
        <h2 class="text-lg font-semibold text-text-primary">{{ project.name }} — Tarix</h2>
        <p class="text-xs text-text-muted">{{ snapshots.length }} ta snapshot</p>
      </div>
    </div>

    <!-- Trend charts -->
    <div v-if="snapshots.length >= 2" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="card">
        <h3 class="text-sm font-semibold text-text-primary mb-3">Lighthouse Score</h3>
        <TrendChart :data="snapshots" field="lighthouse" :y-max="100" color="#10b981" />
      </div>
      <div class="card">
        <h3 class="text-sm font-semibold text-text-primary mb-3">LCP (ms)</h3>
        <TrendChart :data="snapshots" field="lcp" color="#f59e0b" />
      </div>
      <div class="card">
        <h3 class="text-sm font-semibold text-text-primary mb-3">Critical findings</h3>
        <TrendChart :data="snapshots" field="critical_count" color="#ef4444" />
      </div>
      <div class="card">
        <h3 class="text-sm font-semibold text-text-primary mb-3">Warning findings</h3>
        <TrendChart :data="snapshots" field="warning_count" color="#3b82f6" />
      </div>
    </div>

    <!-- Scans table -->
    <div class="card p-0 overflow-hidden">
      <div class="px-4 py-3 border-b border-bg-border">
        <h3 class="text-sm font-semibold text-text-primary">Skanlar</h3>
      </div>
      <table class="w-full text-sm">
        <thead class="bg-bg-elevated text-xs text-text-muted uppercase">
          <tr>
            <th class="text-left px-4 py-2 font-medium">Boshlangan</th>
            <th class="text-left px-4 py-2 font-medium">Qatlamlar</th>
            <th class="text-left px-4 py-2 font-medium">Holat</th>
            <th class="text-left px-4 py-2 font-medium">Davomiyligi</th>
            <th class="text-left px-4 py-2 font-medium">Findings</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in scans.items" :key="s.id"
            class="border-t border-bg-border hover:bg-bg-elevated/50">
            <td class="px-4 py-2.5 text-text-secondary text-xs font-mono">{{ fmtTime(s.started_at) }}</td>
            <td class="px-4 py-2.5">
              <span v-for="l in s.layers" :key="l" class="badge-muted mr-1">{{ l }}</span>
            </td>
            <td class="px-4 py-2.5">
              <span :class="statusBadge(s.status)">{{ s.status }}</span>
            </td>
            <td class="px-4 py-2.5 text-text-secondary text-xs">{{ fmtDuration(s.started_at, s.finished_at) }}</td>
            <td class="px-4 py-2.5 text-xs">
              <span v-if="s.result_summary?.findings" class="space-x-1">
                <span v-if="s.result_summary.findings.critical" class="badge-critical">{{ s.result_summary.findings.critical }}</span>
                <span v-if="s.result_summary.findings.warning" class="badge-warning">{{ s.result_summary.findings.warning }}</span>
                <span v-if="s.result_summary.findings.info" class="badge-info">{{ s.result_summary.findings.info }}</span>
              </span>
              <span v-else class="text-text-muted">—</span>
            </td>
            <td class="px-4 py-2.5 text-right">
              <button v-if="s.status === 'completed'" class="btn-ghost p-1.5"
                @click="router.push(`/reports/${s.id}`)" title="Hisobot">
                <ExternalLink class="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
          <tr v-if="!scans.items.length">
            <td colspan="6" class="text-center text-text-muted py-8 text-sm">
              Skanlar yo'q. Birinchi skan boshlang.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
