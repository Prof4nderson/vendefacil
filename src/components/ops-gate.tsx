import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { unlockRoute } from "@/lib/gate.functions";
import type { Role } from "@/lib/gate.server";

export function OpsGate({
  role,
  title,
  session,
  children,
}: {
  role: Role;
  title: string;
  session: { roles: string[]; courierId?: string | null; courierName?: string | null } | null;
  children: ReactNode;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const unlock = useServerFn(unlockRoute);

  if (session?.roles.includes(role) || session?.roles.includes("admin")) {
    return <>{children}</>;
  }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await unlock({ data: { route: role, password } });
      if (!res.ok) {
        setError("Senha incorreta");
        setLoading(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Erro ao validar senha");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="font-display mt-4 text-center text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Digite a senha de acesso</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="mt-5 w-full rounded-xl border border-input bg-background px-4 py-3 text-center text-lg tracking-widest"
          placeholder="••••"
          autoFocus
        />
        {error && <p className="mt-2 text-center text-sm font-medium text-destructive">{error}</p>}
        <button
          onClick={submit}
          disabled={loading || !password}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Entrar
        </button>
      </div>
    </div>
  );
}

export function useOpsQuery<T>(
  key: string[],
  fn: () => Promise<T>,
  refetchMs = 5000,
  enabled = true,
) {
  return useQuery({ queryKey: key, queryFn: fn, refetchInterval: refetchMs, enabled });
}

export function hasOpsAccess(
  session: { roles: string[] } | null,
  role: Role,
): boolean {
  return !!session && (session.roles.includes(role) || session.roles.includes("admin"));
}
