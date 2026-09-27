<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import * as chat from "../api/chat";
import type { ChatThreadOut } from "../api/chat";
import { HttpError } from "../api/http";
import ChatWindow from "../components/chat/ChatWindow.vue";

const threads = ref<ChatThreadOut[]>([]);
const current = ref<string | null>(null);
const switching = ref(false);

async function loadThreads() {
  try {
    threads.value = (await chat.mine()).threads;
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  }
}

onMounted(loadThreads);

// 流式进行中不允许切换：现场属于原会话
async function select(id: string) {
  if (switching.value) return;
  current.value = id;
}

function onNew() {
  if (switching.value) return;
  current.value = null;
}

async function onCreated(id: string) {
  current.value = id;
  await loadThreads();
}

async function removeThread(t: ChatThreadOut) {
  try {
    await ElMessageBox.confirm(
      `删除会话 #${t.thread_id.slice(0, 8)}？只删短期记忆，长期记忆不受影响。`,
      "删除",
      {
        type: "warning",
      },
    );
  } catch {
    return;
  }
  try {
    await chat.deleteThread(t.thread_id);
    if (current.value === t.thread_id) current.value = null;
    await loadThreads();
    ElMessage.success("已删除");
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  }
}

function ago(iso?: string | null) {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "刚刚";
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  return `${Math.floor(s / 86400)} 天前`;
}
</script>

<template>
  <div class="flex h-full">
    <!-- 左侧会话栏 -->
    <aside
      class="flex w-72 shrink-0 flex-col border-r border-gray-200 bg-gray-50"
    >
      <div class="p-3">
        <el-button class="w-full" type="primary" plain @click="onNew"
          >＋ 新对话</el-button
        >
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <div
          v-for="t in threads"
          :key="t.thread_id"
          class="group mb-1 flex cursor-pointer items-center rounded px-3 py-2 text-sm"
          :class="
            current === t.thread_id
              ? 'bg-white shadow-sm ring-1 ring-blue-200'
              : 'hover:bg-white'
          "
          @click="select(t.thread_id)"
        >
          <div class="min-w-0 flex-1">
            <div class="truncate text-gray-800">
              #{{ t.thread_id.slice(0, 8) }}
            </div>
            <div class="text-xs text-gray-400">{{ ago(t.updated_at) }}</div>
          </div>
          <el-button
            class="hidden group-hover:inline-block"
            size="small"
            text
            type="danger"
            @click.stop="removeThread(t)"
          >
            删除
          </el-button>
        </div>
        <p v-if="!threads.length" class="px-3 py-2 text-xs text-gray-400">
          还没有会话
        </p>
      </div>
    </aside>

    <!-- 聊天窗 -->
    <div class="min-w-0 flex-1">
      <ChatWindow
        :thread-id="current"
        @created="onCreated"
        @running-change="(v) => (switching = v)"
      />
    </div>
  </div>
</template>
