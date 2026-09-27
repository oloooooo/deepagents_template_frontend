import type { components } from "./schema";
import { download, post } from "./http";

export type KbEntry = components["schemas"]["KbEntry"];
export type KbLayer = "shared" | "private";

export interface KbLoc {
  microservice: string;
  layer: KbLayer;
  /** 层内目录路径，缺省层根 */
  path?: string;
  /** layer=private 时指定主人（super 用），缺省本人 */
  account?: string;
}

export const list = (loc: KbLoc) =>
  post<{ entries: KbEntry[] }>("/kb/files/list", loc);

export const read = (loc: KbLoc & { path: string }) =>
  post<{ path: string; content: string }>("/kb/files/read", loc);

export const write = (loc: KbLoc & { path: string; content: string }) =>
  post<{ path: string }>("/kb/files/write", loc);

export const remove = (loc: KbLoc & { path: string }) =>
  post<void>("/kb/files/delete", loc);

export const upload = (fd: FormData) =>
  post<{ results: components["schemas"]["KbUploadItem"][] }>(
    "/kb/files/upload",
    fd,
  );

export const downloadFile = (loc: KbLoc & { path: string }) => {
  const name = loc.path.split("/").pop() || "download.bin";
  return download("/kb/files/download", loc, name);
};
