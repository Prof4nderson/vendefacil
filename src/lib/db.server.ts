import { Pool, type QueryResultRow } from "pg";

let pool: Pool | undefined;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não configurada. Defina a conexão do PostgreSQL no arquivo .env.",
    );
  }
  const sslRequired =
    /sslmode=require/.test(connectionString) ||
    (!/localhost|127\.0\.0\.1|@postgres[:/]/.test(connectionString) &&
      process.env["PGSSL_DISABLE"] !== "true");
  pool = new Pool({
    connectionString,
    max: Number(process.env["PGPOOL_MAX"] ?? 5),
    ...(sslRequired ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  return pool;
}

/** Executa uma consulta parametrizada e devolve todas as linhas. */
export async function q<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query<T>(sql, params as never[]);
  return res.rows;
}

/** Primeira linha ou null. */
export async function q1<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

/** Executa várias consultas dentro de uma transação. */
export async function tx<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
