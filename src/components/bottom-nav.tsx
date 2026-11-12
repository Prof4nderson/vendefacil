import { Link } from "@tanstack/react-router";
import { Gift, Heart, Home, ReceiptText } from "lucide-react";

const ITEMS = [
  { to: "/", icon: Home, label: "Início" },
  { to: "/ofertas", icon: Gift, label: "Ofertas" },
  { to: "/pedidos", icon: ReceiptText, label: "Pedidos" },
  { to: "/favoritos", icon: Heart, label: "Favoritos" },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-4 bottom-4 z-30 mx-auto grid max-w-xl grid-cols-4 gap-1 rounded-[1.6rem] border border-border bg-glass-strong p-2 text-muted-foreground shadow-2xl backdrop-blur-2xl">
      {ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.to === "/" }}
          className="flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[0.68rem] font-bold"
          activeProps={{ className: "neon-pill text-primary" }}
        >
          <item.icon className="h-4 w-4" />
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
