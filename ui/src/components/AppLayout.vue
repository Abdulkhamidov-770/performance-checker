<script setup>
import { computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import {
  LayoutGrid, Activity, History, Settings, Zap,
} from 'lucide-vue-next';

const route = useRoute();
const nav = [
  { to: '/projects', label: 'Loyihalar', icon: LayoutGrid },
  { to: '/settings', label: 'Sozlamalar', icon: Settings },
];

const title = computed(() => route.meta.title || 'Performance Checker');
</script>

<template>
  <div class="flex min-h-screen bg-bg">
    <!-- Sidebar -->
    <aside class="w-60 bg-bg-surface border-r border-bg-border flex flex-col">
      <div class="px-5 py-5 border-b border-bg-border flex items-center gap-2">
        <div class="w-8 h-8 rounded-md bg-accent flex items-center justify-center">
          <Zap class="w-5 h-5 text-white" />
        </div>
        <div>
          <div class="font-semibold text-text-primary leading-tight">Perf Checker</div>
          <div class="text-[10px] text-text-muted uppercase tracking-wider">v2.0</div>
        </div>
      </div>
      <nav class="flex-1 px-2 py-3 space-y-0.5">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          :class="{ 'bg-accent-subtle text-text-primary border-l-2 border-accent pl-[10px]': route.path.startsWith(item.to) }"
        >
          <component :is="item.icon" class="w-4 h-4" />
          {{ item.label }}
        </RouterLink>
      </nav>
      <div class="px-4 py-3 border-t border-bg-border text-[11px] text-text-muted">
        AST-based static · Playwright runtime · Gemini/Claude AI
      </div>
    </aside>

    <!-- Main -->
    <main class="flex-1 flex flex-col min-w-0">
      <header class="bg-bg-surface border-b border-bg-border px-6 py-3.5 flex items-center justify-between">
        <div>
          <h1 class="text-base font-semibold text-text-primary">{{ title }}</h1>
        </div>
        <div class="text-xs text-text-muted font-mono">
          {{ new Date().toLocaleString('uz-UZ') }}
        </div>
      </header>
      <div class="flex-1 overflow-auto p-6">
        <slot />
      </div>
    </main>
  </div>
</template>
