<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const navs = [
  { path: "/", label: "对话" },
  { path: "/memories", label: "记忆" },
  { path: "/kb", label: "知识库" },
  { path: "/microservices", label: "微服务" },
];

async function onLogout() {
  await auth.logout();
  router.push("/login");
}
</script>

<template>
  <div class="flex h-full flex-col bg-gray-50">
    <header
      class="flex h-12 shrink-0 items-center gap-6 border-b border-gray-200 bg-white px-4"
    >
      <span class="font-semibold text-gray-800">DeepAgents</span>
      <nav class="flex gap-1">
        <router-link
          v-for="n in navs"
          :key="n.path"
          :to="n.path"
          class="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
          :class="{ 'bg-gray-100 text-blue-600': route.path === n.path }"
        >
          {{ n.label }}
        </router-link>
      </nav>
      <div class="ml-auto flex items-center gap-2">
        <span class="text-sm text-gray-600">{{ auth.account }}</span>
        <el-tag v-if="auth.isSuper" size="small" type="warning">super</el-tag>
        <el-dropdown @command="(c: string) => c === 'logout' && onLogout()">
          <el-button size="small" text>账号</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>
    <main class="min-h-0 flex-1">
      <router-view />
    </main>
  </div>
</template>
