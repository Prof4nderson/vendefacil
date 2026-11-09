import { isIP } from "node:net";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { q, tx } from "./db.server";

const SCHEMA_LOCK = "vendefacil_activity_support_schema_v1";
let schemaReady: Promise<void> | null = null;

export function getRequestIp(): string | null {
  try {
    const headers = getRequestHeaders();
    const candidates = [
      headers.get("cf-connecting-ip"),
      headers.get("x-real-ip"),
      headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    ];
    for (const candidate of candidates) {
      const value = candidate?.trim();
      if (value && isIP(value)) return value;
    }
  } catch {
    // A chamada pode ocorrer fora de um request HTTP, como em tarefas internas.
  }
  return null;
}

export function ensureActivitySupportSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = tx(async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [SCHEMA_LOCK]);
      await client.query(
        "alter table app_users add column if not exists last_login_at timestamptz",
      );
      await client.query(
        "alter table app_users add column if not exists pending_password_hash text",
      );
      await client.query(
        "alter table app_users add column if not exists password_change_pin_hash text",
      );
      await client.query(
        "alter table app_users add column if not exists password_change_pin_expires_at timestamptz",
      );
      await client.query(
        "alter table app_users add column if not exists password_change_attempts int not null default 0",
      );
      await client.query(
        "alter table app_users add column if not exists password_change_sent_at timestamptz",
      );
      await client.query(`create table if not exists user_activity_logs (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references app_users(id) on delete cascade,
      action text not null,
      details text,
      source_ip text,
      created_at timestamptz not null default now()
    )`);
      await client.query(`create table if not exists support_messages (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references app_users(id) on delete cascade,
      sender_role text not null check (sender_role in ('user','sysadm')),
      message text not null,
      source_ip text,
      created_at timestamptz not null default now(),
      read_by_user_at timestamptz,
      read_by_sysadm_at timestamptz
    )`);
      await client.query(
        "create index if not exists user_activity_logs_created_idx on user_activity_logs(created_at desc)",
      );
      await client.query(
        "create index if not exists user_activity_logs_user_created_idx on user_activity_logs(user_id,created_at desc)",
      );
      await client.query(
        "create index if not exists support_messages_user_created_idx on support_messages(user_id,created_at)",
      );
      await client.query(
        "create index if not exists support_messages_unread_sysadm_idx on support_messages(created_at desc) where sender_role='user' and read_by_sysadm_at is null",
      );
    }).catch((error: unknown) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function recordUserActivity(
  userId: string,
  action: string,
  details?: string | null,
  sourceIp = getRequestIp(),
) {
  try {
    await ensureActivitySupportSchema();
    await q(
      "insert into user_activity_logs(user_id,action,details,source_ip) values($1,$2,$3,$4)",
      [userId, action.slice(0, 120), details?.slice(0, 500) || null, sourceIp],
    );
  } catch (error) {
    // Auditoria não deve interromper login, cadastro, vendas ou suporte.
    console.error("Falha ao registrar atividade do usuário", {
      message: error instanceof Error ? error.message.slice(0, 200) : "erro desconhecido",
      action,
    });
  }
}
