import { createRouter, createWebHistory } from 'vue-router'
import SonnendachView from '@/views/SonnendachView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: SonnendachView,
    },
  ],
})

export default router
