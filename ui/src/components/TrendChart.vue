<script setup>
import { Line } from 'vue-chartjs';
import {
  Chart, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler,
} from 'chart.js';
import { computed } from 'vue';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const props = defineProps({
  data: { type: Array, required: true },
  field: { type: String, required: true },
  color: { type: String, default: '#6366f1' },
  yMax: { type: Number, default: null },
});

const chartData = computed(() => ({
  labels: props.data.map(d => new Date(d.taken_at).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' })),
  datasets: [{
    data: props.data.map(d => d[props.field]),
    borderColor: props.color,
    backgroundColor: props.color + '20',
    fill: true,
    tension: 0.3,
    pointRadius: 3,
    pointBackgroundColor: props.color,
    borderWidth: 2,
  }],
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      ticks: { color: '#5d6675', font: { size: 10 } },
      grid: { color: '#1f2632' },
    },
    y: {
      ticks: { color: '#5d6675', font: { size: 10 } },
      grid: { color: '#1f2632' },
      beginAtZero: true,
      max: props.yMax || undefined,
    },
  },
}));
</script>

<template>
  <div class="h-48">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>
