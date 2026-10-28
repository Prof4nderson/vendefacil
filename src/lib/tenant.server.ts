import { useSession } from "@tanstack/react-start/server";
import { q1 } from "./db.server";

export type AppSession = { userId?: string; workspaceId?: string; name?: string; email?: string };

export const getAppSession = () => {
  const password = process.env["ACCOUNT_SESSION_SECRET"];
  if (!password || password.length < 32) {
    throw new Error("Configure ACCOUNT_SESSION_SECRET com pelo menos 32 caracteres aleatórios");
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSession<AppSession>({
    password,
    name: "vendefacil-account",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  });
};

export async function getTenantContext() {
  const session = await getAppSession();
  const workspaceId = session.data.workspaceId;
  if (!workspaceId || !session.data.userId)
    throw new Error("Faça login para acessar os dados da conta");
  return { session, userId: session.data.userId, workspaceId };
}

export async function getOptionalTenantContext() {
  const session = await getAppSession();
  if (!session.data.workspaceId || !session.data.userId) return null;
  return { session, userId: session.data.userId, workspaceId: session.data.workspaceId };
}

export async function assertWorkspaceAccess(workspaceId: string, userId?: string) {
  const ctx = await getTenantContext();
  if (ctx.workspaceId !== workspaceId || (userId && ctx.userId !== userId))
    throw new Error("Acesso negado");
  return ctx;
}

export async function workspaceExists(workspaceId: string) {
  return !!(await q1<{ id: string }>("select id from workspaces where id=$1", [workspaceId]));
}
