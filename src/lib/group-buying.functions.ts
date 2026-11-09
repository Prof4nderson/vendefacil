import { q1, tx } from "./db.server";

interface JoinOrderParams {
  campaignId: number;
  tenantId: string;
  units: number;
  referralCode?: string;
  isFirstRun?: boolean;
}

export async function processGroupBuyingOrder({
  campaignId,
  tenantId,
  units,
  referralCode,
  isFirstRun = false,
}: JoinOrderParams) {
  if (!Number.isInteger(units) || units < 1) {
    return { success: false, error: "Informe uma quantidade válida." };
  }

  try {
    const result = await tx(async (client) => {
      const campaign = (
        await client.query<{
          product_name: string;
          base_price: number;
          bulk_price: number;
          min_units: number;
          current_units: number;
        }>(
          "select product_name,base_price,bulk_price,min_units,current_units from group_buying_campaigns where id=$1 and status='active' for update",
          [campaignId],
        )
      ).rows[0];
      if (!campaign) throw new Error("Campanha não encontrada ou encerrada.");

      const unitPrice = Number(campaign.bulk_price) * (isFirstRun ? 0.99 : 1);
      const pickupCode = `DEPOT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const order = (
        await client.query<{ id: number; pickup_code: string }>(
          `insert into group_buying_orders
            (campaign_id,tenant_id,units,unit_price_locked,status,pickup_code,referral_code,referred_by,is_early_bird,free_shipping)
           values ($1,$2,$3,$4,'reserved',$5,$6,null,$7,$8)
           returning id,pickup_code`,
          [
            campaignId,
            tenantId,
            units,
            unitPrice,
            pickupCode,
            referralCode ?? null,
            isFirstRun,
            units >= 10,
          ],
        )
      ).rows[0];
      if (!order) throw new Error("Não foi possível registrar a reserva.");

      await client.query(
        "update group_buying_campaigns set current_units=current_units+$1 where id=$2",
        [units, campaignId],
      );
      return {
        pickupCode: order.pickup_code,
        unitPriceLocked: unitPrice.toFixed(2),
        freeShipping: units >= 10,
        productName: campaign.product_name,
      };
    });

    return {
      success: true as const,
      ...result,
      message: "Reserva de lote concluída com sucesso.",
    };
  } catch (error) {
    console.error("Erro ao processar compra coletiva:", error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Falha ao registrar pedido coletivo.",
    };
  }
}

export async function getActiveGroupBuyingCampaign(campaignId: number) {
  return q1("select * from group_buying_campaigns where id=$1 and status='active'", [campaignId]);
}
