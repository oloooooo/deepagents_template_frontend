<script setup lang="ts">
import { ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import * as chat from "../../api/chat";
import type { ChatStateOut } from "../../api/chat";
import { HttpError } from "../../api/http";

const props = defineProps<{ threadId: string | null }>();
const open = defineModel<boolean>({ default: false });

const files = ref<string[]>([]);
const loading = ref(false);

async function load() {
  if (!props.threadId) return;
  loading.value = true;
  try {
    const s: ChatStateOut = await chat.state(props.threadId);
    files.value = s.files;
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  } finally {
    loading.value = false;
  }
}

watch([open, () => props.threadId], ([o]) => {
  if (o) void load();
});

async function removeFile(path: string) {
  if (!props.threadId) return;
  try {
    await ElMessageBox.confirm(`删除会话文件 ${path}？`, "删除", {
      type: "warning",
    });
  } catch {
    return;
  }
  try {
    await chat.deleteFiles(props.threadId, [path]);
    ElMessage.success("已删除");
    await load();
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  }
}
</script>

<template>
  <el-drawer v-model="open" title="会话文件（短期记忆）" size="24rem">
    <div v-loading="loading" class="flex flex-col gap-2">
      <p v-if="!files.length" class="text-sm text-gray-400">
        这个会话还没有临时文件
      </p>
      <div
        v-for="f in files"
        :key="f"
        class="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm"
      >
        <span class="truncate" :title="f">{{ f }}</span>
        <el-button size="small" text type="danger" @click="removeFile(f)"
          >删除</el-button
        >
      </div>
    </div>
  </el-drawer>
</template>
