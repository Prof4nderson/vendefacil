import { createServerFn } from "@tanstack/react-start";

export const getCashClosingData = createServerFn({ method: "GET" }).handler(async () => {
  // Em produção, você faria uma query SQL real no PostgreSQL/GaussDB:
  /*
    const queryResult = await db.query(`
      SELECT 
        SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) as cash_sales,
        SUM(CASE WHEN payment_method = 'pix' THEN total ELSE 0 END) as pix_sales,
        SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END) as card_sales,
        SUM(total) as total_revenue
      FROM orders 
      WHERE status = 'finalized' AND DATE(created_at) = CURRENT_DATE
    `);
  */

  // Dados consolidados do banco (simulação de alta fidelidade)
  return {
    initialBalance: 150.00, // Fundo de troco inicial cadastrado no turno
    cashSales: 1240.00,
    pixSales: 2150.00,
    cardSales: 1890.00,
    sangrias: 200.00,
    totalCost: 1980.00, // Calculado via order_items e purchase_price
    transactionCount: 48,
  };
});