<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useAuthStore } from "../stores/auth";
import { HttpError } from "../api/http";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const mode = ref<"login" | "register">("login");
const account = ref("");
const email = ref("");
const password = ref("");
const loading = ref(false);

function errMsg(e: unknown) {
  return e instanceof HttpError ? e.message : "网络错误，请检查后端是否启动";
}

async function submit() {
  if (!account.value || !password.value) return;
  loading.value = true;
  try {
    if (mode.value === "login") {
      await auth.login(account.value, password.value);
    } else {
      if (!email.value) return ElMessage.warning("请填写邮箱");
      await auth.register(account.value, email.value, password.value);
      // 注册成功直接登录
      await auth.login(account.value, password.value);
    }
    const redirect = (route.query.redirect as string) || "/";
    router.push(redirect);
  } catch (e) {
    ElMessage.error(errMsg(e));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex h-full items-center justify-center bg-gray-100">
    <el-card class="w-96">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-semibold">DeepAgents</span>
          <el-radio-group v-model="mode" size="small">
            <el-radio-button value="login">登录</el-radio-button>
            <el-radio-button value="register">注册</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="账号">
          <el-input
            v-model="account"
            placeholder="账号（登录也支持邮箱）"
            autocomplete="username"
          />
        </el-form-item>
        <el-form-item v-if="mode === 'register'" label="邮箱">
          <el-input v-model="email" placeholder="邮箱" type="email" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="password"
            placeholder="密码（注册需 8 位以上）"
            type="password"
            autocomplete="current-password"
            show-password
          />
        </el-form-item>
        <el-button
          class="w-full"
          type="primary"
          native-type="submit"
          :loading="loading"
        >
          {{ mode === "login" ? "登录" : "注册并登录" }}
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>
