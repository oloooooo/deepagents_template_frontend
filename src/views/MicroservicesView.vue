<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import * as microservices from "../api/microservices";
import type { MicroserviceOut } from "../api/microservices";
import { HttpError } from "../api/http";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const services = ref<MicroserviceOut[]>([]);
const memberIds = ref<Set<string>>(new Set());
const loading = ref(false);

// 新建对话框
const createOpen = ref(false);
const form = ref({ name: "", description: "" });
const creating = ref(false);

// 授权 / 收权对话框
const memberOpen = ref(false);
const memberMode = ref<"grant" | "revoke">("grant");
const memberTarget = ref<MicroserviceOut | null>(null);
const memberAccount = ref("");
const memberBusy = ref(false);

async function load() {
  loading.value = true;
  try {
    const [visible, mine] = await Promise.all([
      microservices.visible(),
      microservices.mineList(),
    ]);
    services.value = visible.microservices;
    memberIds.value = new Set(mine.microservices.map((m) => m.id));
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function doCreate() {
  if (!form.value.name) return;
  creating.value = true;
  try {
    await microservices.create(
      form.value.name,
      form.value.description || undefined,
    );
    ElMessage.success(`已创建 ${form.value.name}`);
    createOpen.value = false;
    form.value = { name: "", description: "" };
    await load();
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  } finally {
    creating.value = false;
  }
}

async function doRemove(s: MicroserviceOut) {
  try {
    await ElMessageBox.confirm(
      `删除微服务 ${s.name}？它的知识库内容会被级联清空。`,
      "删除",
      { type: "warning", confirmButtonText: "删除" },
    );
  } catch {
    return;
  }
  try {
    await microservices.remove(s.id);
    ElMessage.success("已删除");
    await load();
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  }
}

function openMember(mode: "grant" | "revoke", s: MicroserviceOut) {
  memberMode.value = mode;
  memberTarget.value = s;
  memberAccount.value = "";
  memberOpen.value = true;
}

async function doMember() {
  if (!memberTarget.value || !memberAccount.value) return;
  memberBusy.value = true;
  try {
    const fn =
      memberMode.value === "grant" ? microservices.grant : microservices.revoke;
    await fn(memberTarget.value.id, memberAccount.value);
    ElMessage.success(memberMode.value === "grant" ? "已授权" : "已收权");
    memberOpen.value = false;
    await load();
  } catch (e) {
    if (e instanceof HttpError) ElMessage.error(e.message);
  } finally {
    memberBusy.value = false;
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto p-6">
    <div class="mx-auto max-w-4xl">
      <div class="mb-4 flex items-center gap-3">
        <h1 class="text-lg font-semibold text-gray-800">
          微服务（知识库空间）
        </h1>
        <el-button
          v-if="auth.isSuper"
          size="small"
          type="primary"
          @click="createOpen = true"
        >
          ＋ 新建微服务
        </el-button>
        <el-tag v-else size="small" type="info">写操作需 super</el-tag>
      </div>

      <el-table v-loading="loading" :data="services" size="small">
        <el-table-column label="名称" width="180">
          <template #default="{ row }">
            <span class="font-mono">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="说明" prop="description">
          <template #default="{ row }">
            <span class="text-gray-500">{{ row.description || "—" }}</span>
          </template>
        </el-table-column>
        <el-table-column label="我是成员" width="90">
          <template #default="{ row }">
            <el-tag v-if="memberIds.has(row.id)" size="small" type="success"
              >是</el-tag
            >
            <span v-else class="text-xs text-gray-400">否</span>
          </template>
        </el-table-column>
        <el-table-column v-if="auth.isSuper" label="操作" width="200">
          <template #default="{ $index }">
            <el-button
              size="small"
              text
              type="primary"
              @click="openMember('grant', services[$index])"
            >
              授权
            </el-button>
            <el-button
              size="small"
              text
              @click="openMember('revoke', services[$index])"
              >收权</el-button
            >
            <el-button
              size="small"
              text
              type="danger"
              @click="doRemove(services[$index])"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>

      <p v-if="!services.length && !loading" class="mt-4 text-sm text-gray-400">
        还没有可见的微服务{{
          auth.isSuper
            ? " —— 点「新建」创建第一个知识库空间"
            : " —— 联系 super 授权给你"
        }}
      </p>
    </div>

    <!-- 新建 -->
    <el-dialog v-model="createOpen" title="新建微服务" width="26rem">
      <el-form label-width="4.5rem" @submit.prevent="doCreate">
        <el-form-item label="名称" required>
          <el-input
            v-model="form.name"
            placeholder="字母数字 _ . -（agent 挂载路径的一段）"
          />
        </el-form-item>
        <el-form-item label="说明">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            placeholder="给人看的说明（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createOpen = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="doCreate"
          >创建</el-button
        >
      </template>
    </el-dialog>

    <!-- 授权 / 收权 -->
    <el-dialog
      v-model="memberOpen"
      :title="
        memberMode === 'grant'
          ? `授权加入 ${memberTarget?.name}`
          : `收回 ${memberTarget?.name} 的访问`
      "
      width="26rem"
    >
      <el-form label-width="4.5rem" @submit.prevent="doMember">
        <el-form-item label="账号" required>
          <el-input
            v-model="memberAccount"
            placeholder="对方的账号名（不是邮箱）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="memberOpen = false">取消</el-button>
        <el-button
          :type="memberMode === 'grant' ? 'primary' : 'danger'"
          :loading="memberBusy"
          @click="doMember"
        >
          {{ memberMode === "grant" ? "授权" : "收权" }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
