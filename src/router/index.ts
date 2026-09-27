import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: () => import("../views/LoginView.vue") },
    {
      path: "/",
      component: () => import("../layouts/MainLayout.vue"),
      children: [
        { path: "", component: () => import("../views/ChatView.vue") },
        {
          path: "memories",
          component: () => import("../views/MemoriesView.vue"),
        },
        { path: "kb", component: () => import("../views/KbView.vue") },
        {
          path: "microservices",
          component: () => import("../views/MicroservicesView.vue"),
        },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.boot();
  if (to.path === "/login") return auth.user ? "/" : true;
  if (!auth.user) return { path: "/login", query: { redirect: to.fullPath } };
  return true;
});

// is_super 每次导航现查：改库后无需重新登录
router.afterEach(() => {
  void useAuthStore().refreshMe();
});

export default router;
