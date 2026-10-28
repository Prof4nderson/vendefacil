import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { getTenantContext } from "./tenant.server";
export type Role = "admin" | "cozinha" | "entrega" | "caixa";
export type OpsSession = { role?: Role; courierId?: string; courierName?: string };
function getOpsSessionConfig() {
  const password = process.env["OPS_SESSION_SECRET"];
  if (!password || password.length < 32) {
    throw new Error("Configure OPS_SESSION_SECRET com pelo menos 32 caracteres aleatórios");
  }
  return {
    password,
    name: "ops-session",
    maxAge: 60 * 60 * 14,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}
// eslint-disable-next-line react-hooks/rules-of-hooks
export const getOpsSession = () => useSession<OpsSession>(getOpsSessionConfig());
export const hashPassword = (p: string) => createHash("sha256").update(p, "utf8").digest("hex");
export function passwordMatches(input: string, expectedHash: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = Buffer.from(expectedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function requireRole(...roles: Role[]) {
  const session = await getOpsSession();
  const role = session.data.role;
  if (!role || !(roles.includes(role) || role === "admin")) throw new Error("Acesso negado");
  return session.data;
}
export async function requireTenantRole(...roles: Role[]) {
  const ops = await requireRole(...roles);
  const tenant = await getTenantContext();
  return { ...tenant, ops };
}
