<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { MdEditor } from "md-editor-v3";
import type { UploadRequestOptions } from "element-plus";
import * as kb from "../api/kb";
import type { KbEntry, KbLayer } from "../api/kb";
import * as microservices from "../api/microservices";
import type { MicroserviceOut } from "../api/microservices";
import { HttpError, saveBlob } from "../api/http";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const services = ref<MicroserviceOut[]>([]);
const ms = ref("");
const layer = ref<KbLayer>("shared");
const account = ref(""); // super 指定 private 层主人，缺省本人
const curPath = ref(""); // 层内目录，'' = 层根
const entries = ref<KbEntry[]>([]);
const listing = ref(false);

// 编辑器（只读展示 + super 可保存）
const editor = ref<{ path: string; content: string; isNew: boolean } | null>(
  null,
);
const saving = ref(false);

const loc = computed(() => ({
  microservice: ms.value,
  layer: layer.value,
  path: curPath.value || "/",
  ...(auth.isSuper && layer.value === "private" && account.value
    ? { account: account.value }
    : {}),
}));

const crumbs = computed(() =>
  curPath.value ? curPath.value.split("/").filter(Boolean) : [],
);

/** entries.path 是 agent 完整路径，切成层内相对路径 */
function rel(full: string) {
  const prefix = `/kb/${ms.value}/${layer.value}/`;
  return full.startsWith(prefix) ? full.slice(prefix.length) : full;
}

let seq = 0;
async function loadEntries() {
  if (!ms.value) return;
  const s = ++seq;
  listing.value = true;
  try {
    const r = await kb.list(loc.value);
    if (s === seq) entries.value = r.entries;
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  } finally {
    if (s === seq) listing.value = false;
  }
}

async function loadServices() {
  try {
    services.value = (await microservices.visible()).microservices;
    if (!ms.value && services.value.length) ms.value = services.value[0].name;
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  }
}

onMounted(loadServices);

watch([ms, layer, curPath], () => {
  editor.value = null;
  void loadEntries();
});
// 切层回到层根（路径属于某一层）
watch(layer, () => {
  curPath.value = "";
});

function enterDir(e: KbEntry) {
  if (e.is_dir) curPath.value = rel(e.path).replace(/\/$/, "");
}

function goUp() {
  const parts = crumbs.value;
  parts.pop();
  curPath.value = parts.join("/");
}

function showCrumb(i: number) {
  curPath.value = crumbs.value.slice(0, i + 1).join("/");
}

async function openFile(e: KbEntry) {
  const path = rel(e.path);
  try {
    const f = await kb.read({ ...loc.value, path });
    editor.value = { path, content: f.content, isNew: false };
  } catch (err) {
    if (err instanceof HttpError && err.status === 422) {
      // 二进制：后端提示走 download
      await downloadFile(path);
    } else if (err instanceof HttpError) {
      ElMessage.error(err.message);
    }
  }
}

async function downloadFile(path: string) {
  try {
    const { blob, filename } = await kb.downloadFile({ ...loc.value, path });
    saveBlob(blob, filename);
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  }
}

async function createFile() {
  let p: string;
  try {
    p = await ElMessageBox.prompt(
      "层内相对路径（如 概念.md、docs/a.md）",
      "新建文件",
      {
        inputPattern: /\S+/,
        inputErrorMessage: "路径不能为空",
      },
    );
  } catch {
    return;
  }
  editor.value = { path: p.replace(/^\/+/, ""), content: "", isNew: true };
}

async function saveFile() {
  if (!editor.value) return;
  saving.value = true;
  try {
    await kb.write({
      ...loc.value,
      path: editor.value.path,
      content: editor.value.content,
    });
    editor.value.isNew = false;
    ElMessage.success("已保存");
    await loadEntries();
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  } finally {
    saving.value = false;
  }
}

async function removeFile() {
  if (!editor.value) return;
  try {
    await ElMessageBox.confirm(`删除 ${editor.value.path}？`, "删除", {
      type: "warning",
    });
  } catch {
    return;
  }
  try {
    await kb.remove({ ...loc.value, path: editor.value.path });
    editor.value = null;
    await loadEntries();
    ElMessage.success("已删除");
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  }
}

async function doUpload({ file }: UploadRequestOptions) {
  const fd = new FormData();
  fd.append("files", file as File);
  fd.append("microservice", ms.value);
  fd.append("layer", layer.value);
  if (auth.isSuper && layer.value === "private" && account.value)
    fd.append("account", account.value);
  try {
    const { results } = await kb.upload(fd);
    for (const r of results) {
      if (r.error) ElMessage.warning(`${r.file}：${r.error}`);
      else ElMessage.success(`${r.file} → ${r.path}`);
    }
    await loadEntries();
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  }
}

