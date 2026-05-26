<script setup>
import { useRouter } from 'vue-router';
import LiveLog from '../components/LiveLog.vue';

const props = defineProps({ jobId: { type: String, required: true } });
const router = useRouter();
</script>

<template>
  <LiveLog :job-id="jobId" :project-id="0"
    @done="(scanId) => router.push(`/reports/${scanId}`)" />
</template>
