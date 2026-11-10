-- Habilita pedidos de convidados no portal público e acompanhamento bearer-token.
-- Execute em produção após backup; não altera pedidos existentes.
BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_ip text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS public_access_token_hash text;

CREATE INDEX IF NOT EXISTS orders_public_rate_limit_idx
  ON orders(workspace_id, source_ip, created_at DESC)
  WHERE public_access_token_hash IS NOT NULL;

COMMIT;
