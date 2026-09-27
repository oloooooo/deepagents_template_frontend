<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { MdEditor } from "md-editor-v3";
import type { UploadRequestOptions } from "element-plus";
import * as memories from "../api/memories";
import { HttpError } from "../api/http";

const paths = ref<string[]>([]);
const selected = ref<string | null>(null);
const content = ref("");
const loading = ref(false);
const saving = ref(false);

function rel(p: string) {
  return p.replace(/^\/memories\//, "");
}

async function load() {
  try {
    paths.value = (await memories.all()).memories.sort();
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  }
}

onMounted(load);

async function openFile(p: string) {
  loading.value = true;
  try {
    const f = await memories.read(p);
    selected.value = f.path;
    content.value = f.content;
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  } finally {
    loading.value = false;
  }
}

async function createFile() {
  let p: string;
  try {
    p = await ElMessageBox.prompt(
      "新记忆的路径（如 prefs.md、notes/a.md）",
      "新建记忆",
      {
        inputPattern: /\S+/,
        inputErrorMessage: "路径不能为空",
      },
    );
  } catch {
    return;
  }
  selected.value = `/memories/${p.replace(/^\/+/, "")}`;
  content.value = "";
}

async function save() {
  if (!selected.value) return;
  saving.value = true;
  try {
    const r = await memories.write(selected.value, content.value);
    selected.value = r.path;
    ElMessage.success("已保存");
    await load();
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  } finally {
    saving.value = false;
  }
}

async function removeFile() {
  if (!selected.value) return;
  try {
    await ElMessageBox.confirm(`删除 ${rel(selected.value)}？`, "删除", {
      type: "warning",
    });
  } catch {
    return;
  }
  try {
    await memories.remove(selected.value);
    selected.value = null;
    content.value = "";
    await load();
    ElMessage.success("已删除");
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  }
}

async function doUpload({ file }: UploadRequestOptions) {
  try {
    const { results } = await memories.upload([file as File]);
    for (const r of results) {
      if (r.error) ElMessage.warning(`${r.file}：${r.error}`);
      else ElMessage.success(`${r.file} → ${r.path}`);
    }
    await load();
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  }
}
</script>

<template>
  <div class="flex h-full">
    <!-- 左：记忆清单 -->
    <aside
      class="flex w-80 shrink-0 flex-col border-r border-gray-200 bg-gray-50"
    >
      <div class="flex gap-2 p-3">
        <el-button size="small" type="primary" plain @click="createFile"
          >＋ 新建</el-button
        >
        <el-upload
          :show-file-list="false"
          :multiple="true"
          :http-request="doUpload"
        >
          <el-button size="small" plain>上传文本</el-button>
        </el-upload>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <div
          v-for="p in paths"
          :key="p"
          class="mb-1 cursor-pointer rounded px-3 py-1.5 text-sm"
          :class="
            selected === p
              ? 'bg-white shadow-sm ring-1 ring-blue-200'
              : 'hover:bg-white'
          "
          @click="openFile(p)"
        >
          <span class="text-gray-400">{{
            rel(p).includes("/")
              ? rel(p).slice(0, rel(p).lastIndexOf("/") + 1)
              : ""
          }}</span>
          <span class="text-gray-800">{{
            rel(p).slice(rel(p).lastIndexOf("/") + 1)
          }}</span>
        </div>
        <p v-if="!paths.length" class="px-3 py-2 text-xs text-gray-400">
          还没有记忆 —— 新建、上传，或让 agent 在对话中写入（需你批准）
        </p>
      </div>
    </aside>

    <!-- 右：编辑器 -->
    <div class="flex min-w-0 flex-1 flex-col">
      <div
        class="flex h-11 shrink-0 items-center gap-2 border-b border-gray-200 px-4"
      >
        <span class="truncate text-sm font-medium text-gray-700">
          {{ selected ? rel(selected) : "未选择" }}
        </span>
        <div class="ml-auto flex gap-2">
          <el-button
            size="small"
            type="primary"
            :disabled="!selected"
            :loading="saving"
            @click="save"
          >
            保存
          </el-button>
          <el-button
            size="small"
            type="danger"
            plain
            :disabled="!selected"
            @click="removeFile"
          >
            删除
          </el-button>
        </div>
      </div>
      <div v-if="selected" v-loading="loading" class="min-h-0 flex-1">
        <MdEditor v-model="content" language="zh-CN" class="h-full" />
      </div>
      <div
        v-else
        class="flex flex-1 items-center justify-center text-sm text-gray-400"
      >
        从左侧选择一份记忆，或新建 / 上传
      </div>
    </div>
  </div>
</template>
