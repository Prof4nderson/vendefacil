import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1, tx } from "./db.server";
import { getAppSession } from "./tenant.server";
import { hashPassword, passwordMatches } from "./gate.server";
import { useSession } from "@tanstack/react-start/server";

const SYSADM_INITIAL_HASH = "0756cbd33bb23eb3c467b8564057c9f693d5fc4b6854de0b8365efdf25c25eb0";
type SysSession = { authenticated?: boolean };
const getSysSession = () => {
  const password = process.env["SYSADM_SESSION_SECRET"];
  if (!password || password.length < 32) {
    throw new Error("Configure SYSADM_SESSION_SECRET com pelo menos 32 caracteres aleatórios");
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSession<SysSession>({
    password,
    name: "vendefacil-sysadm",
    maxAge: 60 * 60 * 12,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  });
};
async function requireSysAdm() {
  const session = await getSysSession();
  if (!session.data.authenticated) throw new Error("Acesso SysAdm necessário");
  return session;
}

export const getSysadmSession = createServerFn({ method: "GET" }).handler(async () => ({
  authenticated: !!(await getSysSession()).data.authenticated,
}));
export const sysadmLogin = createServerFn({ method: "POST" })
  .validator((data) => z.object({ password: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const row = await q1<{ password_hash: string }>(
      "select password_hash from sysadm_credentials where id=1",
    ).catch(() => null);
    const expected = row?.password_hash ?? SYSADM_INITIAL_HASH;
    if (!passwordMatches(data.password, expected))
      return { ok: false as const, message: "Senha do SysAdm inválida" };
    await (await getSysSession()).update({ authenticated: true });
    return { ok: true as const };
  });
export const sysadmLogout = createServerFn({ method: "POST" }).handler(async () => {
  await (await getSysSession()).clear();
  return { ok: true as const };
});

export type SysUser = {
  id: string;
  workspace_id: string;
  workspace_name: string;
  name: string;
  login: string;
  email: string;
  whatsapp: string;
  role: string;
  status: string;
  status_note: string | null;
  verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  unread_messages: number;
};
export const sysadmListUsers = createServerFn({ method: "GET" })
  .validator((data) => z.object({ search: z.string().max(200).optional() }).parse(data ?? {}))
  .handler(async ({ data }) => {
    await requireSysAdm();
    const search = data.search?.trim() ?? "";
    return q<SysUser>(
      `select u.id,u.workspace_id,w.name workspace_name,u.name,u.login,u.email,u.whatsapp,u.role,u.status,u.status_note,u.verified_at,u.last_login_at,u.created_at,(select count(*) from system_messages m where m.user_id=u.id and m.read_at is null)::int unread_messages
       from app_users u left join workspaces w on w.id=u.workspace_id
       where $1='' or concat_ws(' ',u.name,u.login,u.email,u.whatsapp,w.name) ilike '%' || $1 || '%'
       order by u.created_at desc limit 500`,
      [search],
    );
  });
const userInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2),
  login: z.string().min(3),
  email: z.string().email(),
  whatsapp: z.string().min(8),
  password: z.string().min(6).optional(),
  role: z.enum(["owner", "manager", "operator"]),
  status: z.enum(["active", "disabled", "suspended"]),
  status_note: z.string().optional(),
  workspace_name: z.string().min(2),
});
export const sysadmSaveUser = createServerFn({ method: "POST" })
  .validator((data) => userInput.parse(data))
  .handler(async ({ data }) => {
    await requireSysAdm();
    return tx(async (client) => {
      if (data.id) {
        const params = [
          data.name.trim(),
          data.login.trim(),
          data.email.trim().toLowerCase(),
          data.whatsapp.trim(),
          data.role,
          data.status,
          data.status_note?.trim() || null,
          data.workspace_name.trim(),
          data.id,
        ];
        await client.query(
          "update app_users set name=$1,login=$2,email=$3,whatsapp=$4,role=$5,status=$6,status_note=$7 where id=$9",
          params,
        );
        const user = (
          await client.query<{ workspace_id: string }>(
            "select workspace_id from app_users where id=$1",
            [data.id],
          )
        ).rows[0];
        if (!user) throw new Error("Usuário não encontrado");
        await client.query("update workspaces set name=$1 where id=$2", [
          data.workspace_name.trim(),
          user.workspace_id,
        ]);
        if (data.password)
          await client.query("update app_users set password_hash=$1 where id=$2", [
            hashPassword(data.password),
            data.id,
          ]);
        return { ok: true as const, id: data.id };
      }
      if (!data.password) throw new Error("Defina uma senha inicial para o novo usuário");
      const workspace = (
        await client.query<{ id: string }>("insert into workspaces(name) values($1) returning id", [
          data.workspace_name.trim(),
        ])
      ).rows[0];
      if (!workspace) throw new Error("Não foi possível criar o espaço do usuário");
      const user = (
        await client.query<{ id: string }>(
          "insert into app_users(workspace_id,name,login,password_hash,whatsapp,email,role,status,status_note,verified_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,now()) returning id",
          [
            workspace.id,
            data.name.trim(),
            data.login.trim(),
            hashPassword(data.password),
            data.whatsapp.trim(),
            data.email.trim().toLowerCase(),
            data.role,
            data.status,
            data.status_note?.trim() || null,
          ],
        )
      ).rows[0];
      if (!user) throw new Error("Não foi possível criar o usuário");
      return { ok: true as const, id: user.id };
    });
  });
