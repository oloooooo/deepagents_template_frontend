import { defineStore } from "pinia";
import * as authApi from "../api/auth";
import { clearTokens, hasTokens } from "../api/http";
import type { UserOut } from "../api/auth";

export const useAuthStore = defineStore("auth", {
  state: () => ({ user: null as UserOut | null, booted: false }),
  getters: {
    isSuper: (s) => s.user?.is_super ?? false,
    account: (s) => s.user?.account ?? "",
  },
  actions: {
    /** 应用启动时用本地 token 换回登录态；失败视为未登录。 */
    async boot() {
      if (this.booted) return;
      this.booted = true;
      if (!hasTokens()) return;
      try {
        this.user = await authApi.me();
      } catch {
        this.user = null;
      }
    },
    /** is_super 不进 JWT、每请求回查 —— 导航时静默刷新，升权立刻可见。 */
    async refreshMe() {
      if (!hasTokens()) return;
      try {
        this.user = await authApi.me();
      } catch {
        /* 401 已由 http 层处理 */
      }
    },
    async login(account: string, password: string) {
      this.user = await authApi.login(account, password);
    },
    async register(account: string, email: string, password: string) {
      await authApi.register(account, email, password);
    },
    async logout() {
      try {
        await authApi.logout();
      } catch {
        /* 登出失败也本地清 */
      }
      clearTokens();
      this.user = null;
    },
  },
});
