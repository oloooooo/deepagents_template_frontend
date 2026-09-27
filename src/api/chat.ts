import { fetchEventSource } from "@microsoft/fetch-event-source";
import type { components } from "./schema";
import { authHeaders, del, get, HttpError, detailText, post } from "./http";

export type ChatSend = components["schemas"]["ChatSend"];
export type ChatRunOut = components["schemas"]["ChatRunOut"];
export type ChatStateOut = components["schemas"]["ChatStateOut"];
export type ChatMessageOut = components["schemas"]["ChatMessageOut"];
export type ChatThreadOut = components["schemas"]["ChatThreadOut"];
export type ChatStopOut = components["schemas"]["ChatStopOut"];

export const mine = () => get<{ threads: ChatThreadOut[] }>("/chat/mine");

export const history = (threadId: string) =>
  get<{ thread_id: string; messages: ChatMessageOut[] }>(
    `/chat/history/${threadId}`,
  );

export const state = (threadId: string) =>
  get<ChatStateOut>(`/chat/state/${threadId}`);

/** 阻塞跑一轮（不流式）。 */
export const send = (body: ChatSend) => post<ChatRunOut>("/chat/send", body);

export const approve = (threadId: string, type: "approve" | "reject") =>
  post<ChatRunOut>("/chat/approve", {
    thread_id: threadId,
    decisions: [{ type }],
  });

export const stop = (threadId: string) =>
  post<ChatStopOut>("/chat/stop", { thread_id: threadId });

export const deleteThread = (threadId: string) =>
  del<void>(`/chat/delete/${threadId}`);

export const deleteMessages = (threadId: string, messageIds: string[]) =>
  post<void>("/chat/messages/delete", {
    thread_id: threadId,
    message_ids: messageIds,
  });

export const deleteFiles = (threadId: string, paths: string[]) =>
  post<void>("/chat/files/delete", { thread_id: threadId, paths });

export interface StreamHandlers {
  /** 新会话的 thread_id 走 X-Thread-Id 响应头 */
  onThread?: (id: string) => void;
  onToken?: (text: string) => void;
  onToolCall?: (text: string, data: unknown) => void;
  onInterrupt?: (text: string, data: unknown) => void;
  onDone?: (text: string, data: unknown) => void;
  onError?: (err: unknown) => void;
}

/**
 * POST + SSE 跑一轮。
 * onerror 里必须抛出：默认重试会把同一条消息再 POST 一遍。
 */
export async function streamChat(
  message: string,
  threadId: string | null,
  h: StreamHandlers,
  signal: AbortSignal,
) {
  const headers = await authHeaders();
  await fetchEventSource("/chat/stream", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ message, thread_id: threadId }),
    signal,
    async onopen(res: Response) {
      if (res.ok) {
        const id = res.headers.get("X-Thread-Id");
        if (id) h.onThread?.(id);
        return;
      }
      const j = (await res.json().catch(() => null)) as {
        detail?: unknown;
      } | null;
      throw new HttpError(res.status, detailText(j?.detail));
    },
    onmessage(ev) {
      if (!ev.data) return;
      let p: { text?: string; data?: unknown };
      try {
        p = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (ev.event === "token") h.onToken?.(p.text ?? "");
      else if (ev.event === "tool_call") h.onToolCall?.(p.text ?? "", p.data);
      else if (ev.event === "interrupt") h.onInterrupt?.(p.text ?? "", p.data);
      else if (ev.event === "done") h.onDone?.(p.text ?? "", p.data);
    },
    onerror(err) {
      h.onError?.(err);
      throw err;
    },
  });
}