function fmtSize(n?: number) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 工具栏 -->
    <div
      class="flex shrink-0 flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-2"
    >
      <el-select
        v-model="ms"
        size="small"
        class="w-52"
        placeholder="选择微服务"
      >
        <el-option
          v-for="s in services"
          :key="s.id"
          :label="s.name"
          :value="s.name"
        />
      </el-select>
      <el-radio-group v-model="layer" size="small">
        <el-radio-button value="shared">共享知识</el-radio-button>
        <el-radio-button value="private">私有文档</el-radio-button>
      </el-radio-group>
      <el-input
        v-if="auth.isSuper && layer === 'private'"
        v-model="account"
        size="small"
        class="w-44"
        placeholder="主人账号（缺省自己）"
        clearable
      />
      <div class="ml-auto flex gap-2">
        <template v-if="auth.isSuper">
          <el-button size="small" plain @click="createFile"
            >＋ 新建文件</el-button
          >
          <el-upload
            :show-file-list="false"
            :multiple="true"
            :http-request="doUpload"
          >
            <el-button size="small" plain>上传</el-button>
          </el-upload>
        </template>
        <el-tag v-else size="small" type="info">只读（写操作需 super）</el-tag>
      </div>
    </div>

    <div class="flex min-h-0 flex-1">
      <!-- 左：目录 -->
      <div
        class="flex w-96 shrink-0 flex-col border-r border-gray-200 bg-gray-50"
      >
        <div class="border-b border-gray-100 px-3 py-1.5 text-xs text-gray-500">
          <span
            class="cursor-pointer hover:text-blue-600"
            @click="curPath = ''"
          >
            /{{ ms || "…" }}/{{ layer }}
          </span>
          <template v-for="(c, i) in crumbs" :key="i">
            <span
              class="cursor-pointer hover:text-blue-600"
              @click="showCrumb(i)"
              >/{{ c }}</span
            >
          </template>
          <el-button
            v-if="crumbs.length"
            size="small"
            text
            class="ml-1"
            @click="goUp"
            >↑ 上级</el-button
          >
        </div>
        <div
          v-loading="listing"
          class="min-h-0 flex-1 overflow-y-auto px-2 py-2"
        >
          <p v-if="!ms" class="px-2 py-2 text-xs text-gray-400">
            先选择一个微服务
          </p>
          <div
            v-for="e in entries"
            :key="e.path"
            class="mb-1 cursor-pointer rounded px-3 py-1.5 text-sm hover:bg-white"
            @click="e.is_dir ? enterDir(e) : openFile(e)"
          >
            <span class="mr-1">{{ e.is_dir ? "📁" : "📄" }}</span>
            <span class="text-gray-800">{{
              rel(e.path).split("/").pop()
            }}</span>
            <span v-if="!e.is_dir" class="ml-2 text-xs text-gray-400">
              {{ fmtSize(e.size) }}
              <el-button
                v-if="
                  !e.path.match(
                    /\.(md|txt|json|ya?ml|csv|py|js|ts|vue|html|css|log)$/i,
                  )
                "
                size="small"
                text
                type="primary"
                @click.stop="downloadFile(rel(e.path))"
              >
                下载
              </el-button>
            </span>
          </div>
          <p
            v-if="!entries.length && !listing && ms"
            class="px-2 py-2 text-xs text-gray-400"
          >
            这一层还没有文件
          </p>
        </div>
      </div>

      <!-- 右：编辑器 -->
      <div class="flex min-w-0 flex-1 flex-col">
        <div
          class="flex h-11 shrink-0 items-center gap-2 border-b border-gray-200 px-4"
        >
          <span class="truncate text-sm font-medium text-gray-700">
            {{ editor ? editor.path : "未选择" }}
            <el-tag v-if="editor?.isNew" size="small" type="warning"
              >未保存</el-tag
            >
          </span>
          <div v-if="editor" class="ml-auto flex gap-2">
            <el-button size="small" @click="downloadFile(editor.path)"
              >下载</el-button
            >
            <template v-if="auth.isSuper">
              <el-button
                size="small"
                type="primary"
                :loading="saving"
                @click="saveFile"
                >保存</el-button
              >
              <el-button size="small" type="danger" plain @click="removeFile"
                >删除</el-button
              >
            </template>
          </div>
        </div>
        <div v-if="editor" class="min-h-0 flex-1">
          <MdEditor v-model="editor.content" language="zh-CN" class="h-full" />
        </div>
        <div
          v-else
          class="flex flex-1 items-center justify-center text-sm text-gray-400"
        >
          选择文件查看；二进制文件会直接下载
        </div>
      </div>
    </div>
  </div>
</template>
