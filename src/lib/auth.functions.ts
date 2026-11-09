import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { q, q1, tx } from "./db.server";
import { getAppSession, getTenantContext } from "./tenant.server";
import { getUserMessagesAfterLogin } from "./sysadm.functions";
import { ensureActivitySupportSchema, recordUserActivity } from "./activity-support.server";

const signupSchema = z.object({
  name: z.string().min(2),
  login: z.string().min(3),
  password: z.string().min(6),
  whatsapp: z.string().min(8),
  email: z.string().email(),
});
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const matchesHash = (value: string, expectedHash: string) => {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  return timingSafeEqual(Buffer.from(hash(value), "hex"), Buffer.from(expectedHash, "hex"));
};
function passwordChangePinHash(pin: string) {
  const secret = process.env["ACCOUNT_SESSION_SECRET"];
  if (!secret || secret.length < 32)
    throw new Error("Configure ACCOUNT_SESSION_SECRET para confirmar a troca de senha");
  return createHmac("sha256", secret).update(`vendefacil-password-change:${pin}`).digest("hex");
}
function matchesPasswordChangePin(pin: string, expectedHash: string) {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  return timingSafeEqual(
    Buffer.from(passwordChangePinHash(pin), "hex"),
    Buffer.from(expectedHash, "hex"),
  );
}
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
async function sendPinEmail(
  email: string,
  pin: string,
  purpose: "activation" | "password_change" = "activation",
) {
  const passwordChange = purpose === "password_change";
  const subject = passwordChange
    ? "Confirme a troca de senha — VendeFácil"
    : "Seu PIN de ativação — VendeFácil";
  const text = passwordChange
    ? `Seu PIN para confirmar a troca de senha é ${pin}. Ele expira em 10 minutos. Se você não solicitou a troca, ignore esta mensagem.`
    : `Seu código de confirmação é ${pin}. Ele expira em 15 minutos.`;
  const emailHeading = passwordChange ? "Confirme a troca de senha" : "Ative sua conta";
  const expirationText = passwordChange
    ? "Este PIN expira em 10 minutos."
    : "Este código expira em 15 minutos.";
  const host = process.env["SMTP_HOST"] || "mail.professor-anderson.com";
  const port = Number(process.env["SMTP_PORT"] || "587");
  const user = process.env["SMTP_USER"];
  const password = process.env["SMTP_PASSWORD"];
  const fromEmail = process.env["SMTP_FROM_EMAIL"];
  const fromName = process.env["SMTP_FROM_NAME"] || "VendeFácil";
  const secureSetting = process.env["SMTP_SECURE"]?.trim().toLowerCase();
  const secure = secureSetting ? secureSetting === "true" : port === 465;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT inválida. Use 587 para STARTTLS ou 465 para TLS implícito.");
  }
  if (!user || !password || !fromEmail) {
    throw new Error(
      "Email não configurado. Defina SMTP_USER, SMTP_PASSWORD e SMTP_FROM_EMAIL no .env.",
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass: password },
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });

  try {
    await transporter.sendMail({
      from: { name: fromName, address: fromEmail },
      to: email,
      subject,
      text,
      html: `<div style="font-family:Arial,sans-serif"><h2>VendeFácil</h2><p>${emailHeading}</p><p>Seu PIN de confirmação é:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${pin}</p><p>${expirationText}</p>${passwordChange ? "<p>Se você não solicitou a troca, ignore esta mensagem.</p>" : ""}</div>`,
    });
  } catch (error) {
    const smtpError = error as NodeJS.ErrnoException & {
      responseCode?: number;
      command?: string;
      hostname?: string;
      address?: string;
      port?: number;
    };
    console.error("Poste.io SMTP email delivery failed", {
      code: smtpError.code,
      message: smtpError.message?.slice(0, 300),
      responseCode: smtpError.responseCode,
      command: smtpError.command,
      hostname: smtpError.hostname || host,
      address: smtpError.address,
      port: smtpError.port || port,
    });
    throw new Error(
      "Não foi possível enviar o PIN. Verifique as credenciais SMTP, o remetente e a conectividade com o Poste.io.",
    );
  }
}

export const registerAccount = createServerFn({ method: "POST" })
  .validator((data) => signupSchema.parse(data))
  .handler(async ({ data }) => {
    await ensureActivitySupportSchema();
    const exists = await q1<{ id: string }>(
      "select id from app_users where lower(email)=lower($1) or lower(login)=lower($2)",
      [data.email, data.login],
    );
    if (exists) throw new Error("Email ou login já cadastrado");
    const pin = String(randomInt(100000, 999999));
    const workspace = await q1<{ id: string }>(
      "insert into workspaces (name) values ($1) returning id",
      [`${data.name.trim()} — operação`],
    );
    if (!workspace) throw new Error("Não foi possível criar o espaço da conta");
    const user = await q1<{ id: string }>(
      `insert into app_users (workspace_id,name,login,password_hash,whatsapp,email,role,verification_pin,pin_expires_at)
     values ($1,$2,$3,$4,$5,$6,'owner',$7,now()+interval '15 minutes') returning id`,
      [
        workspace.id,
        data.name.trim(),
        data.login.trim(),
        hash(data.password),
        data.whatsapp.trim(),
        data.email.trim().toLowerCase(),
        hash(pin),
      ],
    );
    if (!user) throw new Error("Não foi possível criar o usuário");
    await provisionRoutePasswords(workspace.id);
    try {
      await sendPinEmail(data.email, pin);
    } catch (error) {
      await q("delete from app_users where id=$1", [user.id]);
      await q("delete from workspaces where id=$1", [workspace.id]);
      throw error;
    }
    await recordUserActivity(
      user.id,
      "Cadastro iniciado",
      "Conta criada e PIN enviado para verificação",
    );
    return { ok: true as const };
  });

