import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Settings2, UtensilsCrossed, Tags, CalendarDays, Bike, KeyRound, Paintbrush, BarChart3, Lock, Plus, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { OpsGate, useOpsQuery } from "@/components/ops-gate";
import { getOpsSessionInfo, changeRoutePassword, lockOps } from "@/lib/gate.functions";
import {
  getAdminData, saveCategory, saveProduct, toggleProductAvailable, updateStock,
  setDailyMenuItem, saveCourier, saveSettings, getFinanceData,
} from "@/lib/admin.functions";
import { getSettings } from "@/lib/public.functions";
import { brl, ORDER_STATUS_LABELS } from "@/lib/format";


export const Route = createFileRoute("/admin")({
  loader: () => getOpsSessionInfo(),
  head: () => ({
    meta: [
      { title: "Administração" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Administração" },
      { property: "og:description", content: "Gestão do restaurante" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type AdminData = Awaited<ReturnType<typeof getAdminData>>;
type Product = AdminData["products"][number];
type Category = AdminData["categories"][number];
type Courier = AdminData["couriers"][number];

const TABS = [
  { key: "produtos", label: "Produtos", icon: UtensilsCrossed },
  { key: "categorias", label: "Categorias", icon: Tags },
  { key: "semanal", label: "Semanal", icon: CalendarDays },
  { key: "entregadores", label: "Entregadores", icon: Bike },
  { key: "senhas", label: "Senhas", icon: KeyRound },
  { key: "aparencia", label: "Aparência", icon: Paintbrush },
  { key: "financeiro", label: "Financeiro", icon: BarChart3 },
] as const;

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ROUTE_LABELS: Record<string, string> = { admin: "Admin", cozinha: "Cozinha", entrega: "Entrega", caixa: "Caixa" };

function AdminPage() {
  const session = Route.useLoaderData();
  const queryClient = useQueryClient();
  const fetchData = useServerFn(getAdminData);
  const lock = useServerFn(lockOps);
  const [tab, setTab] = useState<string>("produtos");

  const { data } = useOpsQuery(["admin"], fetchData, 15000, session.roles.includes("admin"));

  // Avisa o admin quando um pedido é entregue (comparando as recargas periódicas)
  const seenDelivered = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (!session.roles.includes("admin") || !data) return;
    const delivered = data.recentOrders
      .filter((o) => o.status === "delivered")
      .map((o) => o.order_number);
    if (seenDelivered.current === null) {
      seenDelivered.current = new Set(delivered);
      return;
    }
    for (const n of delivered) {
      if (!seenDelivered.current.has(n)) {
        seenDelivered.current.add(n);
        toast.success(`Pedido #${n} entregue e pago!`);
      }
    }
  }, [data, session.roles]);

  return (
    <OpsGate role="admin" title="Administração" session={session}>
      <div className="mx-auto min-h-screen max-w-3xl px-4 py-4 pb-24">
        <header className="mb-4 flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Administração</h1>
          <button
            onClick={async () => { await lock({}); window.location.reload(); }}
            className="ml-auto flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium"
          >
            <Lock className="h-3 w-3" /> Sair
          </button>
        </header>

        <nav className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>

        {data && (
          <>
            {tab === "produtos" && <ProductsTab data={data} />}
            {tab === "categorias" && <CategoriesTab data={data} />}
            {tab === "semanal" && <WeeklyTab data={data} />}
            {tab === "entregadores" && <CouriersTab data={data} />}
            {tab === "senhas" && <PasswordsTab />}
            {tab === "aparencia" && <AppearanceTab />}
            {tab === "financeiro" && <FinanceTab />}
          </>
        )}
      </div>
    </OpsGate>
  );
}

const inputCls = "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm";
const btnCls = "rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50";

// ---------------- Produtos ----------------

function ProductsTab({ data }: { data: AdminData }) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveProduct);
  const toggleAvail = useServerFn(toggleProductAvailable);
  const stock = useServerFn(updateStock);
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data.products.length} produtos cadastrados</p>
        <button onClick={() => setEditing("new")} className={`flex items-center gap-1 ${btnCls}`}>
          <Plus className="h-4 w-4" /> Novo produto
        </button>
      </div>
      <div className="space-y-2">
        {data.products.map((p) => {
          const cat = data.categories.find((c) => c.id === p.category_id);
          return (
            <article key={p.id} className="rounded-2xl border border-border glass-card p-3">
              <div className="flex items-center gap-3">
                {p.image_url && <img src={p.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cat?.name} • {brl(p.price)} {p.needs_kitchen ? "• cozinha" : "• sem preparo"}
                  </p>
                </div>
                <button onClick={() => setEditing(p)} className="rounded-lg bg-secondary p-2" aria-label={`Editar ${p.name}`}>
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={async () => { await toggleAvail({ data: { id: p.id, available: !p.available } }); refresh(); }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${p.available ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                >
                  {p.available ? "Disponível" : "Indisponível"}
                </button>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Estoque</span>
                  <button
                    onClick={async () => { await stock({ data: { id: p.id, stock: Math.max(0, p.stock - 1) } }); refresh(); }}
                    className="h-8 w-8 rounded-lg bg-secondary text-sm font-bold"
                  >−</button>
                  <span className="w-8 text-center text-sm font-bold">{p.stock}</span>
                  <button
                    onClick={async () => { await stock({ data: { id: p.id, stock: p.stock + 1 } }); refresh(); }}
                    className="h-8 w-8 rounded-lg bg-secondary text-sm font-bold"
                  >+</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          categories={data.categories}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            await save({ data: values });
            toast.success("Produto salvo");
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ProductForm({
  product, categories, onClose, onSave,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSave: (v: {
    id?: string; category_id: string; name: string; description?: string; price: number;
    image_url?: string | null; stock: number; available: boolean; needs_kitchen: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0]?.id ?? "");
  const [price, setPrice] = useState(product ? String(Number(product.price).toFixed(2)).replace(".", ",") : "");
  const [stock, setStockVal] = useState(String(product?.stock ?? 0));
  const [description, setDescription] = useState(product?.description ?? "");
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [available, setAvailable] = useState(product?.available ?? true);
  const [needsKitchen, setNeedsKitchen] = useState(product?.needs_kitchen ?? true);
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-scrim" onClick={onClose}>
      <div className="max-h-[92vh] overflow-y-auto rounded-t-3xl bg-background p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold">{product ? "Editar produto" : "Novo produto"}</h2>
        <div className="mt-4 space-y-3">
          <input className={inputCls} placeholder="Nome do produto" value={name} onChange={(e) => setName(e.target.value)} />
          <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="Preço (0,00)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            <input className={inputCls} placeholder="Estoque" inputMode="numeric" value={stock} onChange={(e) => setStockVal(e.target.value)} />
          </div>
          <input className={inputCls} placeholder="URL da imagem (opcional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          <textarea className={inputCls} placeholder="Descrição (opcional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
            Disponível no cardápio
            <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="h-5 w-5 accent-primary" />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
            Precisa de preparo na cozinha
            <input type="checkbox" checked={needsKitchen} onChange={(e) => setNeedsKitchen(e.target.checked)} className="h-5 w-5 accent-primary" />
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-2xl bg-secondary py-3.5 font-semibold">Cancelar</button>
          <button
            disabled={saving || !name.trim() || !categoryId}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({
                  ...(product?.id ? { id: product.id } : {}),
                  category_id: categoryId,
                  name: name.trim(),
                  description,
                  price: Number(price.replace(",", ".")) || 0,
                  image_url: imageUrl || null,
                  stock: parseInt(stock) || 0,
                  available,
                  needs_kitchen: needsKitchen,
                });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro ao salvar");
                setSaving(false);
              }
            }}
            className="flex-1 rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Categorias ----------------

function CategoriesTab({ data }: { data: AdminData }) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveCategory);
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">A categoria chamada "Pratos quentes" é controlada pelo cardápio semanal.</p>
      </div>
      <button onClick={() => setEditing("new")} className={`mb-3 flex items-center gap-1 ${btnCls}`}>
        <Plus className="h-4 w-4" /> Nova categoria
      </button>
      <div className="space-y-2">
        {data.categories.map((c) => (
          <article key={c.id} className="flex items-center justify-between rounded-2xl border border-border glass-card p-4">
            <div>
              <p className="text-sm font-semibold">{c.name}</p>
              <p className="text-xs text-muted-foreground">Ordem {c.sort_order} • {c.active ? "Ativa" : "Inativa"}</p>
            </div>
            <button onClick={() => setEditing(c)} className="rounded-lg bg-secondary p-2" aria-label={`Editar ${c.name}`}>
              <Pencil className="h-4 w-4" />
            </button>
          </article>
        ))}
      </div>

      {editing && (
        <CategoryForm
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => { await save({ data: v }); toast.success("Categoria salva"); setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function CategoryForm({
  category, onClose, onSave,
}: {
  category: Category | null;
  onClose: () => void;
  onSave: (v: { id?: string; name: string; sort_order: number; active: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [order, setOrder] = useState(String(category?.sort_order ?? 0));
  const [active, setActive] = useState(category?.active ?? true);
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-scrim" onClick={onClose}>
      <div className="rounded-t-3xl bg-background p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold">{category ? "Editar categoria" : "Nova categoria"}</h2>
        <div className="mt-4 space-y-3">
          <input className={inputCls} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} placeholder="Ordem de exibição" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value)} />
          <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
            Ativa
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-primary" />
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-2xl bg-secondary py-3.5 font-semibold">Cancelar</button>
          <button
            disabled={name.trim().length < 2}
            onClick={() => onSave({ ...(category?.id ? { id: category.id } : {}), name: name.trim(), sort_order: parseInt(order) || 0, active })}
            className="flex-1 rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Cardápio semanal ----------------

function WeeklyTab({ data }: { data: AdminData }) {
  const queryClient = useQueryClient();
  const setItem = useServerFn(setDailyMenuItem);
  const [weekday, setWeekday] = useState(new Date().getDay());
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const dailyCategory = data.categories.find((c) => c.name.trim().toLowerCase() === "pratos quentes");
  const dailyProducts = dailyCategory ? data.products.filter((p) => p.category_id === dailyCategory.id) : [];
  const included = new Set(data.daily.filter((d) => d.weekday === weekday).map((d) => d.product_id));

  if (!dailyCategory) {
    return <p className="rounded-2xl border border-border glass-card p-4 text-sm">Crie uma categoria chamada "Pratos quentes" para configurar o cardápio diário.</p>;
  }

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Escolha quais pratos quentes aparecem em cada dia da semana.
      </p>
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {WEEKDAYS.map((d, i) => (
          <button
            key={d}
            onClick={() => setWeekday(i)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${weekday === i ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
          >
            {d.slice(0, 3)}
          </button>
        ))}
      </div>
      <h3 className="mb-2 font-display text-lg font-semibold">{WEEKDAYS[weekday]}</h3>
      <div className="space-y-2">
        {dailyProducts.map((p) => {
          const on = included.has(p.id);
          return (
            <button
              key={p.id}
              onClick={async () => {
                await setItem({ data: { weekday, product_id: p.id, include: !on } });
                refresh();
              }}
              className={`flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left ${on ? "border-primary bg-primary/5" : "border-border glass-card"}`}
            >
              <span className="text-sm font-medium">{p.name}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {on ? "No cardápio" : "Fora"}
              </span>
            </button>
          );
        })}
        {dailyProducts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum produto na categoria Pratos quentes.</p>}
      </div>
    </div>
  );
}

// ---------------- Entregadores ----------------

function CouriersTab({ data }: { data: AdminData }) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveCourier);
  const [editing, setEditing] = useState<Courier | "new" | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  return (
    <div>
      <button onClick={() => setEditing("new")} className={`mb-3 flex items-center gap-1 ${btnCls}`}>
        <Plus className="h-4 w-4" /> Novo entregador
      </button>
      <div className="space-y-2">
        {data.couriers.map((c) => (
          <article key={c.id} className="flex items-center justify-between rounded-2xl border border-border glass-card p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {c.phone}{c.vehicle_plate ? ` • ${c.vehicle_plate}` : ""} • {c.active ? "Ativo" : "Inativo"}
              </p>
            </div>
            <button onClick={() => setEditing(c)} className="rounded-lg bg-secondary p-2" aria-label={`Editar ${c.name}`}>
              <Pencil className="h-4 w-4" />
            </button>
          </article>
        ))}
        {data.couriers.length === 0 && <p className="text-sm text-muted-foreground">Nenhum entregador cadastrado.</p>}
      </div>

      {editing && (
        <CourierForm
          courier={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            await save({ data: v });
            toast.success("Entregador salvo");
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function CourierForm({
  courier, onClose, onSave,
}: {
  courier: Courier | null;
  onClose: () => void;
  onSave: (v: { id?: string; name: string; phone: string; email?: string; vehicle_plate?: string; password?: string; active: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState(courier?.name ?? "");
  const [phone, setPhone] = useState(courier?.phone ?? "");
  const [email, setEmail] = useState(courier?.email ?? "");
  const [plate, setPlate] = useState(courier?.vehicle_plate ?? "");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(courier?.active ?? true);
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-scrim" onClick={onClose}>
      <div className="max-h-[92vh] overflow-y-auto rounded-t-3xl bg-background p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold">{courier ? "Editar entregador" : "Novo entregador"}</h2>
        <div className="mt-4 space-y-3">
          <input className={inputCls} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} placeholder="Telefone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className={inputCls} placeholder="E-mail (opcional)" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={inputCls} placeholder="Placa do veículo (opcional)" value={plate} onChange={(e) => setPlate(e.target.value)} />
          <input className={inputCls} type="password" placeholder={courier ? "Nova senha (deixe vazio para manter)" : "Senha de acesso"} value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
            Ativo
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-primary" />
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-2xl bg-secondary py-3.5 font-semibold">Cancelar</button>
          <button
            disabled={saving || name.trim().length < 2 || phone.trim().length < 8 || (!courier && password.length < 4)}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({ ...(courier?.id ? { id: courier.id } : {}), name: name.trim(), phone: phone.trim(), email, vehicle_plate: plate, ...(password ? { password } : {}), active });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro ao salvar");
                setSaving(false);
              }
            }}
            className="flex-1 rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Senhas ----------------

function PasswordsTab() {
  const change = useServerFn(changeRoutePassword);
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Defina a senha de acesso de cada área, incluindo esta tela de admin.</p>
      {Object.entries(ROUTE_LABELS).map(([route, label]) => (
        <div key={route} className="rounded-2xl border border-border glass-card p-4">
          <p className="text-sm font-semibold">{label}</p>
          <div className="mt-2 flex gap-2">
            <input
              type="password"
              className={inputCls}
              placeholder="Nova senha (mín. 4)"
              value={values[route] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [route]: e.target.value }))}
            />
            <button
              disabled={(values[route] ?? "").length < 4}
              onClick={async () => {
                try {
                  await change({ data: { route: route as "admin" | "cozinha" | "entrega" | "caixa", password: values[route] } });
                  toast.success(`Senha de ${label} atualizada`);
                  setValues((v) => ({ ...v, [route]: "" }));
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erro");
                }
              }}
              className={btnCls}
            >
              Salvar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Aparência ----------------

function AppearanceTab() {
  const save = useServerFn(saveSettings);
  const queryClient = useQueryClient();
  const { data: settings } = useOpsQuery(["settings"], () => getSettings(), 60000);
  const [name, setName] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);

  if (!settings) return null;
  const curName = name ?? settings.restaurant_name;
  const curColor = color ?? settings.primary_color;
  const curLogo = logo ?? settings.logo_url ?? "";

  return (
    <div className="rounded-2xl border border-border glass-card p-4">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Nome do restaurante</label>
          <input className={inputCls} value={curName} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Cor principal</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={curColor}
              onChange={(e) => setColor(e.target.value)}
              className="h-12 w-16 cursor-pointer rounded-lg border border-border"
            />
            <span className="text-sm text-muted-foreground">{curColor}</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">URL do logo (opcional)</label>
          <input className={inputCls} value={curLogo} onChange={(e) => setLogo(e.target.value)} />
        </div>
      </div>
      <button
        onClick={async () => {
          try {
            await save({ data: { restaurant_name: curName.trim(), primary_color: curColor, logo_url: curLogo || undefined } });
            toast.success("Aparência salva");
            queryClient.invalidateQueries({ queryKey: ["settings"] });
            setTimeout(() => window.location.reload(), 600);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao salvar");
          }
        }}
        className={`mt-4 w-full ${btnCls} py-3.5`}
      >
        Salvar aparência
      </button>
    </div>
  );
}

// ---------------- Financeiro ----------------

function FinanceTab() {
  const fetchFinance = useServerFn(getFinanceData);
  const [days, setDays] = useState(30);
  const { data } = useOpsQuery(["finance", String(days)], () => fetchFinance({ data: { days } }), 60000);
  const [openShift, setOpenShift] = useState<string | null>(null);

  if (!data) return null;

  const entries = data.entries;
  const income = entries.filter((e) => e.type === "income").reduce((s, e) => s + Number(e.amount), 0);
  const expense = entries.filter((e) => e.type === "expense").reduce((s, e) => s + Number(e.amount), 0);
  const ordersTotal = data.orders.reduce((s, o) => s + Number(o.total), 0);
  const byMethod: Record<string, number> = {};
  for (const o of data.orders) {
    const m = o.payment_method ?? "Outros";
    byMethod[m] = (byMethod[m] ?? 0) + Number(o.total);
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${days === d ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
          >
            {d} dias
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-border glass-card p-4">
          <p className="text-xs text-muted-foreground">Faturamento (pedidos)</p>
          <p className="font-display mt-1 text-xl font-bold">{brl(ordersTotal)}</p>
          <p className="text-xs text-muted-foreground">{data.orders.length} pedidos</p>
        </div>
        <div className="rounded-2xl border border-border glass-card p-4">
          <p className="text-xs text-muted-foreground">Resultado de caixa</p>
          <p className={`font-display mt-1 text-xl font-bold ${income - expense >= 0 ? "text-primary" : "text-destructive"}`}>
            {brl(income - expense)}
          </p>
          <p className="text-xs text-muted-foreground">+{brl(income)} / −{brl(expense)}</p>
        </div>
      </div>

      <h3 className="mb-2 mt-5 text-sm font-semibold">Pedidos por pagamento</h3>
      <div className="rounded-2xl border border-border glass-card p-4 text-sm">
        {Object.entries(byMethod).map(([m, v]) => (
          <div key={m} className="flex justify-between py-1"><span>{m}</span><span className="font-medium">{brl(v)}</span></div>
        ))}
        {Object.keys(byMethod).length === 0 && <p className="text-muted-foreground">Sem pedidos no período.</p>}
      </div>

      <h3 className="mb-2 mt-5 text-sm font-semibold">Turnos fechados</h3>
      <div className="space-y-2">
        {data.shifts.map((s) => (
          <article key={s.id} className="rounded-2xl border border-border glass-card">
            <button
              onClick={() => setOpenShift(openShift === s.id ? null : s.id)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <div>
                <p className="text-sm font-semibold">
                  {new Date(s.opened_at).toLocaleDateString("pt-BR")} •{" "}
                  {new Date(s.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-xs text-muted-foreground">
                  Fechado {s.closed_at ? new Date(s.closed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                </p>
              </div>
              {s.report != null && (
                <span className="text-sm font-bold text-primary">
                  {brl((s.report as { total_income?: number }).total_income ?? 0)}
                </span>
              )}
            </button>
            {openShift === s.id && s.report != null && (
              <div className="border-t border-border p-4 text-sm">
                {(() => {
                  const r = s.report as {
                    total_income: number; total_expense: number; opening_amount: number;
                    orders_count: number; orders_total: number; by_method: Record<string, number>;
                  };
                  return (
                    <div className="space-y-1">
                      <div className="flex justify-between"><span>Pedidos ({r.orders_count})</span><span>{brl(r.orders_total)}</span></div>
                      <div className="flex justify-between"><span>Entradas</span><span className="text-primary">{brl(r.total_income)}</span></div>
                      <div className="flex justify-between"><span>Saídas</span><span className="text-destructive">{brl(r.total_expense)}</span></div>
                      <div className="flex justify-between font-bold"><span>Saldo final</span><span>{brl(r.opening_amount + r.total_income - r.total_expense)}</span></div>
                      {Object.entries(r.by_method ?? {}).map(([m, v]) => (
                        <div key={m} className="flex justify-between text-muted-foreground"><span>{m}</span><span>{brl(v)}</span></div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </article>
        ))}
        {data.shifts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum turno fechado ainda.</p>}
      </div>
    </div>
  );
}
