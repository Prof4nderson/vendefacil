/**
 * Detecta falhas de conexão com o PostgreSQL (ex.: preview sem DATABASE_URL),
 * para que o app possa usar dados em memória apenas nesse cenário.
 */
export function canUsePreviewFallback(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("DATABASE_URL") ||
    error.message.includes("connect") ||
    error.message.includes("ECONNREFUSED") ||
    error.message.includes("ENOTFOUND") ||
    error.message.includes("getaddrinfo")
  );
}
