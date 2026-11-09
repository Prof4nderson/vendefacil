-- Tabela de Campanhas de Compra Coletiva (O "Alibaba" do Davi)
CREATE TABLE IF NOT EXISTS group_buying_campaigns (
    id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- ex: bebidas, insumos
    base_price DECIMAL(10,2) NOT NULL,     -- Preço unitário inicial (sem escala)
    bulk_price DECIMAL(10,2) NOT NULL,     -- Preço unitário final no desconto máximo
    min_units INT NOT NULL,                -- Meta mínima para fechar o lote
    current_units INT DEFAULT 0,           -- Quantidade já reservada pelos ambulantes
    expires_at TIMESTAMP NOT NULL,         -- Data limite do countdown
    status VARCHAR(50) DEFAULT 'active',   -- active, closed, delivered
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Pedidos Individuais dentro da Compra Coletiva
CREATE TABLE IF NOT EXISTS group_buying_orders (
    id SERIAL PRIMARY KEY,
    campaign_id INT REFERENCES group_buying_campaigns(id),
    tenant_id VARCHAR(100) NOT NULL,       -- Identificação do vendedor ambulante
    units INT NOT NULL,                    -- Quantas unidades ele vai levar no lote
    unit_price_locked DECIMAL(10,2) NOT NULL, -- Preço travado no momento da compra
    status VARCHAR(50) DEFAULT 'reserved', -- reserved, paid, ready_for_pickup, completed
    pickup_code VARCHAR(50),               -- Código ou QR Code para retirada no depósito
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserindo uma campanha inicial de teste (Refrigerante em Lote)
INSERT INTO group_buying_campaigns (product_name, category, base_price, bulk_price, min_units, current_units, expires_at)
VALUES 
('Caixa de Refrigerante 600ml (Lote Coletivo)', 'Bebidas', 65.00, 42.50, 500, 320, CURRENT_TIMESTAMP + INTERVAL '3 days');

-- Tabela de Socorro de Estoque entre Ambulantes (P2P / Peer-to-Peer)
CREATE TABLE IF NOT EXISTS inventory_emergency_requests (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL, -- Quem está precisando de socorro
    product_name VARCHAR(150) NOT NULL,
    units_needed INT NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- active, matched, completed, cancelled
    matched_tenant_id VARCHAR(50), -- Quem salvou o dia (emprestou/repasseu)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para busca rápida por região ou status ativo
CREATE INDEX IF NOT EXISTS idx_emergency_status ON inventory_emergency_requests(status);


-- Tabela de Reputação e Pontuação Gamificada dos Ambulantes
CREATE TABLE IF NOT EXISTS merchant_reputation (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) UNIQUE NOT NULL,
    total_helps INT DEFAULT 0,
    reputation_points INT DEFAULT 0,
    badge_level VARCHAR(50) DEFAULT 'Parceiro Iniciante',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de histórico de pontos ganhos por transação de socorro
CREATE TABLE IF NOT EXISTS reputation_history (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    points_earned INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 1. EXTENSÕES E CONFIGURAÇÕES INICIAIS
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 2. TABELA DE ESTABELECIMENTOS / USUÁRIOS
-- =========================================================================
CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(120) NOT NULL,
    establishment_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    whatsapp VARCHAR(30),
    cpf_cnpj VARCHAR(20),
    city VARCHAR(100),
    state VARCHAR(2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 3. TABELAS DE PRODUTOS E ESTOQUE
-- =========================================================================
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(50) PRIMARY KEY,
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(60) PRIMARY KEY,
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    category_id VARCHAR(50) REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    purchase_price NUMERIC(10, 2) DEFAULT 0.00,
    stock INT DEFAULT 0,
    min_stock INT DEFAULT 5,
    needs_kitchen BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 4. TABELA DE PEDIDOS E VENDAS (PDV, ABERTOS E DELIVERIES)
-- =========================================================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    order_number SERIAL,
    customer_name VARCHAR(120) NOT NULL,
    customer_phone VARCHAR(30),
    order_type VARCHAR(20) CHECK (order_type IN ('dine_in', 'delivery')),
    address TEXT,
    payment_method VARCHAR(50),
    amount_paid NUMERIC(10, 2) DEFAULT 0.00,
    credit_amount NUMERIC(10, 2) DEFAULT 0.00,
    total NUMERIC(10, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open', 'finalized', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(60) REFERENCES products(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    qty INT NOT NULL,
    price NUMERIC(10, 2) NOT NULL
);

-- =========================================================================
-- 5. TABELAS DO QG DO DAVI (RANKING, KARMA, MEDALHAS E SOCORRO P2P)
-- =========================================================================
CREATE TABLE IF NOT EXISTS partner_karma (
    partner_id VARCHAR(60) PRIMARY KEY,
    partner_name VARCHAR(120) NOT NULL,
    location VARCHAR(150),
    score INT DEFAULT 0,
    radar_helps_count INT DEFAULT 0,
    alibaba_participations INT DEFAULT 0,
    jit_deliveries INT DEFAULT 0,
    badges JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS radar_socorro_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id VARCHAR(60),
    helper_id VARCHAR(60),
    item_name VARCHAR(120) NOT NULL,
    quantity INT NOT NULL,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 6. ÍNDICES DE PERFORMANCE
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_products_merchant ON products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant_status ON orders(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_karma_score ON partner_karma(score DESC);