import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, UtensilsCrossed } from "lucide-react";
import { getMenuData, getSettings } from "@/lib/public.functions";
import { brl } from "@/lib/format";
import { BottomNav } from "@/components/bottom-nav";

export const Route = createFileRoute("/ofertas")({
  loader: async () => {
    const [menu, settings] = await Promise.all([getMenuData(), getSettings()]);
    return { menu, settings };
  },
  head: () => ({
    meta: [
      { title: "Ofertas do dia — cardápio com desconto" },
      { name: "description", content: "Combos e pratos em destaque com desconto especial de hoje." },
      { property: "og:title", content: "Ofertas do dia — cardápio com desconto" },
      { property: "og:description", content: "Combos e pratos em destaque com desconto especial de hoje." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OffersPage,
});

type Product = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  stock: number;
};

function OffersPage() {
  const { menu } = Route.useLoaderData();
  const products = (menu.products as Product[]).filter((p) => p.stock > 0);
  const dailyIds = new Set(menu.dailyIds as string[]);
  const offers = [...products].sort((a, b) => Number(b.price) - Number(a.price)).slice(0, 6);

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-28 pt-6">
      <h1 className="font-display text-3xl font-extrabold">Ofertas de hoje</h1>
      <p className="mt-1 text-sm text-muted-foreground">Descontos válidos enquanto durar o estoque.</p>

      <section className="mt-6 space-y-3">
        {offers.map((p) => {
          const price = Number(p.price);
          return (
            <article key={p.id} className="glass-card flex items-center gap-3 rounded-[1.5rem] p-3">
              <div className="icon-tile h-20 w-20 shrink-0 overflow-hidden rounded-[1.25rem]">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <UtensilsCrossed className="m-auto h-8 w-8 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="neon-pill inline-flex rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold">
                  {dailyIds.has(p.id) ? "Prato do dia" : "20% OFF"}
                </p>
                <h2 className="mt-1.5 truncate text-sm font-extrabold">{p.name}</h2>
                {p.description && <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-sm font-black text-primary">{brl(price * 0.8)}</span>
                  <span className="text-xs font-medium text-muted-foreground line-through">{brl(price)}</span>
                </div>
              </div>
            </article>
          );
        })}
        {offers.length === 0 && (
          <p className="glass-card rounded-[1.5rem] py-16 text-center text-muted-foreground">
            Nenhuma oferta disponível agora.
          </p>
        )}
      </section>

      <Link to="/" className="neon-button mt-6 flex items-center justify-center gap-2 rounded-[1.35rem] px-5 py-4 font-bold">
        <Sparkles className="h-4 w-4" /> Ver cardápio completo
      </Link>

      <BottomNav />
    </div>
  );
}
