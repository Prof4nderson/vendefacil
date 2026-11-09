export type PartnerKarma = {
  partnerId: string;
  partnerName: string;
  score: number;
  levelBronze: boolean;
  levelSilver: boolean;
  levelGold: boolean;
  medals: string[];
};

export function calculateKarmaPoints(actions: {
  radarHelpsCount: number; // Ajudas no Radar de Socorro
  alibabaParticipations: number; // Compras coletivas fechadas
  jitDeliveries: number; // Entregas antecipadas pontuais
}): number {
  return (
    actions.radarHelpsCount * 50 +
    actions.alibabaParticipations * 30 +
    actions.jitDeliveries * 20
  );
}

export function checkMedalUnlocks(score: number): string[] {
  const medals: string[] = [];
  if (score >= 100) medals.push("🥉 Protetor da Praça");
  if (score >= 300) medals.push("🥈 Mestre do JIT");
  if (score >= 600) medals.push("🥇 Lenda do Alibaba B2B");
  if (score >= 1000) medals.push("💎 Titã da Economia Colaborativa");
  return medals;
}