import { createRouter, createWebHistory } from 'vue-router';
// RULE: vue/no-sync-route-import
import Dashboard from './views/Dashboard.vue';
import Profile from './views/Profile.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/dashboard', component: Dashboard },
    { path: '/profile', component: Profile },
  ],
});
