import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, q1, tx } from "./db.server";

export type CatalogSuggestion = {
  id: string;
  category_name: string;
  name: string;
  description: string | null;
  suggested_purchase_price: number | string;
  suggested_price: number | string;
  icon: string;
};

export const getCatalogSuggestions = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return await q<CatalogSuggestion>(
      "select * from catalog_suggestions where active=true order by category_name, name",
    );
  } catch {
    return [];
  }
});

export const addCatalogProduct = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        suggestionId: z.string().uuid(),
        stock: z.number().int().min(0).default(0),
        minStock: z.number().int().min(0).default(5),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const suggestion = await q1<CatalogSuggestion>(
      "select * from catalog_suggestions where id=$1 and active=true",
      [data.suggestionId],
    );
    if (!suggestion) throw new Error("Sugestão não encontrada");
    return tx(async (client) => {
      const category = await client.query<{ id: string }>(
        "insert into categories (name) values ($1) on conflict (name) do update set name=excluded.name returning id",
        [suggestion.category_name],
      );
      const categoryId = category.rows[0]?.id;
      const existing = await client.query<{ id: string }>(
        "select id from products where lower(name)=lower($1) limit 1",
        [suggestion.name],
      );
      if (existing.rows[0])
        return { ok: true as const, productId: existing.rows[0].id, alreadyExists: true as const };
      const inserted = await client.query<{ id: string }>(
        "insert into products (category_id,name,description,price,purchase_price,stock,min_stock,available,needs_kitchen) values ($1,$2,$3,$4,$5,$6,$7,true,false) returning id",
        [
          categoryId,
          suggestion.name,
          suggestion.description,
          suggestion.suggested_price,
          suggestion.suggested_purchase_price,
          data.stock,
          data.minStock,
        ],
      );
      return { ok: true as const, productId: inserted.rows[0]?.id, alreadyExists: false as const };
    });
  });

export const importCatalogCsv = createServerFn({ method: "POST" })
  .validator((data) => z.object({ csv: z.string().min(5) }).parse(data))
  .handler(async ({ data }) => {
    const lines = data.csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const header = (lines.shift() ?? "").split(/[;,]/).map((x) => x.trim().toLowerCase());
    const index = (names: string[], fallback: number) => {
      const found = header.findIndex((h) => names.includes(h));
      return found >= 0 ? found : fallback;
    };
    const nameIndex = index(["nome", "name", "produto"], 0);
    const categoryIndex = index(["categoria", "category"], 1);
    const priceIndex = index(["preco", "preço", "price", "preco_venda"], 2);
    const purchaseIndex = index(["preco_compra", "preço_compra", "purchase_price"], 3);
    const stockIndex = index(["estoque", "stock"], 4);
    const minIndex = index(["estoque_minimo", "min_stock", "minimo"], 5);
    let imported = 0;
    await tx(async (client) => {
      for (const line of lines) {
        const cols = line.split(/[;,]/).map((x) => x.trim());
        const name = cols[nameIndex];
        if (!name) continue;
        const categoryName = cols[categoryIndex] || "Outros";
        const price = Number((cols[priceIndex] || "0").replace(",", "."));
        const purchase = Number((cols[purchaseIndex] || "0").replace(",", "."));
        const stock = Number(cols[stockIndex] || 0) || 0;
        const minStock = Number(cols[minIndex] || 5) || 5;
        const category = await client.query<{ id: string }>(
          "insert into categories (name) values ($1) on conflict (name) do update set name=excluded.name returning id",
          [categoryName],
        );
        await client.query(
          "insert into products (category_id,name,price,purchase_price,stock,min_stock,available,needs_kitchen) values ($1,$2,$3,$4,$5,$6,true,false) on conflict do nothing",
          [category.rows[0]?.id, name, price, purchase, stock, minStock],
        );
        imported++;
      }
    });
    return { ok: true as const, imported };
  });

export const getCustomers = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return await q<{
      id: string;
      name: string;
      phone: string | null;
      credit_balance: number | string;
    }>("select id, name, phone, credit_balance from customers order by updated_at desc, name");
  } catch {
    return [];
  }
});
