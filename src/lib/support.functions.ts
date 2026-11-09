import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1 } from "./db.server";
import { getTenantContext } from "./tenant.server";
import {
  ensureActivitySupportSchema,
  getRequestIp,
  recordUserActivity,
} from "./activity-support.server";

export type SupportMessage = {
  id: string;
  sender_role: "user" | "sysadm";
  message: string;
  created_at: string;
  read_by_user_at: string | null;
};

export const getSupportUnreadCount = createServerFn({ method: "GET" }).handler(async () => {
  const { userId } = await getTenantContext();
  await ensureActivitySupportSchema();
  const row = await q1<{ count: number }>(
    "select count(*)::int as count from support_messages where user_id=$1 and sender_role='sysadm' and read_by_user_at is null",
    [userId],
  );
  return row?.count ?? 0;
});

export const getSupportMessages = createServerFn({ method: "GET" }).handler(async () => {
  const { userId } = await getTenantContext();
  await ensureActivitySupportSchema();
  await q(
    "update support_messages set read_by_user_at=now() where user_id=$1 and sender_role='sysadm' and read_by_user_at is null",
    [userId],
  );
  return q<SupportMessage>(
    "select id,sender_role,message,created_at,read_by_user_at from (select id,sender_role,message,created_at,read_by_user_at from support_messages where user_id=$1 order by created_at desc limit 300) recent order by created_at asc",
    [userId],
  );
});

export const sendSupportMessage = createServerFn({ method: "POST" })
  .validator((data) => z.object({ message: z.string().trim().min(1).max(4000) }).parse(data))
  .handler(async ({ data }) => {
    const { userId } = await getTenantContext();
    await ensureActivitySupportSchema();
    const row = await q1<{ id: string }>(
      "insert into support_messages(user_id,sender_role,message,source_ip,read_by_user_at) values($1,'user',$2,$3,now()) returning id",
      [userId, data.message, getRequestIp()],
    );
    await recordUserActivity(userId, "Mensagem enviada ao suporte");
    return { ok: true as const, id: row?.id ?? null };
  });
