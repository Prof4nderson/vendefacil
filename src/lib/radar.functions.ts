import { createServerFn } from "@tanstack/react-start";

// Tipos para os eventos do Radar de Socorro
export type RadarEvent = {
  id: string;
  requesterName: string;
  itemName: string;
  quantity: number;
  location: string;
  status: "pending" | "matched" | "completed";
  createdAt: string;
};

// Simulação de banco em memória ou conexão SQL
let radarEventsStore: RadarEvent[] = [
  {
    id: "radar-1",
    requesterName: "Pastelaria da Maria",
    itemName: "Óleo de Soja 900ml",
    quantity: 3,
    location: "Rua do Comércio",
    status: "pending",
    createdAt: "Há 5 minutos",
  },
  {
    id: "radar-2",
    requesterName: "Bebidas do Alemão",
    itemName: "Cerveja Lata 350ml",
    quantity: 12,
    location: "Esquina Cultural",
    status: "pending",
    createdAt: "Há 12 minutos",
  },
];

// 1. Server Function para Listar os Pedidos de Socorro Abertos
export const getRadarEvents = createServerFn({ method: "GET" }).handler(async () => {
  // Em produção: SELECT * FROM radar_socorro_events WHERE status = 'pending'
  return radarEventsStore;
});

// 2. Server Function para Criar um Pedido de Socorro
export const createRadarRequest = createServerFn({ method: "POST" })
  .validator((data: { requesterName: string; itemName: string; quantity: number; location: string }) => data)
  .handler(async ({ data }) => {
    const newEvent: RadarEvent = {
      id: `radar-${Date.now()}`,
      requesterName: data.requesterName,
      itemName: data.itemName,
      quantity: data.quantity,
      location: data.location,
      status: "pending",
      createdAt: "Agora mesmo",
    };

    radarEventsStore.unshift(newEvent);

    // Em produção: INSERT INTO radar_socorro_events (...) VALUES (...)

    return {
      success: true,
      event: newEvent,
      message: "Alerta de socorro disparado na praça!",
    };
  });

// 3. Server Function para Aceitar um Pedido de Socorro (Estoque Cruzado)
export const acceptRadarRequest = createServerFn({ method: "POST" })
  .validator((data: { eventId: string; helperName: string }) => data)
  .handler(async ({ data }) => {
    const eventIndex = radarEventsStore.findIndex((e) => e.id === data.eventId);

    if (eventIndex === -1) {
      throw new Error("Pedido de socorro não encontrado ou já atendido.");
    }

    radarEventsStore[eventIndex].status = "matched";

    // Em produção: UPDATE radar_socorro_events SET status = 'matched', helper_id = $1 WHERE id = $2

    return {
      success: true,
      message: `Socorro aceito com sucesso por ${data.helperName}! O estoque cruzado está a caminho.`,
    };
  });