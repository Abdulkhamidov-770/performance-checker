import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', redirect: '/projects' },
  {
    path: '/projects',
    name: 'projects',
    component: () => import('../views/Projects.vue'),
    meta: { title: 'Loyihalar' },
  },
  {
    path: '/projects/:id/scan',
    name: 'scan',
    component: () => import('../views/Scan.vue'),
    meta: { title: 'Skan' },
    props: true,
  },
  {
    path: '/projects/:id/history',
    name: 'history',
    component: () => import('../views/History.vue'),
    meta: { title: 'Tarix' },
    props: true,
  },
  {
    path: '/jobs/:jobId',
    name: 'job',
    component: () => import('../views/Job.vue'),
    meta: { title: 'Job' },
    props: true,
  },
  {
    path: '/reports/:scanId',
    name: 'report',
    component: () => import('../views/Report.vue'),
    meta: { title: 'Hisobot' },
    props: true,
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/Settings.vue'),
    meta: { title: 'Sozlamalar' },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
