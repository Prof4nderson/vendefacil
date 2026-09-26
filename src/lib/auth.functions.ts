import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomInt } from "node:crypto";
import { q, q1 } from "./db.server";

const signupSchema = z.object({
  name: z.string().min(2),
  login: z.string().min(3),
  password: z.string().min(6),
  whatsapp: z.string().min(8),
  email: z.string().email(),
});
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
async function sendPinEmail(email: string, pin: string) {
  const webhook = process.env.EMAIL_WEBHOOK_URL;
  const subject = "Seu PIN de ativação — VendeFácil";
  const text = `Seu código de confirmação é ${pin}. Ele expira em 15 minutos.`;
  if (webhook)
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: email, subject, text }),
    });
  else console.info(`[VendeFácil] PIN de desenvolvimento para ${email}: ${pin}`);
}
export const registerAccount = createServerFn({ method: "POST" })
  .validator((data) => signupSchema.parse(data))
  .handler(async ({ data }) => {
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
    await q(
      `insert into app_users (workspace_id,name,login,password_hash,whatsapp,email,role,verification_pin,pin_expires_at) values ($1,$2,$3,$4,$5,$6,'owner',$7,now()+interval '15 minutes')`,
      [
        workspace?.id ?? null,
        data.name.trim(),
        data.login.trim(),
        hash(data.password),
        data.whatsapp.trim(),
        data.email.trim().toLowerCase(),
        hash(pin),
      ],
    );
    await sendPinEmail(data.email, pin);
    return { ok: true as const };
  });
export const verifyAccount = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ email: z.string().email(), pin: z.string().length(6) }).parse(data),
  )
  .handler(async ({ data }) => {
    const user = await q1<{ id: string }>(
      "select id from app_users where lower(email)=lower($1) and verification_pin=$2 and pin_expires_at > now()",
      [data.email, hash(data.pin)],
    );
    if (!user) throw new Error("PIN inválido ou expirado");
    await q(
      "update app_users set verified_at=now(),verification_pin=null,pin_expires_at=null where id=$1",
      [user.id],
    );
    return { ok: true as const };
  });
export const getUserProfile = createServerFn({ method: "GET" })
  .validator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data }) =>
    q1(
      "select name,login,email,whatsapp,address,cpf_cnpj,cep,city,state from app_users where lower(email)=lower($1)",
      [data.email],
    ),
  );
export const updateUserProfile = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        email: z.string().email(),
        name: z.string().min(2),
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
    await q(
      "update app_users set name=$1,whatsapp=$2,address=$3,cpf_cnpj=$4,cep=$5,city=$6,state=$7 where lower(email)=lower($8)",
      [
        data.name,
        data.whatsapp,
        data.address ?? null,
        data.cpf_cnpj ?? null,
        data.cep ?? null,
        data.city ?? null,
        data.state ?? null,
        data.email,
      ],
    );
    return { ok: true as const };
  });
