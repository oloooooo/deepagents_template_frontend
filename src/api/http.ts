import type { components } from "./schema";

export type TokenPair = components["schemas"]["TokenPair"];

const ACCESS = "deepagents.access";
const REFRESH = "deepagents.refresh";

export function saveTokens(t: TokenPair) {
  localStorage.setItem(ACCESS, t.access_token);
  localStorage.setItem(REFRESH, t.refresh_token);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}

export function hasTokens() {
  return !!(localStorage.getItem(ACCESS) || localStorage.getItem(REFRESH));
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function detailText(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((d: unknown) => (d as { msg?: string }).msg ?? JSON.stringify(d))
      .join("; ");
  return "请求失败";
}

/** 单飞刷新：并发 401 只发一次 refresh，其余等同一个结果。 */
let refreshing: Promise<boolean> | null = null;
function refreshOnce() {
  if (!refreshing) {
    refreshing = (async () => {
      const rt = localStorage.getItem(REFRESH);
      if (!rt) return false;
      try {
        const res = await fetch("/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: rt }),
        });
        if (!res.ok) return false;
        saveTokens((await res.json()) as TokenPair);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

const AUTH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh"];

/** 带鉴权的 fetch：401 时单飞刷新并重试一次，刷新失败清 token 跳登录页。 */
async function sendWithAuth(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const send = () => {
    const headers: Record<string, string> = {};
    const access = localStorage.getItem(ACCESS);
    if (access) headers.Authorization = `Bearer ${access}`;
    let payload: BodyInit | undefined;
    if (body !== undefined) {
      if (body instanceof FormData) {
        payload = body;
      } else {
        headers["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
      }
    }
    return fetch(path, { method, headers, body: payload });
  };

  let res = await send();
  if (res.status === 401 && !AUTH_PATHS.some((p) => path.startsWith(p))) {
    if (await refreshOnce()) {
      res = await send();
    } else {
      clearTokens();
      if (!location.pathname.startsWith("/login")) location.assign("/login");
      throw new HttpError(401, "登录已过期");
    }
  }
  return res;
}

async function toError(res: Response): Promise<HttpError> {
  const j = (await res.json().catch(() => null)) as { detail?: unknown } | null;
  return new HttpError(res.status, detailText(j?.detail));
}

export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await sendWithAuth(method, path, body);
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const get = <T>(path: string) => request<T>("GET", path);
export const post = <T>(path: string, body?: unknown) =>
  request<T>("POST", path, body);
export const del = <T>(path: string) => request<T>("DELETE", path);

/** SSE 用：拿一个保证有效的 access token（必要时先刷新）。 */
export async function authHeaders(): Promise<Record<string, string>> {
  if (!localStorage.getItem(ACCESS) && localStorage.getItem(REFRESH))
    await refreshOnce();
  const access = localStorage.getItem(ACCESS);
  if (!access) {
    if (!location.pathname.startsWith("/login")) location.assign("/login");
    throw new HttpError(401, "登录已过期");
  }
  return { Authorization: `Bearer ${access}` };
}

function filenameFrom(res: Response, fallback: string): string {
  const cd = res.headers.get("Content-Disposition") ?? "";
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (utf8) return decodeURIComponent(utf8[1]);
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  return plain ? plain[1] : fallback;
}

/** POST 下载原始字节（kb/files/download）。 */
export async function download(
  path: string,
  body: unknown,
  fallbackName: string,
) {
  const res = await sendWithAuth("POST", path, body);
  if (!res.ok) throw await toError(res);
  return { blob: await res.blob(), filename: filenameFrom(res, fallbackName) };
}

/** 触发浏览器保存一个 blob。 */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
