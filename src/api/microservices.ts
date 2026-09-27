import type { components } from "./schema";
import { post } from "./http";

export type MicroserviceOut = components["schemas"]["MicroserviceOut"];

const list = () =>
  post<{ microservices: MicroserviceOut[] }>("/microservices/list");

export const mineList = () =>
  post<{ microservices: MicroserviceOut[] }>("/microservices/mine");

export const visible = list;

export const create = (name: string, description?: string) =>
  post<MicroserviceOut>("/microservices/create", { name, description });

export const remove = (id: string) => post<void>(`/microservices/delete/${id}`);

export const grant = (id: string, account: string) =>
  post<void>(`/microservices/grant/${id}`, { account });

export const revoke = (id: string, account: string) =>
  post<void>(`/microservices/revoke/${id}`, { account });
