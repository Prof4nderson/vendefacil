import { createServerFn } from "@tanstack/react-start";
import { calculateKarmaPoints, checkMedalUnlocks } from "./ranking.utils";

// Exemplo de payload simulando o banco de dados (ou tabela de parceiros)
export const updatePartnerKarma = createServerFn({ method: "POST" })
  .validator((data: { partnerId: string; radarHelps: number; alibabaCount: number; jitCount: number }) => data)
  .handler(async ({ data }) => {
    // 1. Calcula a nova pontuação baseada nas ações cívico-comerciais
    const newScore = calculateKarmaPoints({
      radarHelpsCount: data.radarHelps,
      alibabaParticipations: data.alibabaCount,
      jitDeliveries: data.jitCount,
    });

    // 2. Verifica quais medalhas foram desbloqueadas
    const unlockedMedals = checkMedalUnlocks(newScore);

    // 3. Persistência no Banco de Dados (Exemplo com SQL / ORM simulado)
    /*
      await db.query(`
        UPDATE partners 
        setItem score = $1, medals = $2, updated_at = NOW() 
        WHERE id = $3
      `, [newScore, JSON.stringify(unlockedMedals), data.partnerId]);
    */

    // Retorna o status atualizado para o front-end
    return {
      success: true,
      partnerId: data.partnerId,
      score: newScore,
      medals: unlockedMedals,
      message: "Score de karma atualizado com sucesso!",
    };
  });