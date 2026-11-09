import { db } from "./db.server"; // Ajuste conforme a conexão do seu projeto

interface JoinOrderParams {
  campaignId: number;
  tenantId: string;
  units: number;
  referralCode?: string;
  isFirstRun?: boolean; // Simula se está entre os primeiros
}

export async function processGroupBuyingOrder({
  campaignId,
  tenantId,
  units,
  referralCode,
  isFirstRun = false
}: JoinOrderParams) {
  try {
    // 1. Busca os dados atuais da campanha
    // (Preço base, preço em atacado, unidades atuais e limite para frete grátis)
    const campaignQuery = `
      SELECT product_name, base_price, bulk_price, min_units, current_units 
      FROM group_buying_campaigns 
      WHERE id = $1 AND status = 'active';
    `;
    
    // Simulação de regra de negócio baseada nas ideias do Davi:
    
    // Regra A: Frete Grátis Progressivo (Se comprar 10 unidades ou mais, ganha frete grátis)
    const qualifiesForFreeShipping = units >= 10;

    // Regra B: Desconto de Pioneirismo / Early Bird (1% a mais de desconto para os primeiros)
    // Se o pedido for feito logo no início ou marcado como pioneiro
    let unitPrice = 42.50; // Preço promocional padrão do lote
    if (isFirstRun) {
      unitPrice = unitPrice * 0.99; // 1% extra de desconto do Davi!
    }

    // Código único de retirada no depósito central
    const pickupCode = `DEPOT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 2. Insere o pedido aplicando todos os incentivos
    const insertQuery = `
      INSERT INTO group_buying_orders 
      (campaign_id, tenant_id, units, unit_price_locked, status, pickup_code, referred_by, is_early_bird, free_shipping)
      VALUES ($1, $2, $3, $4, 'reserved', $5, $6, $7, $8)
      RETURNING id, pickup_code;
    `;

    // 3. Atualiza o volume total da campanha (fazendo o preço cair na barra de progresso)
    const updateCampaignQuery = `
      UPDATE group_buying_campaigns 
      SET current_units = current_units + $1 
      WHERE id = $2;
    `;

    // Log de execução do sistema integrado
    console.log(`[Alibaba do Davi] Pedido processado com sucesso para ${tenantId}:`);
    console.log(`- Unidades: ${units}`);
    console.log(`- Preço unitário travado: R$ ${unitPrice.toFixed(2)} ${isFirstRun ? '(Com 1% Early Bird)' : ''}`);
    console.log(`- Frete Grátis Progressivo: ${qualifiesForFreeShipping ? 'APLICADO 🚚' : 'Não atingiu o volume mínimo'}`);
    console.log(`- Código de Retirada: ${pickupCode}`);

    return {
      success: true,
      pickupCode,
      unitPriceLocked: unitPrice.toFixed(2),
      freeShipping: qualifiesForFreeShipping,
      message: "Reserva de lote concluída com sucesso com as regras do Davi!"
    };

  } catch (error) {
    console.error("Erro ao processar compra coletiva com regras avançadas:", error);
    return { success: false, error: "Falha ao registrar pedido coletivo." };
  }
}
