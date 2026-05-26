<script setup>
import { ref, watch, nextTick, computed, onMounted } from 'vue';
import { useJobSocket } from '../composables/useJobSocket';
import { useScansStore } from '../stores/scans';
import {
  CheckCircle2, XCircle, Loader2, X, FileText, AlertCircle, Download, ArrowDown,
} from 'lucide-vue-next';

const props = defineProps({
  jobId: { type: String, required: true },
  projectId: { type: Number, required: true },
});
const emit = defineEmits(['done']);

const {
  logs, status, exitCode, summary, connected, error,
  reconnecting, reconnectAttempt,
} = useJobSocket(props.jobId);
const scans = useScansStore();
const logContainer = ref(null);
const autoScroll = ref(true);
const userScrolled = ref(false);

function isNearBottom() {
  const el = logContainer.value;
  if (!el) return true;
  const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
  return gap < 40;
}

function onScroll() {
  if (!logContainer.value) return;
  // Foydalanuvchi yuqoriga ketsa — auto-scroll'ni o'chiramiz
  if (!isNearBottom()) {
    userScrolled.value = true;
    autoScroll.value = false;
  } else if (userScrolled.value) {
    // Foydalanuvchi qaytib pastga keldi — auto-scroll'ni qaytaramiz
    userScrolled.value = false;
    autoScroll.value = true;
  }
}

function scrollToBottom() {
  if (!logContainer.value) return;
  logContainer.value.scrollTop = logContainer.value.scrollHeight;
  autoScroll.value = true;
  userScrolled.value = false;
}

watch(logs, () => {
  if (autoScroll.value) nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
}, { deep: true });

onMounted(() => {
  logContainer.value?.addEventListener('scroll', onScroll, { passive: true });
});

watch(status, (val) => {
  if (val === 'completed' || val === 'failed' || val === 'cancelled') {
    // 2s kutib report sahifaga o'tish
  }
});

const isRunning = computed(() => status.value === 'running');
const statusClass = computed(() => {
  if (status.value === 'completed') return 'text-success';
  if (status.value === 'failed') return 'text-critical';
  if (status.value === 'cancelled') return 'text-warning';
  return 'text-accent';
});
const statusLabel = computed(() => ({
  running: 'Ishlamoqda',
  completed: 'Bajarildi',
  failed: 'Xato',
  cancelled: 'Bekor qilindi',
}[status.value] || status.value));

async function cancel() {
  await scans.cancel(props.jobId);
}

function goToReport() {
  emit('done', props.jobId);
}

function downloadLog() {
  const text = logs.value.map(l => `[${l.stream}] ${l.text}`).join('');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${props.jobId}-log.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="space-y-4">
    <!-- Status bar -->
    <div class="card flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div :class="statusClass">
          <Loader2 v-if="isRunning" class="w-5 h-5 animate-spin" />
          <CheckCircle2 v-else-if="status === 'completed'" class="w-5 h-5" />
          <XCircle v-else-if="status === 'failed'" class="w-5 h-5" />
          <AlertCircle v-else class="w-5 h-5" />
        </div>
        <div>
          <div class="text-sm font-semibold text-text-primary">{{ statusLabel }}</div>
          <div class="text-xs text-text-muted font-mono">
            Job: {{ jobId }} · {{ logs.length }} log
            <span v-if="exitCode !== null"> · exit {{ exitCode }}</span>
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <button v-if="isRunning" class="btn-danger" @click="cancel">
          <X class="w-4 h-4" /> To'xtatish
        </button>
        <button v-if="status === 'completed' || status === 'failed'"
          class="btn-primary" @click="goToReport">
          <FileText class="w-4 h-4" /> Hisobotni ko'rish
        </button>
      </div>
    </div>

    <!-- Summary cards -->
    <div v-if="summary?.findings" class="grid grid-cols-4 gap-3">
      <div class="card text-center">
        <div class="text-xs text-text-secondary mb-1">Critical</div>
        <div class="text-2xl font-bold text-critical">{{ summary.findings.critical || 0 }}</div>
      </div>
      <div class="card text-center">
        <div class="text-xs text-text-secondary mb-1">Warning</div>
        <div class="text-2xl font-bold text-warning">{{ summary.findings.warning || 0 }}</div>
      </div>
      <div class="card text-center">
        <div class="text-xs text-text-secondary mb-1">Info</div>
        <div class="text-2xl font-bold text-info">{{ summary.findings.info || 0 }}</div>
      </div>
      <div class="card text-center">
        <div class="text-xs text-text-secondary mb-1">Lighthouse</div>
        <div class="text-2xl font-bold" :class="{
          'text-success': summary.lighthouse >= 90,
          'text-warning': summary.lighthouse >= 50 && summary.lighthouse < 90,
          'text-critical': summary.lighthouse < 50,
        }">{{ summary.lighthouse ?? '—' }}</div>
      </div>
    </div>

    <!-- Log -->
    <div class="card p-0 overflow-hidden relative">
      <div class="flex items-center justify-between px-4 py-2.5 border-b border-bg-border bg-bg-elevated">
        <div class="text-xs font-mono text-text-secondary flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full"
            :class="connected ? 'bg-success' : reconnecting ? 'bg-warning animate-pulse' : 'bg-text-muted'"></span>
          <span v-if="connected">Live stream</span>
          <span v-else-if="reconnecting">Qayta ulanmoqda ({{ reconnectAttempt }})...</span>
          <span v-else>Uzilgan</span>
        </div>
        <div class="flex items-center gap-3">
          <label class="text-xs text-text-secondary flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" v-model="autoScroll" class="accent-accent" />
            Auto-scroll
          </label>
          <button @click="downloadLog" class="btn-ghost p-1" title="Logni yuklash">
            <Download class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div ref="logContainer"
        class="h-96 overflow-y-auto p-3 bg-bg space-y-0 text-xs">
        <div v-if="!logs.length" class="text-text-muted text-center py-12">
          Log kutilmoqda...
        </div>
        <div v-for="(line, i) in logs" :key="i"
          class="log-line whitespace-pre-wrap break-words"
          :class="line.stream === 'err' ? 'log-err' : 'log-out'">{{ line.text }}</div>
      </div>
      <!-- "Pastga tushish" floating button (user scrolled up holatida) -->
      <button v-if="userScrolled" @click="scrollToBottom"
        class="absolute bottom-4 right-4 btn-primary shadow-lg !rounded-full !p-2"
        title="Eng pastga tushish">
        <ArrowDown class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
