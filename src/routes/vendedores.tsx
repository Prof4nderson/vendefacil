import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Store, UtensilsCrossed } from "lucide-react";
import { useMemo, useState } from "react";
import { getPublicVendors } from "@/lib/public.functions";
import { brl } from "@/lib/format";
import { BottomNav } from "@/components/bottom-nav";

export const Route = createFileRoute("/vendedores")({
  loader: () => getPublicVendors(),
  head: () => ({
    meta: [
      { title: "Escolha um vendedor — VendeFácil" },
      {
        name: "description",
        content: "Encontre vendedores e explore seus cardápios públicos no VendeFácil.",
      },
      { property: "og:title", content: "Vendedores — VendeFácil" },
      {
        property: "og:description",
        content: "Encontre um estabelecimento e veja o cardápio disponível.",
      },
    ],
  }),
  component: VendorsPage,
});

type Vendor = {
  id: string;
  name: string;
  product_count: number;
  min_price: number | string | null;
};

function VendorsPage() {
  const vendors = Route.useLoaderData() as Vendor[];
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return vendors;
    return vendors.filter((vendor) => vendor.name.toLocaleLowerCase("pt-BR").includes(query));
  }, [search, vendors]);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-28 pt-8 sm:px-6">
      <header className="glass-card overflow-hidden rounded-[2rem] p-6 sm:p-9">
        <div className="flex items-center gap-3 text-primary">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10">
            <Store className="h-6 w-6" />
          </span>
          <span className="eyebrow">VendeFácil · portal público</span>
        </div>
        <h1 className="mt-5 max-w-2xl font-display text-3xl font-extrabold sm:text-4xl">
          O que você quer pedir hoje?
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          Escolha um estabelecimento para conhecer o cardápio e ver o que está disponível.
        </p>
        <label className="mt-6 flex h-12 max-w-xl items-center gap-3 rounded-2xl border border-border bg-background/80 px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar vendedor ou estabelecimento"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Buscar vendedor"
          />
        </label>
      </header>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Estabelecimentos</p>
            <h2 className="font-display text-2xl font-bold">Escolha um vendedor</h2>
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} encontrado(s)</span>
        </div>
        {filtered.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((vendor) => (
              <Link
                key={vendor.id}
                to="/cardapio/$workspaceId"
                params={{ workspaceId: vendor.id }}
                className="glass-card group rounded-[1.5rem] p-5 transition hover:-translate-y-0.5 hover:border-primary/50"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <UtensilsCrossed className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg font-bold">
                      {vendor.name}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {vendor.product_count} item(ns) no cardápio
                    </span>
                  </span>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-xs text-muted-foreground">
                    {vendor.min_price !== null
                      ? `A partir de ${brl(Number(vendor.min_price))}`
                      : "Veja o cardápio"}
                  </span>
                  <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition group-hover:brightness-110">
                    Ver cardápio
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-[1.5rem] px-5 py-14 text-center">
            <Store className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-bold">
              {search
                ? "Nenhum vendedor corresponde à busca."
                : "Ainda não há vendedores com cardápio público."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search
                ? "Tente outro nome."
                : "Volte mais tarde para descobrir novos estabelecimentos."}
            </p>
          </div>
        )}
      </section>
      <BottomNav />
    </main>
  );
}