export const verifyAccount = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ email: z.string().email(), pin: z.string().length(6) }).parse(data),
  )
  .handler(async ({ data }) => {
    await ensureActivitySupportSchema();
    const user = await q1<{
      id: string;
      name: string;
      email: string;
      workspace_id: string;
    }>(
      "select id,name,email,workspace_id from app_users where lower(email)=lower($1) and verification_pin=$2 and pin_expires_at > now()",
      [data.email, hash(data.pin)],
    );
    if (!user) throw new Error("PIN inválido ou expirado");
    await q(
      "update app_users set verified_at=now(),last_login_at=clock_timestamp(),verification_pin=null,pin_expires_at=null where id=$1",
      [user.id],
    );
    await provisionRoutePasswords(user.workspace_id);
    const session = await getAppSession();
    await session.update({
      userId: user.id,
      workspaceId: user.workspace_id,
      name: user.name,
      email: user.email,
    });
    await recordUserActivity(user.id, "Email verificado", "Conta ativada e sessão iniciada");
    return { ok: true as const, name: user.name, email: user.email };
  });

export const loginAccount = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ login: z.string().min(3), password: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    await ensureActivitySupportSchema();
    const user = await q1<{
      id: string;
      name: string;
      email: string;
      workspace_id: string;
      password_hash: string;
      verified_at: string | null;
      status: string;
      status_note: string | null;
    }>(
      "select id,name,email,workspace_id,password_hash,verified_at,status,status_note from app_users where lower(login)=lower($1) or lower(email)=lower($1)",
      [data.login.trim()],
    );
    if (!user || !matchesHash(data.password, user.password_hash))
      throw new Error("Login ou senha inválidos");
    if (user.status === "disabled")
      throw new Error(
        `Conta desativada${user.status_note ? `: ${user.status_note}` : ". Procure o administrador."}`,
      );
    if (user.status === "suspended")
      throw new Error(
        `Conta suspensa${user.status_note ? `: ${user.status_note}` : ". Procure o administrador."}`,
      );
    if (!user.verified_at) throw new Error("Confirme seu email antes de entrar");
    await q("update app_users set last_login_at=clock_timestamp() where id=$1", [user.id]);
    await recordUserActivity(user.id, "Login realizado");
    const messages = await getUserMessagesAfterLogin(user.id);
    await provisionRoutePasswords(user.workspace_id);
    const session = await getAppSession();
    await session.update({
      userId: user.id,
      workspaceId: user.workspace_id,
      name: user.name,
      email: user.email,
    });
    return { ok: true as const, name: user.name, email: user.email, messages };
  });

export const logoutAccount = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getAppSession();
  if (session.data.userId) await recordUserActivity(session.data.userId, "Logout realizado");
  await session.clear();
  return { ok: true as const };
});

export const getCurrentAccount = createServerFn({ method: "GET" }).handler(async () => {
  const ctx = await getTenantContext();
  return q1(
    "select id,name,login,email,whatsapp,address,cpf_cnpj,cep,city,state,workspace_id from app_users where id=$1 and workspace_id=$2",
    [ctx.userId, ctx.workspaceId],
  );
});

export const getUserProfile = createServerFn({ method: "GET" })
  .validator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    return q1(
      "select u.name,u.login,u.email,u.whatsapp,u.address,u.cpf_cnpj,u.cep,u.city,u.state,w.name as establishment_name from app_users u join workspaces w on w.id=u.workspace_id where u.id=$1 and u.workspace_id=$2 and lower(u.email)=lower($3)",
      [ctx.userId, ctx.workspaceId, data.email],
    );
  });

export const updateUserProfile = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        email: z.string().email(),
        name: z.string().min(2),
        establishment_name: z.string().min(2),
        whatsapp: z.string().min(8),
        address: z.string().optional(),
        cpf_cnpj: z.string().optional(),
        cep: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    await q(
      "update app_users set name=$1,whatsapp=$2,address=$3,cpf_cnpj=$4,cep=$5,city=$6,state=$7 where id=$8 and workspace_id=$9 and lower(email)=lower($10)",
      [
        data.name,
        data.whatsapp,
        data.address ?? null,
        data.cpf_cnpj ?? null,
        data.cep ?? null,
        data.city ?? null,
        data.state ?? null,
        ctx.userId,
        ctx.workspaceId,
        data.email,
      ],
    );
    await q("update workspaces set name=$1 where id=$2", [
      data.establishment_name.trim(),
      ctx.workspaceId,
    ]);
    const session = await getAppSession();
    await session.update({ ...session.data, name: data.name });
    await recordUserActivity(ctx.userId, "Perfil atualizado");
    return { ok: true as const };
  });

