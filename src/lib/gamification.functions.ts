// Módulo de Gamificação e Recompensa por Solidariedade Comercial
export async function awardHelpPoints(tenantId: string, unitsHelped: number) {
  try {
    // Cada unidade emprestada vale 10 pontos de reputação + bônus de solidariedade
    const pointsEarned = unitsHelped * 10 + 50; 

    // Atualiza ou insere pontos no perfil do ambulante
    const query = `
      INSERT INTO merchant_reputation (tenant_id, total_helps, reputation_points, badge_level)
      VALUES ($1, 1, $2, 'Guardião da Praça')
      ON CONFLICT (tenant_id) 
      DO UPDATE SET 
        total_helps = merchant_reputation.total_helps + 1,
        reputation_points = merchant_reputation.reputation_points + $2,
        badge_level = CASE 
          WHEN merchant_reputation.total_helps + 1 >= 10 THEN 'Lenda da Feira 👑'
          WHEN merchant_reputation.total_helps + 1 >= 5 THEN 'Protetor do Lote 🛡️'
          ELSE 'Parceiro Solidário 🤝'
        END;
    `;

    console.log(`[Gamificação do Davi] 🎉 Ambulante ${tenantId} ganhou +${pointsEarned} pontos por salvar um colega!`);

    return {
      success: true,
      pointsEarned,
      message: `Você ganhou ${pointsEarned} pontos de reputação e subiu de nível!`
    };
  } catch (error) {
    console.error("Erro ao creditar pontos de gamificação:", error);
    return { success: false, error: "Falha ao atualizar pontuação." };
  }
}