export const sysadmDeleteUser = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await requireSysAdm();
    await tx(async (client) => {
      const user = (
        await client.query<{ workspace_id: string }>(
          "select workspace_id from app_users where id=$1",
          [data.id],
        )
      ).rows[0];
      if (!user) throw new Error("Usuário não encontrado");
      await client.query("delete from app_users where id=$1", [data.id]);
      const remaining = (
        await client.query<{ count: string }>(
          "select count(*)::text count from app_users where workspace_id=$1",
          [user.workspace_id],
        )
      ).rows[0];
      if (Number(remaining?.count ?? 0) === 0)
        await client.query("delete from workspaces where id=$1", [user.workspace_id]);
    });
    return { ok: true as const };
  });
export const sysadmSetUserStatus = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["active", "disabled", "suspended"]),
        note: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireSysAdm();
    await q("update app_users set status=$1,status_note=$2 where id=$3", [
      data.status,
      data.note?.trim() || null,
      data.id,
    ]);
    return { ok: true as const };
  });
export const sysadmSendMessage = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ userId: z.string().uuid(), message: z.string().min(1).max(2000) }).parse(data),
  )
  .handler(async ({ data }) => {
    await requireSysAdm();
    await q("insert into system_messages(user_id,message) values($1,$2)", [
      data.userId,
      data.message.trim(),
    ]);
    return { ok: true as const };
  });

export type GlobalProduct = {
  id: string;
  category_id: string;
  category_name: string;
  name: string;
  description: string | null;
  suggested_purchase_price: number;
  suggested_price: number;
  icon: string;
  image_url: string | null;
  active: boolean;
};
async function ensureGlobalCategories() {
  await tx(async (client) => {
    await client.query(
      "create table if not exists global_catalog_categories (id uuid primary key default gen_random_uuid(), name text not null unique, created_at timestamptz not null default now())",
    );
    await client.query(
      `insert into global_catalog_categories(name)
       select min(trim(category_name)) from catalog_suggestions where trim(category_name)<>''
       group by lower(trim(category_name))
       on conflict (name) do nothing`,
    );
  });
}

export type GlobalCatalogCategory = { id: string; name: string };
export const sysadmListCategories = createServerFn({ method: "GET" }).handler(async () => {
  await requireSysAdm();
  await ensureGlobalCategories();
  return q<GlobalCatalogCategory>("select id,name from global_catalog_categories order by name");
});

export const sysadmSaveCategory = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(80) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireSysAdm();
    await ensureGlobalCategories();
    await tx(async (client) => {
      const duplicate = (
        await client.query<{ id: string }>(
          "select id from global_catalog_categories where lower(name)=lower($1) and ($2::uuid is null or id<>$2) limit 1",
          [data.name, data.id ?? null],
        )
      ).rows[0];
      if (duplicate) throw new Error("Já existe uma categoria global com esse nome");
      if (data.id) {
        const oldCategory = (
          await client.query<{ name: string }>(
            "select name from global_catalog_categories where id=$1",
            [data.id],
          )
        ).rows[0];
        if (!oldCategory) throw new Error("Categoria global não encontrada");
        const updated = await client.query(
          "update global_catalog_categories set name=$1 where id=$2",
          [data.name, data.id],
        );
        if (!updated.rowCount) throw new Error("Categoria global não encontrada");
        await client.query(
          "update catalog_suggestions set category_name=$1 where lower(category_name)=lower($2)",
          [data.name, oldCategory.name],
        );
      } else {
        await client.query("insert into global_catalog_categories(name) values($1)", [data.name]);
      }
    });
    return { ok: true as const };
  });

export const sysadmDeleteCategory = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await requireSysAdm();
    await ensureGlobalCategories();
    await tx(async (client) => {
      const category = (
        await client.query<{ name: string }>(
          "select name from global_catalog_categories where id=$1",
          [data.id],
        )
      ).rows[0];
      if (!category) throw new Error("Categoria global não encontrada");
      const products = (
        await client.query<{ count: string }>(
          "select count(*)::text as count from catalog_suggestions where lower(category_name)=lower($1)",
          [category.name],
        )
      ).rows[0];
      if (Number(products?.count ?? 0) > 0)
        throw new Error(
          "A categoria possui produtos globais. Mova ou exclua os produtos antes de removê-la.",
        );
      await client.query("delete from global_catalog_categories where id=$1", [data.id]);
    });
    return { ok: true as const };
  });