export const changePassword = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    await ensureActivitySupportSchema();
    const user = await q1<{
      id: string;
      email: string;
      password_hash: string;
      verified_at: string | null;
    }>("select id,email,password_hash,verified_at from app_users where id=$1 and workspace_id=$2", [
      ctx.userId,
      ctx.workspaceId,
    ]);
    if (!user || !matchesHash(data.currentPassword, user.password_hash))
      throw new Error("Senha atual inválida");
    if (!user.verified_at) throw new Error("Confirme o email da conta antes de trocar a senha");
    if (matchesHash(data.newPassword, user.password_hash))
      throw new Error("A nova senha deve ser diferente da senha atual");

    const pin = String(randomInt(100000, 1_000_000));
    const pinHash = passwordChangePinHash(pin);
    const pendingPasswordHash = hash(data.newPassword);
    const updated = await q1<{ email: string }>(
      `update app_users
       set pending_password_hash=$1,password_change_pin_hash=$2,
           password_change_pin_expires_at=now()+interval '10 minutes',
           password_change_attempts=0,password_change_sent_at=now()
       where id=$3 and workspace_id=$4
         and (password_change_sent_at is null or password_change_sent_at < now()-interval '60 seconds')
       returning email`,
      [pendingPasswordHash, pinHash, user.id, ctx.workspaceId],
    );
    if (!updated)
      throw new Error("Aguarde 60 segundos antes de solicitar outro PIN de troca de senha");

    try {
      await sendPinEmail(updated.email, pin, "password_change");
    } catch (error) {
      await q(
        `update app_users set pending_password_hash=null,password_change_pin_hash=null,
           password_change_pin_expires_at=null,password_change_attempts=0
         where id=$1 and password_change_pin_hash=$2`,
        [user.id, pinHash],
      );
      throw error;
    }

    await recordUserActivity(user.id, "PIN para troca de senha enviado");
    return { ok: true as const, email: updated.email };
  });

export const confirmPasswordChange = createServerFn({ method: "POST" })
  .validator((data) => z.object({ pin: z.string().regex(/^\d{6}$/) }).parse(data))
  .handler(async ({ data }) => {
    const { userId } = await getTenantContext();
    await ensureActivitySupportSchema();
    const outcome = await tx(async (client) => {
      const { rows } = await client.query<{
        pending_password_hash: string | null;
        password_change_pin_hash: string | null;
        pin_valid: boolean | null;
        attempts: number;
      }>(
        `select pending_password_hash,password_change_pin_hash,
           password_change_pin_expires_at > now() as pin_valid,
           coalesce(password_change_attempts,0)::int as attempts
         from app_users where id=$1 for update`,
        [userId],
      );
      const pending = rows[0];
      if (!pending?.pending_password_hash || !pending.password_change_pin_hash)
        return { ok: false as const, reason: "missing" as const };

      const clearPending = async () => {
        await client.query(
          `update app_users set pending_password_hash=null,password_change_pin_hash=null,
             password_change_pin_expires_at=null,password_change_attempts=0 where id=$1`,
          [userId],
        );
      };
      if (!pending.pin_valid) {
        await clearPending();
        return { ok: false as const, reason: "expired" as const };
      }
      if (pending.attempts >= 5) {
        await clearPending();
        return { ok: false as const, reason: "attempts" as const };
      }
      if (!matchesPasswordChangePin(data.pin, pending.password_change_pin_hash)) {
        const attempts = pending.attempts + 1;
        if (attempts >= 5) await clearPending();
        else
          await client.query("update app_users set password_change_attempts=$1 where id=$2", [
            attempts,
            userId,
          ]);
        return {
          ok: false as const,
          reason: attempts >= 5 ? ("attempts" as const) : ("invalid" as const),
        };
      }

      await client.query(
        `update app_users set password_hash=pending_password_hash,pending_password_hash=null,
           password_change_pin_hash=null,password_change_pin_expires_at=null,
           password_change_attempts=0 where id=$1`,
        [userId],
      );
      return { ok: true as const };
    });

    if (!outcome.ok) {
      if (outcome.reason === "attempts")
        throw new Error("Limite de tentativas atingido. Solicite um novo PIN.");
      if (outcome.reason === "expired") throw new Error("PIN expirado. Solicite um novo PIN.");
      if (outcome.reason === "missing")
        throw new Error("Não há troca de senha pendente. Solicite um PIN.");
      throw new Error("PIN inválido");
    }
    await recordUserActivity(userId, "Senha alterada após confirmação por email");
    return { ok: true as const };
  });

export const cancelPasswordChange = createServerFn({ method: "POST" }).handler(async () => {
  const { userId } = await getTenantContext();
  await ensureActivitySupportSchema();
  await q(
    `update app_users set pending_password_hash=null,password_change_pin_hash=null,
       password_change_pin_expires_at=null,password_change_attempts=0 where id=$1`,
    [userId],
  );
  return { ok: true as const };
});
