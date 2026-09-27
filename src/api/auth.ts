import type { components } from "./schema";
import { get, post, saveTokens } from "./http";

export type UserOut = components["schemas"]["UserOut"];

export const login = async (account: string, password: string) => {
  saveTokens(
    await post<components["schemas"]["TokenPair"]>("/auth/login", {
      account,
      password,
    }),
  );
  return get<UserOut>("/auth/me");
};

export const register = (account: string, email: string, password: string) =>
  post<UserOut>("/auth/register", { account, email, password });

export const me = () => get<UserOut>("/auth/me");

export const logout = () => post<void>("/auth/logout");
