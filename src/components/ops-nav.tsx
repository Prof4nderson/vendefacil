import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Bike, ChefHat, LockKeyhole, Settings2, Wallet } from "lucide-react";
import type { Role } from "@/lib/gate.server";

export type OpsSession = {
  roles: string[];
  courierId?: string | null;
  courierName?: string | null;
};

type OpsItem = {
  to: "/admin" | "/cozinha" | "/entrega" | "/caixa";
  label: string;
  role: Role;
  icon: LucideIcon;
};

const ITEMS: OpsItem[] = [
  { to: "/admin", label: "Admin", role: "admin", icon: Settings2 },
  { to: "/cozinha", label: "Cozinha", role: "cozinha", icon: ChefHat },
  { to: "/entrega", label: "Entregas", role: "entrega", icon: Bike },
  { to: "/caixa", label: "Caixa", role: "caixa", icon: Wallet },
];

function hasAccess(session: OpsSession, role: Role) {
  return session.roles.includes("admin") || session.roles.includes(role);
}

export function OpsNav({ session, active }: { session: OpsSession; active: string }) {
  const visibleItems = ITEMS.filter((item) => hasAccess(session, item.role));

  return (
    <nav aria-label="Áreas operacionais" className="ops-nav page-enter-delay-1">
      <Link to="/" className="ops-nav-home" aria-label="Voltar ao cardápio">
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Cardápio</span>
      </Link>
      <div className="ops-nav-links">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const selected = active === item.to.slice(1);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`ops-nav-link ${selected ? "is-active" : ""}`}
              aria-current={selected ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function OpsHeader({
  title,
  subtitle,
  icon: Icon,
  session,
  active,
  onLock,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  session: OpsSession;
  active: string;
  onLock?: () => void;
}) {
  return (
    <>
      <header className="ops-header page-enter">
        <div className="flex min-w-0 items-center gap-3">
          <div className="ops-icon-badge" aria-hidden="true">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Painel operacional</p>
            <h1 className="truncate font-display text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {session.courierName && <span className="user-pill">{session.courierName}</span>}
          {onLock && (
            <button
              type="button"
              onClick={onLock}
              className="icon-button"
              aria-label="Bloquear painel"
              title="Bloquear painel"
            >
              <LockKeyhole className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>
      <OpsNav session={session} active={active} />
    </>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  count,
}: {
  eyebrow?: string;
  title: string;
  count?: number;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {typeof count === "number" && <span className="count-badge">{count}</span>}
    </div>
  );
}
