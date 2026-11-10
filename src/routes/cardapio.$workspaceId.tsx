import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  MapPin,
  Minus,
  PackageCheck,
  Phone,
  Plus,
  ShoppingCart,
  Store,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { createPublicOrder, getPublicVendorMenu } from "@/lib/public.functions";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/cardapio/$workspaceId")({
  loader: ({ params }) => getPublicVendorMenu({ data: { workspaceId: params.workspaceId } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.vendor?.name ?? "Cardápio"} — VendeFácil` },
      {
        name: "description",
        content: `Veja o cardápio de ${loaderData?.vendor?.name ?? "um estabelecimento"} no VendeFácil.`,
      },
      { property: "og:title", content: `${loaderData?.vendor?.name ?? "Cardápio"} — VendeFácil` },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PublicVendorMenuPage,
});

type MenuData = NonNullable<Awaited<ReturnType<typeof getPublicVendorMenu>>>;
type OrderResult = Awaited<ReturnType<typeof createPublicOrder>>;

function PublicVendorMenuPage() {
  const data = Route.useLoaderData() as MenuData | null;
  const [chosen, setChosen] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<"dine_in" | "delivery">("dine_in");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!data) return;
    setChosen(window.localStorage.getItem("vendefacil-selected-vendor-id") === data.vendor.id);
  }, [data]);

  useEffect(() => {
    setCart({});
    setCheckoutOpen(false);
    setOrderResult(null);
  }, [data?.vendor.id]);

  const cartRows = useMemo(
    () =>
      data?.products
        .filter((product) => (cart[product.id] ?? 0) > 0)
        .map((product) => ({ product, qty: cart[product.id] ?? 0 })) ?? [],
    [cart, data],
  );
  const cartCount = cartRows.reduce((sum, row) => sum + row.qty, 0);
  const cartTotal = cartRows.reduce((sum, row) => sum + Number(row.product.price) * row.qty, 0);

  if (!data) {
    return (
      <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-4 text-center">
        <div>
          <CircleAlert className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-bold">Estabelecimento indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este cardápio não está publicado ou o vendedor não está ativo.
          </p>
          <Link
            to="/vendedores"
            className="neon-button mt-5 inline-flex rounded-full px-5 py-3 text-sm font-bold"
          >
            Voltar aos vendedores
          </Link>
        </div>
      </main>
    );
  }

  const selectedVendor = data.vendor;

  function chooseVendor() {
    try {
      window.localStorage.setItem("vendefacil-selected-vendor-id", selectedVendor.id);
      window.localStorage.setItem("vendefacil-selected-vendor-name", selectedVendor.name);
    } catch {
      // A escolha também é indicada no estado visual, mesmo que o navegador bloqueie storage.
    }
    setChosen(true);
    toast.success(`${selectedVendor.name} selecionado`);
  }

  function setQuantity(productId: string, quantity: number) {
    setCart((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[productId];
      else next[productId] = Math.min(20, quantity);
      return next;
    });
  }

  function openCheckout() {
    if (cartCount === 0) return;
    setOrderResult(null);
    setCheckoutOpen(true);
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cartRows.length || submitting) return;
    setSubmitting(true);
    try {
      const result = await createPublicOrder({
        data: {
          workspaceId: selectedVendor.id,
          customerName,
          customerPhone,
          orderType,
          address: orderType === "delivery" ? address : undefined,
          notes: notes.trim() || undefined,
          items: cartRows.map(({ product, qty }) => ({ productId: product.id, qty })),
        },
      });
      setOrderResult(result);
      setCart({});
      toast.success(`Pedido #${result.orderNumber} enviado para ${result.vendorName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o pedido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-28 pt-6 sm:px-6">
      <Link
        to="/vendedores"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Todos os vendedores
      </Link>
      <header className="glass-card mt-4 flex flex-col gap-5 rounded-[2rem] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Store className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">Cardápio do estabelecimento</p>
            <h1 className="truncate font-display text-2xl font-extrabold sm:text-3xl">
              {data.vendor.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.products.length} item(ns) · preços em reais
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={chooseVendor}
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold ${chosen ? "border border-primary/50 bg-primary/10 text-primary" : "neon-button"}`}
        >
          {chosen ? <Check className="h-4 w-4" /> : <Store className="h-4 w-4" />}
          {chosen ? "Vendedor selecionado" : "Selecionar este vendedor"}
        </button>
      </header>

      {data.categories.length ? (
        <div className="mt-8 space-y-8">
          {data.categories.map((category) => {
            const products = data.products.filter((item) => item.category_id === category.id);
            if (!products.length) return null;
            return (
              <section key={category.id}>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <h2 className="font-display text-xl font-bold">{category.name}</h2>
                  <span className="text-xs text-muted-foreground">{products.length} item(ns)</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {products.map((product) => {
                    const qty = cart[product.id] ?? 0;
                    return (
                      <article
                        key={product.id}
                        className="glass-card flex min-h-32 overflow-hidden rounded-[1.5rem]"
                      >
                        <div className="grid h-32 w-28 shrink-0 place-items-center overflow-hidden bg-secondary/60 sm:w-36">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <UtensilsCrossed className="h-8 w-8 text-primary/70" />
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold leading-snug">{product.name}</h3>
                            {data.dailyIds.includes(product.id) && (
                              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
                                Hoje
                              </span>
                            )}
                          </div>
                          {product.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {product.description}
                            </p>
                          )}
                          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                            <div>
                              <span className="block text-lg font-black text-primary">
                                {brl(Number(product.price))}
                              </span>
                              <span
                                className={`text-[10px] font-bold ${product.in_stock ? "text-emerald-400" : "text-muted-foreground"}`}
                              >
                                {product.in_stock ? "Disponível" : "Indisponível"}
                              </span>
                            </div>
                            {qty > 0 ? (
                              <div className="flex items-center gap-2 rounded-full border border-border bg-background/80 p-1">
                                <button
                                  type="button"
                                  aria-label={`Remover uma unidade de ${product.name}`}
                                  onClick={() => setQuantity(product.id, qty - 1)}
                                  className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="min-w-5 text-center text-sm font-bold">{qty}</span>
                                <button
                                  type="button"
                                  aria-label={`Adicionar uma unidade de ${product.name}`}
                                  disabled={qty >= 20 || !product.in_stock}
                                  onClick={() => setQuantity(product.id, qty + 1)}
                                  className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary disabled:opacity-40"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={!product.in_stock}
                                onClick={() => setQuantity(product.id, 1)}
                                className="neon-button inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus className="h-3.5 w-3.5" /> Adicionar
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="glass-card mt-8 rounded-[1.5rem] p-10 text-center text-sm text-muted-foreground">
          Este estabelecimento ainda não tem itens publicados no cardápio.
        </div>
      )}
      <footer className="mt-10 text-center text-xs text-muted-foreground">
        Cardápio público · VendeFácil
      </footer>

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 shadow-2xl backdrop-blur sm:p-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-bold">
                <ShoppingCart className="h-4 w-4 text-primary" />
                {cartCount} {cartCount === 1 ? "item" : "itens"} no carrinho
              </p>
              <p className="text-xs text-muted-foreground">Total {brl(cartTotal)}</p>
            </div>
            <button
              type="button"
              onClick={openCheckout}
              className="neon-button inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-3 text-sm font-bold"
            >
              Continuar pedido
            </button>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] border border-border bg-background p-5 shadow-2xl sm:rounded-[2rem] sm:p-7"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Pedido para {selectedVendor.name}</p>
                <h2 id="checkout-title" className="font-display text-2xl font-extrabold">
                  {orderResult ? "Pedido enviado" : "Seu pedido"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                aria-label="Fechar checkout"
                className="grid h-10 w-10 place-items-center rounded-full border border-border hover:bg-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {orderResult ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">Número do pedido</p>
                  <p className="font-display text-3xl font-black">#{orderResult.orderNumber}</p>
                  <p className="mt-2 text-sm">
                    Enviado para <strong>{orderResult.vendorName}</strong>. O estabelecimento
                    seguirá com o preparo e o atendimento.
                  </p>
                </div>
                <div className="rounded-2xl bg-secondary/60 p-4 text-sm">
                  <p className="font-bold">Total: {brl(orderResult.total)}</p>
                  <p className="mt-1 text-muted-foreground">
                    Pagamento combinado diretamente com o estabelecimento. Nenhuma cobrança online
                    foi realizada.
                  </p>
                </div>
                <Link
                  to="/pedido/$id"
                  params={{ id: orderResult.id }}
                  search={{ access: orderResult.accessToken }}
                  className="neon-button flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold"
                >
                  <PackageCheck className="h-4 w-4" /> Acompanhar pedido
                </Link>
                <button
                  type="button"
                  onClick={() => setCheckoutOpen(false)}
                  className="w-full rounded-full border border-border px-5 py-3 text-sm font-semibold hover:bg-secondary"
                >
                  Voltar ao cardápio
                </button>
              </div>
            ) : (
              <form onSubmit={submitOrder} className="space-y-5">
                <div className="space-y-2">
                  {cartRows.map(({ product, qty }) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 px-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        <strong>{qty}×</strong> {product.name}
                      </span>
                      <span className="shrink-0 font-bold">{brl(Number(product.price) * qty)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-border pt-3 text-base font-black">
                    <span>Total</span>
                    <span className="text-primary">{brl(cartTotal)}</span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">
                    Seu nome
                    <input
                      required
                      minLength={2}
                      maxLength={80}
                      autoComplete="name"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Nome para o pedido"
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Telefone
                    <span className="relative mt-1.5 block">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <input
                        required
                        type="tel"
                        minLength={8}
                        maxLength={24}
                        autoComplete="tel"
                        value={customerPhone}
                        onChange={(event) => setCustomerPhone(event.target.value)}
                        className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 font-normal outline-none focus:ring-2 focus:ring-primary"
                        placeholder="(11) 99999-9999"
                      />
                    </span>
                  </label>
                </div>

                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Como vai receber?</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOrderType("dine_in")}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold ${orderType === "dine_in" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"}`}
                    >
                      Retirar / consumir no local
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType("delivery")}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold ${orderType === "delivery" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"}`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4" /> Entrega
                      </span>
                    </button>
                  </div>
                </fieldset>

                {orderType === "delivery" && (
                  <label className="block text-sm font-semibold">
                    Endereço de entrega
                    <textarea
                      required
                      minLength={5}
                      maxLength={250}
                      autoComplete="street-address"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      className="mt-1.5 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Rua, número, bairro e complemento"
                    />
                  </label>
                )}
                <label className="block text-sm font-semibold">
                  Observações <span className="font-normal text-muted-foreground">(opcional)</span>
                  <textarea
                    maxLength={500}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="mt-1.5 min-h-16 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Instruções para o estabelecimento"
                  />
                </label>
                <p className="rounded-xl bg-secondary/60 px-3 py-2.5 text-xs text-muted-foreground">
                  O pedido será enviado ao vendedor como pagamento pendente. Combine o pagamento
                  diretamente com o estabelecimento.
                </p>
                <button
                  type="submit"
                  disabled={submitting || !cartRows.length}
                  className="neon-button flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-bold disabled:cursor-wait disabled:opacity-60"
                >
                  {submitting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-4 w-4" />
                  )}
                  {submitting ? "Enviando pedido…" : `Enviar pedido · ${brl(cartTotal)}`}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