export const sysadmListProducts = createServerFn({ method: "GET" })
  .validator((data) => z.object({ search: z.string().max(200).optional() }).parse(data ?? {}))
  .handler(async ({ data }) => {
    await requireSysAdm();
    await ensureGlobalCategories();
    return q<GlobalProduct>(
      `select s.id,c.id as category_id,c.name as category_name,s.name,s.description,s.suggested_purchase_price,s.suggested_price,s.icon,s.image_url,s.active
       from catalog_suggestions s join global_catalog_categories c on lower(c.name)=lower(s.category_name)
       where $1='' or concat_ws(' ',s.name,s.description,c.name) ilike '%' || $1 || '%'
       order by c.name,s.name limit 1000`,
      [data.search?.trim() ?? ""],
    );
  });
const globalProductInput = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().optional(),
  suggested_purchase_price: z.number().min(0),
  suggested_price: z.number().min(0),
  icon: z.string().min(1),
  image_url: z.string().optional(),
  active: z.boolean(),
});
export const sysadmSaveProduct = createServerFn({ method: "POST" })
  .validator((data) => globalProductInput.parse(data))
  .handler(async ({ data }) => {
    await requireSysAdm();
    await ensureGlobalCategories();
    return tx(async (client) => {
      const category = (
        await client.query<GlobalCatalogCategory>(
          "select id,name from global_catalog_categories where id=$1",
          [data.category_id],
        )
      ).rows[0];
      if (!category) throw new Error("Selecione uma categoria global válida");
      let oldName: string | null = null;
      if (data.id)
        oldName =
          (
            await client.query<{ name: string }>(
              "select name from catalog_suggestions where id=$1",
              [data.id],
            )
          ).rows[0]?.name ?? null;
      const row = data.id
        ? (
            await client.query<{ id: string }>(
              "update catalog_suggestions set category_name=$1,name=$2,description=$3,suggested_purchase_price=$4,suggested_price=$5,icon=$6,image_url=$7,active=$8 where id=$9 returning id",
              [
                category.name,
                data.name,
                data.description || null,
                data.suggested_purchase_price,
                data.suggested_price,
                data.icon,
                data.image_url || null,
                data.active,
                data.id,
              ],
            )
          ).rows[0]
        : (
            await client.query<{ id: string }>(
              "insert into catalog_suggestions(category_name,name,description,suggested_purchase_price,suggested_price,icon,image_url,active) values($1,$2,$3,$4,$5,$6,$7,$8) returning id",
              [
                category.name,
                data.name,
                data.description || null,
                data.suggested_purchase_price,
                data.suggested_price,
                data.icon,
                data.image_url || null,
                data.active,
              ],
            )
          ).rows[0];
      if (!row) throw new Error("Produto global não encontrado");
      await client.query(
        `update products p set name=s.name,description=s.description,price=s.suggested_price,purchase_price=s.suggested_purchase_price,image_url=s.image_url,available=s.active,catalog_suggestion_id=s.id from catalog_suggestions s where s.id=$1 and (p.catalog_suggestion_id=s.id or lower(p.name)=lower($2))`,
        [row.id, oldName ?? data.name],
      );
      return { ok: true as const, id: row.id };
    });
  });
export const sysadmDeleteProduct = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await requireSysAdm();
    await tx(async (client) => {
      await client.query(
        "update products set available=false,catalog_suggestion_id=null where catalog_suggestion_id=$1",
        [data.id],
      );
      await client.query("delete from catalog_suggestions where id=$1", [data.id]);
    });
    return { ok: true as const };
  });
export const sysadmChangePassword = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) }).parse(data),
  )
  .handler(async ({ data }) => {
    await requireSysAdm();
    const current = await q1<{ password_hash: string }>(
      "select password_hash from sysadm_credentials where id=1",
    ).catch(() => null);
    if (current && !passwordMatches(data.currentPassword, current.password_hash))
      throw new Error("Senha atual do SysAdm inválida");
    await q(
      "insert into sysadm_credentials(id,password_hash) values(1,$1) on conflict(id) do update set password_hash=excluded.password_hash",
      [hashPassword(data.newPassword)],
    );
    return { ok: true as const };
  });

export async function getUserMessagesAfterLogin(userId: string) {
  const messages = await q<{ message: string; created_at: string }>(
    "select message,created_at from system_messages where user_id=$1 and read_at is null order by created_at",
    [userId],
  );
  if (messages.length)
    await q("update system_messages set read_at=now() where user_id=$1 and read_at is null", [
      userId,
    ]);
  return messages;
}
