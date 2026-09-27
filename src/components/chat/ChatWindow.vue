<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import * as chat from "../../api/chat";
import type { ChatMessageOut } from "../../api/chat";
import { HttpError } from "../../api/http";
import FilesDrawer from "./FilesDrawer.vue";

const props = defineProps<{ threadId: string | null }>();
const emit = defineEmits<{
  created: [id: string];
  runningChange: [running: boolean];
}>();

const messages = ref<ChatMessageOut[]>([]);
const input = ref("");
const running = ref(false);
const approving = ref(false);
const drawerOpen = ref(false);
/** 中断（interrupt）：agent 在等人批准，这轮暂停 */
const pendingInterrupt = ref<{ text: string; data: unknown } | null>(null);

// 流式现场：interrupt 后冻结显示，等批准/停止收口
const liveVisible = computed(() => running.value || !!pendingInterrupt.value);
const liveText = ref("");
const liveTools = ref<string[]>([]);

const scrollRef = ref<HTMLElement | null>(null);
let abort: AbortController | null = null;
let seq = 0;

const threadLabel = computed(() =>
  props.threadId ? `#${props.threadId.slice(0, 8)}` : "新对话",
);

function scrollBottom() {
  nextTick(() => {
    scrollRef.value?.scrollTo({ top: scrollRef.value.scrollHeight });
  });
}

async function loadHistory(id: string) {
  const s = ++seq;
  try {
    const h = await chat.history(id);
    if (s === seq) {
      messages.value = h.messages;
      scrollBottom();
    }
  } catch (e) {
    if (e instanceof HttpError && e.status === 404)
      ElMessage.error("会话不存在或已被删除");
  }
}

watch(
  () => props.threadId,
  (id) => {
    pendingInterrupt.value = null;
    if (id) void loadHistory(id);
    else messages.value = [];
  },
  { immediate: true },
);

watch([messages, liveText], scrollBottom);

function showError(e: unknown) {
  if (!(e instanceof HttpError)) return;
  if (e.status === 409) ElMessage.warning("这一轮还在跑，请先停止");
  else ElMessage.error(e.message);
}

async function send() {
  const text = input.value.trim();
  if (!text || running.value || pendingInterrupt.value) return;
  input.value = "";
  running.value = true;
  emit("runningChange", true);
  liveText.value = "";
  liveTools.value = [];
  abort = new AbortController();
  const optimistic = !props.threadId;
  if (optimistic) {
    messages.value = [
      ...messages.value,
      { id: `tmp-${Date.now()}`, role: "human", content: text },
    ];
  }
  let newId: string | null = null;
  try {
    await chat.streamChat(
      text,
      props.threadId,
      {
        onThread: (id) => {
          newId = id;
          emit("created", id);
        },
        onToken: (t) => {
          liveText.value += t;
        },
        onToolCall: (t) => {
          liveTools.value.push(t);
        },
        onInterrupt: (t, data) => {
          pendingInterrupt.value = { text: t, data };
        },
      },
      abort.signal,
    );
  } catch (e) {
    if ((e as Error).name !== "AbortError") showError(e);
  } finally {
    running.value = false;
    emit("runningChange", false);
    abort = null;
    const id = newId ?? props.threadId;
    // 收口：一律从服务端历史取数，乐观消息不落地就回滚
    if (id) await loadHistory(id);
    else
      messages.value = messages.value.filter((m) => !m.id.startsWith("tmp-"));
    scrollBottom();
  }
}

async function stopTurn() {
  const id = props.threadId;
  if (!id) {
    abort?.abort();
    return;
  }
  abort?.abort();
  abort = null;
  try {
    await chat.stop(id); // 幂等：收尾文本由服务端写进历史
  } catch (e) {
    showError(e);
  }
  running.value = false;
  emit("runningChange", false);
  pendingInterrupt.value = null;
  await loadHistory(id);
}

async function onDecision(type: "approve" | "reject") {
  const id = props.threadId;
  if (!id) return;
  approving.value = true;
  try {
    const run = await chat.approve(id, type);
    pendingInterrupt.value = run.interrupt
      ? { text: "", data: run.interrupt }
      : null;
    await loadHistory(id);
  } catch (e) {
    showError(e);
  } finally {
    approving.value = false;
  }
}

async function removeMessage(m: ChatMessageOut) {
  if (!props.threadId) return;
  try {
    await ElMessageBox.confirm("删除这条消息？删完还能继续聊。", "删除", {
      type: "warning",
    });
  } catch {
    return;
  }
  try {
    await chat.deleteMessages(props.threadId, [m.id]);
    await loadHistory(props.threadId);
  } catch (e) {
    showError(e);
  }
}

