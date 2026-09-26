import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, UtensilsCrossed } from "lucide-react";
import { getMenuData } from "@/lib/public.functions";
import { brl } from "@/lib/format";
import { getFavorites, toggleFavorite } from "@/lib/local-store";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/favoritos")({
  loader: () => getMenuData(),
  head: () => ({
    meta: [
      { title: "Favoritos — seus pratos preferidos" },
      { name: "description", content: "Seus pratos favoritos salvos para pedir mais rápido na próxima vez." },
      { property: "og:title", content: "Favoritos — seus pratos preferidos" },
      { property: "og:description", content: "Seus pratos favoritos salvos para pedir mais rápido na próxima vez." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FavoritesPage,
});

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
};

function FavoritesPage() {
  const menu = Route.useLoaderData();
  const products = menu.products as Product[];
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => setIds(getFavorites()), []);

  const favorites = products.filter((p) => ids.includes(p.id));

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-28 pt-6">
      <h1 className="font-display text-3xl font-extrabold">Favoritos</h1>
      <p className="mt-1 text-sm text-muted-foreground">Toque no coração no cardápio para salvar um prato aqui.</p>

      <section className="mt-6 space-y-3">
        {favorites.map((p) => (
          <article key={p.id} className="glass-card flex items-center gap-3 rounded-[1.5rem] p-3">
            <div className="icon-tile h-20 w-20 shrink-0 overflow-hidden rounded-[1.25rem]">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <UtensilsCrossed className="m-auto h-8 w-8 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-extrabold">{p.name}</h2>
              {p.description && <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
              <span className="mt-1 block text-sm font-black text-primary">{brl(p.price)}</span>
            </div>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-9 w-9 shrink-0 rounded-full"
              aria-label="Remover dos favoritos"
              onClick={() => setIds(toggleFavorite(p.id))}
            >
              <Heart className="h-4 w-4 fill-current text-primary" />
            </Button>
          </article>
        ))}
        {favorites.length === 0 && (
          <div className="glass-card rounded-[1.5rem] py-16 text-center">
            <p className="text-muted-foreground">Nenhum favorito salvo ainda.</p>
            <Link to="/" className="neon-button mt-4 inline-flex rounded-full px-5 py-3 text-sm font-bold">
              Ver cardápio
            </Link>
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  );
}
