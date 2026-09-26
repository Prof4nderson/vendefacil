import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomInt } from "node:crypto";
import { q, q1 } from "./db.server";
import { getAppSession, getTenantContext } from "./tenant.server";

const signupSchema = z.object({
  name: z.string().min(2), login: z.string().min(3), password: z.string().min(6),
  whatsapp: z.string().min(8), email: z.string().email(),
});
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
async function provisionRoutePasswords(workspaceId: string) {
  await q(
    `insert into route_passwords (workspace_id, route, password_hash) values
      ($1,'admin','240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'),
      ($1,'cozinha','50263d56d9e862db1767204ed2fc5c264cfe2abfbd39b0bb3a7bd25ee78dbbe9'),
      ($1,'entrega','0dc492621a834e51988b6840f9e1b0f095847deaf93b7543c16429e11644dcfd'),
      ($1,'caixa','59c7c57e6516f4a4ae85214acbd322b724cb755806c4183587a5007c9ca3af23')
     on conflict (workspace_id, route) do nothing`,
    [workspaceId],
  );
}
async function sendPinEmail(email: string, pin: string) {
  const webhook = process.env["EMAIL_WEBHOOK_URL"];
  const subject = "Seu PIN de ativação — VendeFácil";
  const text = `Seu código de confirmação é ${pin}. Ele expira em 15 minutos.`;
  if (webhook) await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: email, subject, text }) });
  else console.info(`[VendeFácil] PIN de desenvolvimento para ${email}: ${pin}`);
}

export const registerAccount = createServerFn({ method: "POST" }).validator((data) => signupSchema.parse(data)).handler(async ({ data }) => {
  const exists = await q1<{ id: string }>("select id from app_users where lower(email)=lower($1) or lower(login)=lower($2)", [data.email, data.login]);
  if (exists) throw new Error("Email ou login já cadastrado");
  const pin = String(randomInt(100000, 999999));
  const workspace = await q1<{ id: string }>("insert into workspaces (name) values ($1) returning id", [`${data.name.trim()} — operação`]);
  if (!workspace) throw new Error("Não foi possível criar o espaço da conta");
  const user = await q1<{ id: string }>(
    `insert into app_users (workspace_id,name,login,password_hash,whatsapp,email,role,verification_pin,pin_expires_at)
     values ($1,$2,$3,$4,$5,$6,'owner',$7,now()+interval '15 minutes') returning id`,
    [workspace.id, data.name.trim(), data.login.trim(), hash(data.password), data.whatsapp.trim(), data.email.trim().toLowerCase(), hash(pin)],
  );
  if (!user) throw new Error("Não foi possível criar o usuário");
  await provisionRoutePasswords(workspace.id);
  await sendPinEmail(data.email, pin);
  return { ok: true as const };
});

export const verifyAccount = createServerFn({ method: "POST" }).validator((data) => z.object({ email: z.string().email(), pin: z.string().length(6) }).parse(data)).handler(async ({ data }) => {
  const user = await q1<{ id: string; name: string; email: string; workspace_id: string }>(
    "select id,name,email,workspace_id from app_users where lower(email)=lower($1) and verification_pin=$2 and pin_expires_at > now()",
    [data.email, hash(data.pin)],
  );
  if (!user) throw new Error("PIN inválido ou expirado");
  await q("update app_users set verified_at=now(),verification_pin=null,pin_expires_at=null where id=$1", [user.id]);
  await provisionRoutePasswords(user.workspace_id);
  const session = await getAppSession();
  await session.update({ userId: user.id, workspaceId: user.workspace_id, name: user.name, email: user.email });
  return { ok: true as const, name: user.name, email: user.email };
});

export const loginAccount = createServerFn({ method: "POST" }).validator((data) => z.object({ login: z.string().min(3), password: z.string().min(1) }).parse(data)).handler(async ({ data }) => {
  const user = await q1<{ id: string; name: string; email: string; workspace_id: string; password_hash: string; verified_at: string | null }>(
    "select id,name,email,workspace_id,password_hash,verified_at from app_users where lower(login)=lower($1) or lower(email)=lower($1)", [data.login.trim()]);
  if (!user || hash(data.password) !== user.password_hash) throw new Error("Login ou senha inválidos");
  if (!user.verified_at) throw new Error("Confirme seu email antes de entrar");
  await provisionRoutePasswords(user.workspace_id);
  const session = await getAppSession();
  await session.update({ userId: user.id, workspaceId: user.workspace_id, name: user.name, email: user.email });
  return { ok: true as const, name: user.name, email: user.email };
});

export const logoutAccount = createServerFn({ method: "POST" }).handler(async () => { await (await getAppSession()).clear(); return { ok: true as const }; });

export const getCurrentAccount = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await getTenantContext();
  return q1("select id,name,login,email,whatsapp,address,cpf_cnpj,cep,city,state,workspace_id from app_users where id=$1 and workspace_id=$2", [ctx.userId, ctx.workspaceId]);
});

export const getUserProfile = createServerFn({ method: "GET" }).validator((data) => z.object({ email: z.string().email() }).parse(data)).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  return q1("select name,login,email,whatsapp,address,cpf_cnpj,cep,city,state from app_users where id=$1 and workspace_id=$2 and lower(email)=lower($3)", [ctx.userId, ctx.workspaceId, data.email]);
});

export const updateUserProfile = createServerFn({ method: "POST" }).validator((data) => z.object({
  email: z.string().email(), name: z.string().min(2), whatsapp: z.string().min(8), address: z.string().optional(), cpf_cnpj: z.string().optional(), cep: z.string().optional(), city: z.string().optional(), state: z.string().optional(),
}).parse(data)).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  await q("update app_users set name=$1,whatsapp=$2,address=$3,cpf_cnpj=$4,cep=$5,city=$6,state=$7 where id=$8 and workspace_id=$9 and lower(email)=lower($10)", [data.name, data.whatsapp, data.address ?? null, data.cpf_cnpj ?? null, data.cep ?? null, data.city ?? null, data.state ?? null, ctx.userId, ctx.workspaceId, data.email]);
  const session = await getAppSession();
  await session.update({ ...session.data, name: data.name });
  return { ok: true as const };
});
