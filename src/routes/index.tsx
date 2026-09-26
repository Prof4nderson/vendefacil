import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  BadgeAlert,
  BarChart3,
  Check,
  ChevronDown,
  CircleUserRound,
  Clock3,
  CreditCard,
  DollarSign,
  FileText,
  LayoutDashboard,
  LogIn,
  Mail,
  Menu,
  Minus,
  Package,
  Plus,
  Search,
  Settings2,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  UserPlus,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getMenuData, getSettings } from "@/lib/public.functions";
import { createOrder } from "@/lib/orders.functions";
import { openPosShift } from "@/lib/ops.functions";
import { registerAccount, verifyAccount } from "@/lib/auth.functions";
import {
  addCatalogProduct,
  getCatalogSuggestions,
  getCustomers,
  importCatalogCsv,
  type CatalogSuggestion,
} from "@/lib/catalog.functions";
import { brl, PAYMENT_METHODS } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [menu, settings, suggestions, savedCustomers] = await Promise.all([
      getMenuData(),
      getSettings(),
      getCatalogSuggestions(),
      getCustomers(),
    ]);
    return { menu, settings, suggestions, savedCustomers };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.settings.restaurant_name ?? "VendeFácil"} — PDV` },
      { name: "description", content: "Controle simples de vendas, clientes, estoque e turnos." },
    ],
  }),
  component: PosPage,
});

type Product = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  stock: number;
  needs_kitchen: boolean;
  purchase_price?: number | string;
  min_stock?: number;
};
type Category = { id: string; name: string; sort_order: number };
type Cart = Record<string, number>;
type Customer = {
  id: string;
  name: string;
  note: string;
  total: number;
  items: number;
  credit: number;
};

const fallbackProducts: Product[] = [
  {
    id: "demo-1",
    category_id: "food",
    name: "X-Burguer artesanal",
    description: "Pão brioche, carne, queijo e molho da casa",
    price: 18.9,
    image_url: "/images/xburguer.jpg",
    stock: 18,
    needs_kitchen: true,
    purchase_price: 8.5,
    min_stock: 5,
  },
  {
    id: "demo-2",
    category_id: "food",
    name: "Coxinha cremosa",
    description: "Frango com catupiry",
    price: 7.5,
    image_url: null,
    stock: 24,
    needs_kitchen: false,
    purchase_price: 3.2,
    min_stock: 8,
  },
  {
    id: "demo-3",
    category_id: "drink",
    name: "Refrigerante lata",
    description: "Coca, Guaraná ou Fanta",
    price: 6,
    image_url: null,
    stock: 6,
    needs_kitchen: false,
    purchase_price: 3,
    min_stock: 10,
  },
  {
    id: "demo-4",
    category_id: "sweet",
    name: "Brownie da casa",
    description: "Chocolate intenso e casquinha crocante",
    price: 9.9,
    image_url: "/images/brownie.jpg",
    stock: 12,
    needs_kitchen: false,
    purchase_price: 4,
    min_stock: 4,
  },
  {
    id: "demo-5",
    category_id: "drink",
    name: "Suco natural 500ml",
    description: "Laranja, maracujá ou manga",
    price: 9,
    image_url: null,
    stock: 20,
    needs_kitchen: false,
    purchase_price: 3.8,
    min_stock: 6,
  },
  {
    id: "demo-6",
    category_id: "food",
    name: "Misto quente",
    description: "Presunto e queijo na chapa",
    price: 9.9,
    image_url: "/images/misto.jpg",
    stock: 15,
    needs_kitchen: true,
    purchase_price: 4.5,
    min_stock: 4,
  },
];
const fallbackCategories: Category[] = [
  { id: "food", name: "Salgados e lanches", sort_order: 1 },
  { id: "drink", name: "Bebidas", sort_order: 2 },
  { id: "sweet", name: "Doces", sort_order: 3 },
];

function PosPage() {
  const { menu, settings, suggestions, savedCustomers } = Route.useLoaderData();
  const products = (menu.products as Product[])?.length
    ? (menu.products as Product[])
    : fallbackProducts;
  const categories = (menu.categories as Category[])?.length
    ? (menu.categories as Category[])
    : fallbackCategories;
  const submitOrder = useServerFn(createOrder);
  const startShift = useServerFn(openPosShift);
  const register = useServerFn(registerAccount);
  const verify = useServerFn(verifyAccount);
  const addSuggestion = useServerFn(addCatalogProduct);
  const importCsv = useServerFn(importCatalogCsv);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart>({});
  const [customers, setCustomers] = useState<Customer[]>([
    {
      id: "consumer",
      name: "Consumidor",
      note: "Venda sem identificação",
      total: 0,
      items: 0,
      credit: 0,
    },
    ...savedCustomers.map((c) => ({
      id: c.id,
      name: c.name,
      note: c.phone || "Cliente cadastrado",
      total: 0,
      items: 0,
      credit: Number(c.credit_balance),
    })),
  ]);
  const [activeCustomer, setActiveCustomer] = useState("consumer");
  const [payment, setPayment] = useState(PAYMENT_METHODS[0]);
  const [showPayment, setShowPayment] = useState(false);
  const [showAuth, setShowAuth] = useState<"login" | "signup" | null>(null);
  const [pinMode, setPinMode] = useState(false);
  const [authData, setAuthData] = useState({
    name: "",
    login: "",
    password: "",
    whatsapp: "",
    email: "",
    pin: "",
  });
  const [authenticated, setAuthenticated] = useState(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("vendefacil-user") || "" : "",
  );
  const [opening, setOpening] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showShift, setShowShift] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("");
  const [shiftOpen, setShiftOpen] = useState(
    () =>
      typeof window !== "undefined" && window.localStorage.getItem("vendefacil-shift-open") === "1",
  );
  const [creditAmount, setCreditAmount] = useState(0);

  const visible = useMemo(
    () =>
      products.filter(
        (p) =>
          (!category || p.category_id === category) &&
          (!query || p.name.toLowerCase().includes(query.toLowerCase())),
      ),
    [products, category, query],
  );
  const cartItems = Object.entries(cart)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id)!, qty }))
    .filter((x) => x.product);
  const total = cartItems.reduce((sum, item) => sum + Number(item.product.price) * item.qty, 0);
  const count = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const currentCustomer = customers.find((c) => c.id === activeCustomer)!;
  const lowStock = products.filter((p) => Number(p.stock) <= Number(p.min_stock ?? 5));

  function add(product: Product, delta: number) {
    setCart((old) => {
      const next = { ...old, [product.id]: Math.max(0, (old[product.id] ?? 0) + delta) };
      if (!next[product.id]) delete next[product.id];
      return next;
    });
    setCustomers((old) =>
      old.map((c) =>
        c.id === activeCustomer
          ? {
              ...c,
              items: Math.max(0, c.items + delta),
              total: Math.max(0, c.total + Number(product.price) * delta),
            }
          : c,
      ),
    );
  }
  function newCustomer() {
    const id = `c-${Date.now()}`;
    const name =
      typeof window !== "undefined"
        ? window.prompt("Nome do cliente ou mesa:", `Cliente ${customers.length}`)?.trim()
        : "";
    if (!name) return;
    setCustomers((old) => [
      ...old,
      { id, name, note: "Consumo em aberto", total: 0, items: 0, credit: 0 },
    ]);
    setActiveCustomer(id);
    setCart({});
  }
  async function handleOpenShift() {
    try {
      await startShift({ data: { opening_amount: Number(openingAmount.replace(",", ".")) || 0 } });
      setShiftOpen(true);
      localStorage.setItem("vendefacil-shift-open", "1");
      setShowShift(false);
      toast.success("Turno aberto com fundo inicial registrado");
    } catch (e) {
      if (e instanceof Error && e.message.includes("Já existe")) {
        setShiftOpen(true);
        localStorage.setItem("vendefacil-shift-open", "1");
        setShowShift(false);
      } else toast.error(e instanceof Error ? e.message : "Não foi possível abrir o turno");
    }
  }
  async function checkout() {
    if (!cartItems.length) return toast.error("Adicione pelo menos um produto");
    setOpening(true);
    try {
      try {
        await startShift({ data: { opening_amount: 0 } });
      } catch {
        /* turno já aberto */
      }
      setShiftOpen(true);
      localStorage.setItem("vendefacil-shift-open", "1");
      if (
        cartItems.every((i) => i.product.id.includes("-")) &&
        cartItems.some((i) => i.product.id.startsWith("demo-"))
      ) {
        toast.success(`Venda ${currentCustomer.name} finalizada • ${brl(total)}`);
      } else {
        await submitOrder({
          data: {
            customer_name: currentCustomer.name,
            customer_phone: "000000000",
            order_type: "dine_in",
            payment_method: payment,
            amount_paid: Math.max(0, total - creditAmount),
            credit_amount: creditAmount,
            items: cartItems.map((i) => ({ product_id: i.product.id, qty: i.qty })),
          },
        });
        toast.success(`Venda registrada • ${brl(total)}`);
      }
      setCustomers((old) =>
        old
          .filter((c) => c.id !== activeCustomer || c.id === "consumer")
          .map((c) => (c.id === activeCustomer ? { ...c, total: 0, items: 0 } : c)),
      );
      setCart({});
      setShowPayment(false);
      setCreditAmount(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar a venda");
    } finally {
      setOpening(false);
    }
  }
  async function doSignup() {
    try {
      await register({
        data: {
          name: authData.name,
          login: authData.login,
          password: authData.password,
          whatsapp: authData.whatsapp,
          email: authData.email,
        },
      });
      setPinMode(true);
      toast.success("PIN enviado para seu email");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cadastrar");
    }
  }
  async function doVerify() {
    try {
      await verify({ data: { email: authData.email, pin: authData.pin } });
      setAuthenticated(authData.name);
      localStorage.setItem("vendefacil-user", authData.name);
      setShowAuth(null);
      setPinMode(false);
      toast.success("Conta ativada com sucesso");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PIN inválido");
    }
  }

  return (
    <div className="min-h-screen pb-8">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur-xl md:px-8">
        <div className="relative mx-auto flex max-w-[1500px] items-center gap-4">
          <div className="icon-tile grid h-11 w-11 shrink-0 place-items-center rounded-2xl">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="eyebrow">PDV • operação simples</p>
            <h1 className="font-display truncate text-lg font-bold">
              {settings.restaurant_name || "VendeFácil"}
            </h1>
          </div>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />{" "}
              {shiftOpen ? "Turno aberto" : "Turno não iniciado"}
            </span>
            <span className="text-xs text-muted-foreground">Hoje, 26 set • 14:32</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowAuth(authenticated ? "login" : "signup")}
            aria-label="Conta"
          >
            <CircleUserRound className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMenu((v) => !v)}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          {showMenu && (
            <div className="absolute right-0 top-14 z-30 w-64 rounded-2xl border border-border bg-popover p-2 shadow-2xl">
              <button
                onClick={() => {
                  window.location.href = "/admin";
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold hover:bg-secondary"
              >
                <LayoutDashboard className="h-4 w-4 text-primary" /> Acesso Admin
              </button>
              {!shiftOpen && (
                <button
                  onClick={() => {
                    setShowShift(true);
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold hover:bg-secondary"
                >
                  <DollarSign className="h-4 w-4 text-primary" /> Abrir turno
                </button>
              )}
              <button
                onClick={() => {
                  setShowCatalog(true);
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold hover:bg-secondary"
              >
                <Package className="h-4 w-4 text-primary" /> Importar CSV / produtos
              </button>
              <button
                onClick={() => {
                  newCustomer();
                  setShowMenu(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold hover:bg-secondary"
              >
                <Plus className="h-4 w-4 text-primary" /> Nova mesa
              </button>
            </div>
          )}
        </div>
      </header>
      {count > 0 && (
        <div className="sticky top-[68px] z-10 border-b border-primary/20 bg-background/95 px-4 py-2 backdrop-blur-xl md:px-8">
          <div className="mx-auto flex max-w-[1500px] items-center gap-3">
            <ShoppingCart className="h-4 w-4 shrink-0 text-primary" />
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
              {cartItems.map(({ product: p, qty }) => (
                <button
                  key={p.id}
                  onClick={() => add(p, -qty)}
                  className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold"
                >
                  {qty}× {p.name}
                </button>
              ))}
            </div>
            <span className="shrink-0 text-sm font-black text-primary">{brl(total)}</span>
            <Button
              disabled={opening}
              onClick={() => setShowPayment(true)}
              className="neon-button shrink-0 rounded-xl px-3 py-2 text-xs font-extrabold"
            >
              <CreditCard className="mr-1 h-4 w-4" /> Finalizar
            </Button>
          </div>
        </div>
      )}
      <main className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Venda rápida</p>
              <h2 className="font-display text-3xl font-extrabold tracking-tight">
                O que vamos vender?
              </h2>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => toast.info("Importação CSV disponível no painel Admin")}
              >
                <Package className="mr-2 h-4 w-4" /> Importar CSV
              </Button>
              <Button className="neon-button rounded-xl" onClick={newCustomer}>
                <Plus className="mr-2 h-4 w-4" /> Nova mesa
              </Button>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="holo-input flex min-w-[220px] flex-1 items-center gap-2 rounded-xl px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <button
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${!category ? "neon-button" : "bg-secondary"}`}
              onClick={() => setCategory(null)}
            >
              Todos
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${category === c.id ? "neon-button" : "bg-secondary"}`}
                onClick={() => setCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          {lowStock.length > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm">
              <BadgeAlert className="h-4 w-4 text-amber-300" />
              <span>
                <strong>Estoque baixo:</strong>{" "}
                {lowStock
                  .slice(0, 3)
                  .map((p) => p.name)
                  .join(", ")}
                {lowStock.length > 3 ? " e mais" : ""}
              </span>
              <button
                className="ml-auto text-xs font-bold text-amber-300"
                onClick={() => toast.info("Abra Admin → Produtos para repor o estoque")}
              >
                Ver estoque
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((p) => {
              const qty = cart[p.id] ?? 0;
              const isLow = Number(p.stock) <= Number(p.min_stock ?? 5);
              return (
                <article
                  key={p.id}
                  className="glass-card flex min-h-[205px] flex-col rounded-2xl p-2 transition-transform hover:-translate-y-0.5"
                >
                  <div className="relative aspect-[1.5] overflow-hidden rounded-xl bg-secondary">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-4xl font-black text-primary">
                        {p.name.charAt(0)}
                      </div>
                    )}
                    <span
                      className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold ${isLow ? "bg-amber-400/90 text-amber-950" : "bg-background/80"}`}
                    >
                      {isLow ? `Restam ${p.stock}` : "Disponível"}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col pt-2">
                    <h3 className="line-clamp-2 text-sm font-extrabold leading-tight">{p.name}</h3>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {p.description}
                    </p>
                    <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                      <div>
                        <p className="text-lg font-black text-primary">{brl(p.price)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Compra {brl(p.purchase_price ?? Number(p.price) * 0.45)} • Estoque{" "}
                          {p.stock} • mín. {p.min_stock ?? 5}
                        </p>
                      </div>
                      {qty ? (
                        <div className="flex items-center gap-1 rounded-full bg-primary/15 p-1">
                          <button
                            onClick={() => add(p, -1)}
                            className="grid h-7 w-7 place-items-center rounded-full bg-secondary"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <b className="w-5 text-center text-sm">{qty}</b>
                          <button
                            onClick={() => add(p, 1)}
                            className="neon-button grid h-7 w-7 place-items-center rounded-full"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => add(p, 1)}
                          className="neon-button grid h-9 w-9 place-items-center rounded-full"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <aside className="space-y-4">
          <div className="glass-card rounded-[1.5rem] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="eyebrow">Atendimento</p>
                <h2 className="font-display text-xl font-bold">Clientes consumindo</h2>
              </div>
              <button
                onClick={newCustomer}
                className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveCustomer(c.id);
                    setCart({});
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ${activeCustomer === c.id ? "bg-primary/15 ring-1 ring-primary/40" : "bg-secondary/50"}`}
                >
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-background text-xs font-black text-primary">
                    {c.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.note}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold">{c.items} itens</p>
                    <p className="text-xs text-primary">{brl(c.total)}</p>
                    {c.credit > 0 && (
                      <p className="text-[10px] font-bold text-amber-300">Fiado {brl(c.credit)}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={newCustomer}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Identificar outro cliente
            </button>
          </div>
          <div className="glass-card rounded-[1.5rem] p-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <div>
                <p className="eyebrow">Venda atual</p>
                <h2 className="font-display text-xl font-bold">{currentCustomer.name}</h2>
              </div>
              <span className="ml-auto rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">
                {count} itens
              </span>
            </div>
            {cartItems.length ? (
              <div className="mt-4 space-y-3">
                {cartItems.map(({ product: p, qty }) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {qty} × {brl(p.price)}
                      </p>
                    </div>
                    <span className="text-sm font-bold">{brl(Number(p.price) * qty)}</span>
                    <button onClick={() => add(p, -qty)} className="text-muted-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="border-t border-border pt-3">
                  <div className="flex items-end justify-between">
                    <span className="text-sm text-muted-foreground">Total da venda</span>
                    <strong className="font-display text-3xl text-primary">{brl(total)}</strong>
                  </div>
                  <Button
                    disabled={opening}
                    onClick={() => setShowPayment(true)}
                    className="neon-button mt-4 h-12 w-full rounded-xl text-base font-extrabold"
                  >
                    <CreditCard className="mr-2 h-5 w-5" /> Finalizar venda
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-xl bg-secondary/60 px-4 py-8 text-center">
                <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-semibold">Escolha produtos para começar</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Os itens ficam acumulados para {currentCustomer.name}
                </p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              className="glass-card rounded-xl p-3 text-center"
              onClick={() => toast.info("Relatórios disponíveis após fechar o turno")}
            >
              <BarChart3 className="mx-auto h-4 w-4 text-primary" />
              <span className="mt-1 block text-[10px] font-bold">Relatórios</span>
            </button>
            <button
              className="glass-card rounded-xl p-3 text-center"
              onClick={() => toast.info("Estoque opcional ativado para esta operação")}
            >
              <Package className="mx-auto h-4 w-4 text-primary" />
              <span className="mt-1 block text-[10px] font-bold">Estoque</span>
            </button>
            <button
              className="glass-card rounded-xl p-3 text-center"
              onClick={() => toast.info("Acesse /admin para configurar")}
            >
              <Settings2 className="mx-auto h-4 w-4 text-primary" />
              <span className="mt-1 block text-[10px] font-bold">Admin</span>
            </button>
          </div>
        </aside>
      </main>
      {showShift && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-scrim px-4"
          onClick={() => setShowShift(false)}
        >
          <div
            className="glass-card w-full max-w-sm rounded-[1.5rem] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Caixa</p>
                <h2 className="font-display text-2xl font-bold">Abrir turno</h2>
              </div>
              <button onClick={() => setShowShift(false)}>
                <X />
              </button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Informe o dinheiro disponível para troco.
            </p>
            <input
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              inputMode="decimal"
              placeholder="Troco inicial · 0,00"
              className="mt-4 h-12 w-full rounded-xl border border-input bg-background px-3"
            />
            <Button onClick={handleOpenShift} className="neon-button mt-4 h-12 w-full rounded-xl">
              <DollarSign className="mr-2 h-4 w-4" /> Abrir turno
            </Button>
          </div>
        </div>
      )}
      {showCatalog && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-scrim px-4"
          onClick={() => setShowCatalog(false)}
        >
          <div
            className="glass-card max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Catálogo geral</p>
                <h2 className="font-display text-2xl font-bold">Sugestões de produtos</h2>
              </div>
              <button onClick={() => setShowCatalog(false)}>
                <X />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Adicione uma sugestão ao cardápio deste estabelecimento ou importe uma lista CSV.
            </p>
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/50 bg-primary/10 px-4 py-3 text-sm font-bold text-primary">
              <FileText className="h-4 w-4" /> Importar CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const result = await importCsv({ data: { csv: await file.text() } });
                    toast.success(`${result.imported} produtos importados`);
                    setShowCatalog(false);
                    window.location.reload();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Falha ao importar CSV");
                  }
                }}
              />
            </label>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {(suggestions as CatalogSuggestion[]).map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-background text-xl">
                    {s.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.category_name} • {brl(s.suggested_price)}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await addSuggestion({
                          data: { suggestionId: s.id, stock: 0, minStock: 5 },
                        });
                        toast.success(`${s.name} adicionado ao cardápio`);
                        window.location.reload();
                      } catch (err) {
                        toast.error(
                          err instanceof Error ? err.message : "Não foi possível adicionar",
                        );
                      }
                    }}
                    className="neon-button rounded-lg px-3 py-2 text-xs font-bold"
                  >
                    Adicionar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showPayment && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-scrim px-4"
          onClick={() => setShowPayment(false)}
        >
          <div
            className="glass-card w-full max-w-md rounded-[1.5rem] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Confirmar venda</p>
                <h2 className="font-display text-2xl font-bold">Como o cliente pagou?</h2>
              </div>
              <button onClick={() => setShowPayment(false)}>
                <X />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setPayment(m)}
                  className={`rounded-xl border p-3 text-sm font-bold ${payment === m ? "border-primary bg-primary/15 text-primary" : "border-border bg-secondary/60"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
              <label className="text-xs font-bold text-amber-200">Valor no fiado (opcional)</label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">R$</span>
                <input
                  type="number"
                  min="0"
                  max={total}
                  step="0.01"
                  value={creditAmount || ""}
                  onChange={(e) =>
                    setCreditAmount(Math.min(total, Math.max(0, Number(e.target.value) || 0)))
                  }
                  placeholder="0,00"
                  className="h-10 flex-1 rounded-lg border border-amber-400/30 bg-background px-3 text-sm"
                />
                <button
                  onClick={() => setCreditAmount(total)}
                  className="rounded-lg bg-amber-300/20 px-2 py-2 text-xs font-bold text-amber-200"
                >
                  Tudo
                </button>
              </div>
              {creditAmount > 0 && (
                <p className="mt-2 text-xs text-amber-200">
                  Paga agora {brl(total - creditAmount)} • fica devendo {brl(creditAmount)}
                </p>
              )}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-xl bg-secondary/60 p-4">
              <span className="font-semibold">Total</span>
              <strong className="font-display text-2xl text-primary">{brl(total)}</strong>
            </div>
            <Button
              onClick={checkout}
              disabled={opening}
              className="neon-button mt-4 h-12 w-full rounded-xl"
            >
              {opening ? (
                "Registrando..."
              ) : (
                <>
                  <Check className="mr-2 h-5 w-5" /> Confirmar pagamento
                </>
              )}
            </Button>
          </div>
        </div>
      )}
      {showAuth && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-scrim px-4"
          onClick={() => setShowAuth(null)}
        >
          <div
            className="glass-card w-full max-w-md rounded-[1.5rem] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Conta VendeFácil</p>
                <h2 className="font-display text-2xl font-bold">
                  {showAuth === "signup" ? "Criar acesso" : "Entrar"}
                </h2>
              </div>
              <button onClick={() => setShowAuth(null)}>
                <X />
              </button>
            </div>
            {showAuth === "signup" && !pinMode ? (
              <div className="mt-4 space-y-3">
                {(
                  [
                    ["name", "Nome completo"],
                    ["login", "Login"],
                    ["password", "Senha"],
                    ["whatsapp", "WhatsApp"],
                    ["email", "Email"],
                  ] as const
                ).map(([key, label]) => (
                  <input
                    key={key}
                    type={key === "password" ? "password" : "text"}
                    placeholder={label}
                    value={authData[key]}
                    onChange={(e) => setAuthData({ ...authData, [key]: e.target.value })}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  />
                ))}
                <Button onClick={doSignup} className="neon-button h-11 w-full rounded-xl">
                  <Mail className="mr-2 h-4 w-4" /> Enviar PIN por email
                </Button>
                <button
                  onClick={() => setShowAuth("login")}
                  className="w-full text-center text-xs text-muted-foreground"
                >
                  Já tenho acesso
                </button>
              </div>
            ) : showAuth === "signup" && pinMode ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-primary/10 p-4 text-sm">
                  Enviamos um PIN de 6 dígitos para <b>{authData.email}</b>.
                </div>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="PIN de confirmação"
                  value={authData.pin}
                  onChange={(e) => setAuthData({ ...authData, pin: e.target.value })}
                  className="h-12 w-full rounded-xl border border-input bg-background px-3 text-center text-xl font-bold tracking-[.4em]"
                />
                <Button onClick={doVerify} className="neon-button h-11 w-full rounded-xl">
                  Ativar conta
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <input
                  placeholder="Login ou email"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                />
                <input
                  type="password"
                  placeholder="Senha"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                />
                <Button
                  onClick={() => {
                    setAuthenticated("Operador");
                    localStorage.setItem("vendefacil-user", "Operador");
                    setShowAuth(null);
                    toast.success("Bem-vindo ao VendeFácil");
                  }}
                  className="neon-button h-11 w-full rounded-xl"
                >
                  <LogIn className="mr-2 h-4 w-4" /> Entrar
                </Button>
                <button
                  onClick={() => setShowAuth("signup")}
                  className="w-full text-center text-xs text-muted-foreground"
                >
                  Criar nova conta
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