function pretty(data: unknown) {
  return JSON.stringify(data, null, 2);
}
</script>

<template>
  <div class="flex h-full min-w-0 flex-col bg-white">
    <!-- 头部 -->
    <div
      class="flex h-11 shrink-0 items-center gap-2 border-b border-gray-200 px-4"
    >
      <span class="text-sm font-medium text-gray-700">{{ threadLabel }}</span>
      <div class="ml-auto flex gap-2">
        <el-button
          size="small"
          :disabled="!threadId"
          @click="drawerOpen = true"
        >
          会话文件
        </el-button>
        <el-button
          size="small"
          type="danger"
          plain
          :disabled="!running"
          @click="stopTurn"
        >
          停止
        </el-button>
      </div>
    </div>

    <!-- 消息区 -->
    <div ref="scrollRef" class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div
        v-if="!messages.length && !liveVisible"
        class="flex h-full items-center justify-center text-sm text-gray-400"
      >
        发送消息开始一轮对话；agent 会自动拿到你可见的微服务知识。
      </div>

      <div
        v-for="m in messages"
        :key="m.id"
        class="group mb-4 flex"
        :class="m.role === 'human' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[75%] rounded-lg px-3 py-2 text-sm"
          :class="[
            m.role === 'human'
              ? 'bg-blue-600 text-white'
              : m.role === 'tool'
                ? 'w-full bg-gray-50 font-mono text-xs text-gray-500'
                : 'bg-gray-100 text-gray-800',
          ]"
        >
          <pre class="whitespace-pre-wrap break-words [font-family:inherit]">{{
            m.content
          }}</pre>
          <div
            v-if="m.id && !m.id.startsWith('tmp-')"
            class="mt-1 text-right"
            :class="
              m.role === 'human'
                ? 'hidden group-hover:block'
                : 'opacity-0 group-hover:opacity-100'
            "
          >
            <el-button
              size="small"
              text
              :type="m.role === 'human' ? 'primary' : 'default'"
              @click="removeMessage(m)"
            >
              删除
            </el-button>
          </div>
        </div>
      </div>

      <!-- 流式现场 -->
      <div v-if="liveVisible" class="mb-4 flex justify-start">
        <div
          class="max-w-[75%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800"
        >
          <div
            v-for="(t, i) in liveTools"
            :key="i"
            class="mb-1 font-mono text-xs text-gray-500"
          >
            🔧 {{ t }}
          </div>
          <span>{{ liveText }}</span>
          <span
            v-if="running && !liveText && !liveTools.length"
            class="text-gray-400"
            >思考中…</span
          >
        </div>
      </div>

      <!-- 中断审批卡片 -->
      <div
        v-if="pendingInterrupt"
        class="mb-4 max-w-[75%] rounded-lg border border-amber-300 bg-amber-50 p-3"
      >
        <p class="text-sm font-medium text-amber-800">
          本轮被中断，等待你的批准
        </p>
        <p v-if="pendingInterrupt.text" class="mt-1 text-sm text-amber-700">
          {{ pendingInterrupt.text }}
        </p>
        <details class="mt-1">
          <summary class="cursor-pointer text-xs text-amber-600">
            查看内容
          </summary>
          <pre
            class="mt-1 max-h-60 overflow-auto rounded bg-white p-2 text-xs text-gray-600"
            >{{ pretty(pendingInterrupt.data) }}</pre>
        </details>
        <div class="mt-2 flex gap-2">
          <el-button
            size="small"
            type="primary"
            :loading="approving"
            @click="onDecision('approve')"
          >
            批准
          </el-button>
          <el-button
            size="small"
            :loading="approving"
            @click="onDecision('reject')"
          >
            拒绝
          </el-button>
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="shrink-0 border-t border-gray-200 p-3">
      <el-input
        v-model="input"
        type="textarea"
        :rows="3"
        resize="none"
        :disabled="running || !!pendingInterrupt"
        :placeholder="
          pendingInterrupt
            ? '等待批准中…'
            : running
              ? '本轮运行中，可点击停止'
              : '输入消息，Enter 发送，Shift+Enter 换行'
        "
        @keydown.enter.exact.prevent="send"
      />
      <div class="mt-2 flex justify-end">
        <el-button
          type="primary"
          :disabled="running || !!pendingInterrupt || !input.trim()"
          :loading="running"
          @click="send"
        >
          发送
        </el-button>
      </div>
    </div>

    <FilesDrawer v-model="drawerOpen" :thread-id="threadId" />
  </div>
</template>
