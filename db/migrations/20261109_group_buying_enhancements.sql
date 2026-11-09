-- Migration para adicionar as ideias de bônus, indicação e frete grátis do Davi
-- Aplicada em banco de dados existente de forma segura (sem perda de dados)

-- 1. Adiciona colunas de controle na tabela de pedidos coletivos se elas não existirem
DO $$ 
BEGIN
    -- Verifica e adiciona a coluna de código de indicação
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='group_buying_orders' and column_name='referral_code') THEN
        ALTER TABLE group_buying_orders ADD COLUMN referral_code VARCHAR(50);
    END IF;

    -- Verifica e adiciona a coluna de quem indicou
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='group_buying_orders' and column_name='referred_by') THEN
        ALTER TABLE group_buying_orders ADD COLUMN referred_by VARCHAR(50);
    END IF;

    -- Verifica e adiciona a coluna de bônus por pioneirismo (early bird / 1% extra)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='group_buying_orders' and column_name='is_early_bird') THEN
        ALTER TABLE group_buying_orders ADD COLUMN is_early_bird BOOLEAN DEFAULT FALSE;
    END IF;

    -- Verifica e adiciona a coluna de frete grátis progressivo baseado no volume
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='group_buying_orders' and column_name='free_shipping') THEN
        ALTER TABLE group_buying_orders ADD COLUMN free_shipping BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
