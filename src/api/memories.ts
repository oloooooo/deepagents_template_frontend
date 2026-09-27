import type { components } from "./schema";
import { get, post } from "./http";

export type MemoryOut = components["schemas"]["MemoryOut"];
export type MemoryUploadItem = components["schemas"]["MemoryUploadItem"];

export const all = () => get<{ memories: string[] }>("/memories/all");

export const read = (path: string) =>
  post<MemoryOut>("/memories/read", { path });

export const write = (path: string, content: string) =>
  post<{ path: string }>("/memories/write", { path, content });

export const remove = (path: string) =>
  post<void>("/memories/delete", { path });

/** files 可多份，逐份返回 {file, path, error}。 */
export const upload = (files: File[]) => {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return post<{ results: MemoryUploadItem[] }>("/memories/upload", fd);
};
