import { useSession } from "@tanstack/react-start/server";
import { q1 } from "./db.server";

export type AppSession = { userId?: string; workspaceId?: string; name?: string; email?: string };

const appSessionConfig = {
  password: "9d4e7a2c1f6b8e0a3c5d7f9b1e4a6c8d0f2b5e7a9c1d3f5b7e9a1c3d5f7b9e",
  name: "vendefacil-account",
  maxAge: 60 * 60 * 24 * 30,
  cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
};

export const getAppSession = () => useSession<AppSession>(appSessionConfig);

export async function getTenantContext() {
  const session = await getAppSession();
  const workspaceId = session.data.workspaceId;
  if (!workspaceId || !session.data.userId) throw new Error("Faça login para acessar os dados da conta");
  return { session, userId: session.data.userId, workspaceId };
}

export async function getOptionalTenantContext() {
  const session = await getAppSession();
  if (!session.data.workspaceId || !session.data.userId) return null;
  return { session, userId: session.data.userId, workspaceId: session.data.workspaceId };
}

export async function assertWorkspaceAccess(workspaceId: string, userId?: string) {
  const ctx = await getTenantContext();
  if (ctx.workspaceId !== workspaceId || (userId && ctx.userId !== userId)) throw new Error("Acesso negado");
  return ctx;
}

export async function workspaceExists(workspaceId: string) {
  return !!(await q1<{ id: string }>("select id from workspaces where id=$1", [workspaceId]));
}
