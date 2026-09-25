import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import TabsPage from '@/views/TabsPage.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/splash' },
  { path: '/splash', component: () => import('@/views/SplashPage.vue') },
  { path: '/login', component: () => import('@/views/LoginPage.vue') },
  {
    path: '/app',
    component: TabsPage,
    children: [
      { path: '', redirect: '/app/home' },
      { path: 'home', component: () => import('@/views/HomePage.vue') },
      { path: 'scan', component: () => import('@/views/ScanPage.vue') },
      { path: 'history', component: () => import('@/views/HistoryPage.vue') },
    ],
  },
  { path: '/app/submit', component: () => import('@/views/SubmitPage.vue') },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
