import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, Tags, Plus, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { SysadmSupportPanel } from "@/components/sysadm-support-panel";
import {
  getSysadmSession,
  sysadmLogin,
  sysadmLogout,
  sysadmListUsers,
  sysadmSaveUser,
  sysadmDeleteUser,
  sysadmSetUserStatus,
  sysadmSendMessage,
  sysadmListActivity,
  sysadmListProducts,
  sysadmSaveProduct,
  sysadmDeleteProduct,
  sysadmListCategories,
  sysadmSaveCategory,
  sysadmDeleteCategory,
  sysadmChangePassword,
  type SysUser,
  type GlobalProduct,
  type GlobalCatalogCategory,
  type SysActivity,
} from "@/lib/sysadm.functions";

export const Route = createFileRoute("/sysadm")({
  loader: () => getSysadmSession(),
  component: SysadmPage,
});

const input = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm";
const blankUser = {
  name: "",
  login: "",
  email: "",
  whatsapp: "",
  password: "",
  role: "operator" as const,
  status: "active" as const,
  status_note: "",
  workspace_name: "",
};
const blankProduct = {
  category_id: "",
  name: "",
  description: "",
  suggested_purchase_price: 0,
  suggested_price: 0,
  icon: "📦",
  image_url: "",
  active: true,
};

function SysadmPage() {
  const initial = Route.useLoaderData();
  const login = useServerFn(sysadmLogin);
  const logout = useServerFn(sysadmLogout);
  const listUsers = useServerFn(sysadmListUsers);
  const saveUser = useServerFn(sysadmSaveUser);
  const deleteUser = useServerFn(sysadmDeleteUser);
  const setStatus = useServerFn(sysadmSetUserStatus);
  const sendMessage = useServerFn(sysadmSendMessage);
  const listActivity = useServerFn(sysadmListActivity);
  const listProducts = useServerFn(sysadmListProducts);
  const saveProduct = useServerFn(sysadmSaveProduct);
  const deleteProduct = useServerFn(sysadmDeleteProduct);
  const listCategories = useServerFn(sysadmListCategories);
  const saveCategory = useServerFn(sysadmSaveCategory);
  const deleteCategory = useServerFn(sysadmDeleteCategory);
  const changePassword = useServerFn(sysadmChangePassword);

  const [authenticated, setAuthenticated] = useState(initial.authenticated);
  const [password, setPassword] = useState("");
  const [users, setUsers] = useState<SysUser[]>([]);
  const [products, setProducts] = useState<GlobalProduct[]>([]);
  const [categories, setCategories] = useState<GlobalCatalogCategory[]>([]);
  const [activities, setActivities] = useState<SysActivity[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [user, setUser] = useState<typeof blankUser>(blankUser);
  const [editingUserId, setEditingUserId] = useState<string | undefined>();
  const [product, setProduct] = useState<typeof blankProduct>(blankProduct);
  const [editingProductId, setEditingProductId] = useState<string | undefined>();
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | undefined>();
  const [messageFor, setMessageFor] = useState<SysUser | null>(null);
  const [message, setMessage] = useState("");
  const [sysPassword, setSysPassword] = useState({ currentPassword: "", newPassword: "" });
  const [working, setWorking] = useState(false);
  const seenRegistrationIds = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    if (!authenticated) return;
    try {
      const [userRows, productRows, categoryRows, activityRows] = await Promise.all([
        listUsers({ data: { search: userSearch } }),
        listProducts({ data: { search: productSearch } }),
        listCategories(),
        listActivity({ data: { search: activitySearch } }),
      ]);
      setUsers(userRows);
      setProducts(productRows);
      setCategories(categoryRows);
      setActivities(activityRows);
      setProduct((current) =>
        current.category_id || !categoryRows[0]
          ? current
          : { ...current, category_id: categoryRows[0].id },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar SysAdm");
    }
  }, [
    authenticated,
    userSearch,
    productSearch,
    activitySearch,
    listUsers,
    listProducts,
    listCategories,
    listActivity,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 250);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (!authenticated) {
      seenRegistrationIds.current = null;
      return;
    }
    let active = true;
    const poll = async () => {
      try {
        const registrations = await listActivity({ data: { search: "Cadastro iniciado" } });
        if (!active) return;
        if (seenRegistrationIds.current === null) {
          seenRegistrationIds.current = new Set(registrations.map((item) => item.id));
        } else {
          const known = seenRegistrationIds.current;
          for (const item of registrations) {
            if (!known.has(item.id)) {
              toast.success(`Novo usuário cadastrado: ${item.user_name}`);
              known.add(item.id);
            }
          }
        }
        await refresh();
      } catch {
        // O refresh principal apresenta os erros de carregamento ao operador.
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [authenticated, listActivity, refresh]);

  async function enter() {
    try {
      const result = await login({ data: { password } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setAuthenticated(true);
      setPassword("");
      toast.success("SysAdm autenticado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao autenticar");
    }
  }

  async function saveCurrentUser() {
    try {
      await saveUser({
        data: {
          ...user,
          password: user.password.trim() || undefined,
          id: editingUserId,
        },
      });
      toast.success("Usuário salvo");
      setUser(blankUser);
      setEditingUserId(undefined);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o usuário");
    }
  }

  async function saveCurrentCategory() {
    setWorking(true);
    try {
      await saveCategory({ data: { id: editingCategoryId, name: categoryName } });
      toast.success(editingCategoryId ? "Categoria global renomeada" : "Categoria global criada");
      setCategoryName("");
      setEditingCategoryId(undefined);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a categoria");
    } finally {
      setWorking(false);
    }
  }

  async function saveCurrentProduct() {
    if (!product.category_id) {
      toast.error("Cadastre ou selecione uma categoria global");
      return;
    }
    setWorking(true);
    try {
      await saveProduct({ data: { ...product, id: editingProductId } });
      toast.success("Produto global salvo");
      setProduct({ ...blankProduct, category_id: categories[0]?.id ?? "" });
      setEditingProductId(undefined);
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar o produto global",
      );
    } finally {
      setWorking(false);
    }
  }

  if (!authenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-4">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6">
          <h1 className="font-display text-2xl font-bold">SysAdm</h1>
          <p className="mt-1 text-sm text-muted-foreground">Administração global do VendeFácil</p>
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void enter()}
            placeholder="Senha SysAdm"
            className={`${input} mt-5`}
          />
          <button
            onClick={() => void enter()}
            className="mt-3 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground"
          >
            Entrar
          </button>
        </div>
      </main>
    );
  }

  const filteredCategories = categories.filter((category) =>
    category.name
      .toLocaleLowerCase("pt-BR")
      .includes(categorySearch.trim().toLocaleLowerCase("pt-BR")),
  );

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex items-center gap-3">
          <div>
            <p className="eyebrow">Controle global</p>
            <h1 className="font-display text-3xl font-bold">SysAdm</h1>
          </div>
          <button
            onClick={async () => {
              await logout();
              setAuthenticated(false);
            }}
            className="ml-auto rounded-xl bg-secondary px-4 py-2 text-sm font-bold"
          >
            Sair
          </button>
        </header>

        <section className="rounded-3xl border border-border bg-card p-5">
          <h2 className="font-display text-xl font-bold">Usuários</h2>
          <SearchInput
            value={userSearch}
            onChange={setUserSearch}
            placeholder="Pesquisar nome, login, email, telefone ou estabelecimento"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {users.length} resultado(s) · limite de 500 por pesquisa
          </p>
          <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto">
            {users.map((account) => (
              <div key={account.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {account.name}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({account.status})
                      </span>
                    </p>
                    <p className="break-words text-xs text-muted-foreground">
                      {account.email} · {account.workspace_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ativação:{" "}
                      {account.verified_at
                        ? new Date(account.verified_at).toLocaleString("pt-BR")
                        : "Pendente"}{" "}
                      · Criado: {new Date(account.created_at).toLocaleString("pt-BR")}
                    </p>
                    {account.last_login_at && (
                      <p className="text-xs text-muted-foreground">
                        Último login: {new Date(account.last_login_at).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingUserId(account.id);
                        setUser({
                          name: account.name,
                          login: account.login,
                          email: account.email,
                          whatsapp: account.whatsapp,
                          password: "",
                          role: account.role as typeof user.role,
                          status: account.status as typeof user.status,
                          status_note: account.status_note || "",
                          workspace_name: account.workspace_name,
                        });
                      }}
                      className="rounded-lg bg-secondary px-2 py-1 text-xs"
                    >
                      Editar
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Excluir usuário e todos os dados do estabelecimento?"))
                          return;
                        try {
                          await deleteUser({ data: { id: account.id } });
                          await refresh();
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Não foi possível excluir",
                          );
                        }
                      }}
                      className="rounded-lg bg-red-400/10 px-2 py-1 text-xs text-red-300"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    value={account.status}
                    onChange={async (event) => {
                      try {
                        await setStatus({
                          data: {
                            id: account.id,
                            status: event.target.value as "active" | "disabled" | "suspended",
                          },
                        });
                        await refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Não foi possível atualizar o status",
                        );
                      }
                    }}
                    className={`${input} min-w-40 flex-1`}
                  >
                    <option value="active">Ativa</option>
                    <option value="disabled">Desativada</option>
                    <option value="suspended">Suspensa</option>
                  </select>
                  <button
                    onClick={() => setMessageFor(account)}
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                  >
                    Enviar mensagem
                  </button>
                </div>
              </div>
            ))}
            {!users.length && (
              <p className="rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">
                Nenhum usuário encontrado.
              </p>
            )}
          </div>
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <h3 className="font-bold">{editingUserId ? "Editar usuário" : "Novo usuário"}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["name", "login", "email", "whatsapp", "workspace_name"] as const).map((key) => (
                <input
                  key={key}
                  className={input}
                  placeholder={key === "workspace_name" ? "Estabelecimento" : key}
                  value={user[key]}
                  onChange={(event) => setUser({ ...user, [key]: event.target.value })}
                />
              ))}
              <input
                className={input}
                type="password"
                placeholder={editingUserId ? "Nova senha (opcional)" : "Senha"}
                value={user.password}
                onChange={(event) => setUser({ ...user, password: event.target.value })}
              />
              <select
                className={input}
                value={user.role}
                onChange={(event) =>
                  setUser({ ...user, role: event.target.value as typeof user.role })
                }
              >
                <option value="owner">Proprietário</option>
                <option value="manager">Gerente</option>
                <option value="operator">Operador</option>
              </select>
              <select
                className={input}
                value={user.status}
                onChange={(event) =>
                  setUser({ ...user, status: event.target.value as typeof user.status })
                }
              >
                <option value="active">Ativa</option>
                <option value="disabled">Desativada</option>
                <option value="suspended">Suspensa</option>
              </select>
              <input
                className={`${input} sm:col-span-2`}
                placeholder="Motivo/status (opcional)"
                value={user.status_note}
                onChange={(event) => setUser({ ...user, status_note: event.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setUser(blankUser);
                  setEditingUserId(undefined);
                }}
                className="rounded-xl bg-secondary px-4 py-2 text-sm font-bold"
              >
                Limpar
              </button>
              <button
                onClick={() => void saveCurrentUser()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
              >
                Salvar usuário
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-border bg-card p-5">
          <h2 className="font-display text-xl font-bold">Atividades dos usuários</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Eventos de cadastro, verificação, login/logout, perfil, senha, suporte e criação de
            vendas. Últimos 300 resultados.
          </p>
          <SearchInput
            value={activitySearch}
            onChange={setActivitySearch}
            placeholder="Pesquisar usuário, ação ou IP"
          />
          <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
            {activities.map((activity) => (
              <article key={activity.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-bold">
                    {activity.user_name}{" "}
                    <span className="font-normal text-muted-foreground">({activity.login})</span>
                  </p>
                  <time className="text-xs text-muted-foreground">
                    {new Date(activity.created_at).toLocaleString("pt-BR")}
                  </time>
                </div>
                <p className="mt-1 text-sm">
                  {activity.action}
                  {activity.details ? ` — ${activity.details}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activity.workspace_name || activity.email} · IP:{" "}
                  {activity.source_ip || "não informado"}
                </p>
              </article>
            ))}
            {!activities.length && (
              <p className="rounded-xl bg-secondary/50 p-3 text-sm text-muted-foreground">
                Nenhuma atividade registrada para essa pesquisa.
              </p>
            )}
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <section className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-bold">Categorias globais</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Gerencie as opções reutilizáveis oferecidas no catálogo global.
            </p>
            <SearchInput
              value={categorySearch}
              onChange={setCategorySearch}
              placeholder="Pesquisar categorias"
            />
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {filteredCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-2 rounded-xl border border-border p-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {category.name}
                  </span>
                  <button
                    aria-label={`Editar ${category.name}`}
                    onClick={() => {
                      setEditingCategoryId(category.id);
                      setCategoryName(category.name);
                    }}
                    className="rounded-lg bg-secondary p-2"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    aria-label={`Excluir ${category.name}`}
                    onClick={async () => {
                      if (
                        !confirm(
                          `Excluir a categoria “${category.name}”? Ela precisa estar sem produtos globais.`,
                        )
                      )
                        return;
                      try {
                        await deleteCategory({ data: { id: category.id } });
                        toast.success("Categoria removida");
                        await refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Não foi possível excluir a categoria",
                        );
                      }
                    }}
                    className="rounded-lg bg-red-400/10 p-2 text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {!filteredCategories.length && (
                <p className="rounded-xl bg-secondary/50 p-3 text-sm text-muted-foreground">
                  Nenhuma categoria encontrada.
                </p>
              )}
            </div>
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <h3 className="font-bold">
                {editingCategoryId ? "Renomear categoria" : "Nova categoria"}
              </h3>
              <input
                className={input}
                maxLength={80}
                placeholder="Nome da categoria"
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
              />
              <div className="flex gap-2">
                {editingCategoryId && (
                  <button
                    onClick={() => {
                      setEditingCategoryId(undefined);
                      setCategoryName("");
                    }}
                    className="rounded-xl bg-secondary px-4 py-2 text-sm font-bold"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  disabled={working || categoryName.trim().length < 2}
                  onClick={() => void saveCurrentCategory()}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />{" "}
                  {editingCategoryId ? "Salvar categoria" : "Criar categoria"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5">
            <h2 className="font-display text-xl font-bold">Produtos globais</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              As alterações em um produto global vinculado atualizam também os itens associados nos
              estabelecimentos.
            </p>
            <SearchInput
              value={productSearch}
              onChange={setProductSearch}
              placeholder="Pesquisar por produto, descrição ou categoria"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {products.length} produto(s) encontrado(s) · limite de 1.000
            </p>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {products.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-xl border border-border p-2"
                >
                  <span className="text-xl">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.category_name} · {brl(item.suggested_price)} ·{" "}
                      {item.active ? "Ativo" : "Inativo"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingProductId(item.id);
                      setProduct({
                        category_id: item.category_id,
                        name: item.name,
                        description: item.description || "",
                        suggested_purchase_price: Number(item.suggested_purchase_price),
                        suggested_price: Number(item.suggested_price),
                        icon: item.icon,
                        image_url: item.image_url || "",
                        active: item.active,
                      });
                    }}
                    className="rounded-lg bg-secondary px-2 py-1 text-xs"
                  >
                    Editar
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Excluir o produto global “${item.name}”?`)) return;
                      try {
                        await deleteProduct({ data: { id: item.id } });
                        toast.success("Produto global removido");
                        await refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Não foi possível excluir o produto",
                        );
                      }
                    }}
                    className="rounded-lg bg-red-400/10 px-2 py-1 text-xs text-red-300"
                  >
                    Excluir
                  </button>
                </div>
              ))}
              {!products.length && (
                <p className="rounded-xl bg-secondary/50 p-3 text-sm text-muted-foreground">
                  Nenhum produto encontrado.
                </p>
              )}
            </div>
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <h3 className="font-bold">
                {editingProductId ? "Editar produto global" : "Novo produto global"}
              </h3>
              <select
                className={input}
                value={product.category_id}
                onChange={(event) => setProduct({ ...product, category_id: event.target.value })}
              >
                <option value="">Selecione uma categoria global</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input
                className={input}
                maxLength={120}
                placeholder="Nome do produto"
                value={product.name}
                onChange={(event) => setProduct({ ...product, name: event.target.value })}
              />
              <input
                className={input}
                placeholder="Descrição (opcional)"
                value={product.description}
                onChange={(event) => setProduct({ ...product, description: event.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Valor de custo"
                  value={product.suggested_purchase_price}
                  onChange={(event) =>
                    setProduct({ ...product, suggested_purchase_price: Number(event.target.value) })
                  }
                />
                <input
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Preço de venda"
                  value={product.suggested_price}
                  onChange={(event) =>
                    setProduct({ ...product, suggested_price: Number(event.target.value) })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={input}
                  maxLength={12}
                  placeholder="Ícone (ex.: 📦)"
                  value={product.icon}
                  onChange={(event) => setProduct({ ...product, icon: event.target.value })}
                />
                <input
                  className={input}
                  placeholder="URL da imagem (opcional)"
                  value={product.image_url}
                  onChange={(event) => setProduct({ ...product, image_url: event.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={product.active}
                  onChange={(event) => setProduct({ ...product, active: event.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                Disponível como sugestão global
              </label>
              <div className="flex gap-2">
                {editingProductId && (
                  <button
                    onClick={() => {
                      setProduct({ ...blankProduct, category_id: categories[0]?.id ?? "" });
                      setEditingProductId(undefined);
                    }}
                    className="rounded-xl bg-secondary px-4 py-2 text-sm font-bold"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  disabled={working || !categories.length || !product.name.trim()}
                  onClick={() => void saveCurrentProduct()}
                  className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  {editingProductId ? "Salvar produto global" : "Criar produto global"}
                </button>
              </div>
            </div>
          </section>
        </div>

        <SysadmSupportPanel />

        <section className="mt-5 rounded-3xl border border-border bg-card p-5">
          <h2 className="font-display text-xl font-bold">Trocar senha do SysAdm</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              className={input}
              type="password"
              autoComplete="current-password"
              placeholder="Senha atual"
              value={sysPassword.currentPassword}
              onChange={(event) =>
                setSysPassword({ ...sysPassword, currentPassword: event.target.value })
              }
            />
            <input
              className={input}
              type="password"
              autoComplete="new-password"
              placeholder="Nova senha (mín. 8 caracteres)"
              value={sysPassword.newPassword}
              onChange={(event) =>
                setSysPassword({ ...sysPassword, newPassword: event.target.value })
              }
            />
            <button
              onClick={async () => {
                try {
                  await changePassword({ data: sysPassword });
                  setSysPassword({ currentPassword: "", newPassword: "" });
                  toast.success("Senha do SysAdm alterada");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Erro ao alterar senha");
                }
              }}
              className="rounded-xl bg-secondary px-4 py-2 text-sm font-bold"
            >
              Alterar senha
            </button>
          </div>
        </section>
      </div>

      {messageFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-scrim p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5">
            <h2 className="font-bold">Mensagem para {messageFor.name}</h2>
            <textarea
              className={`${input} mt-3 min-h-32`}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Digite a mensagem"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setMessageFor(null)}
                className="flex-1 rounded-xl bg-secondary py-2 font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await sendMessage({ data: { userId: messageFor.id, message } });
                    setMessage("");
                    setMessageFor(null);
                    toast.success("Mensagem registrada");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Erro ao enviar mensagem");
                  }
                }}
                className="flex-1 rounded-xl bg-primary py-2 font-bold text-primary-foreground"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative mt-3 block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`${input} pl-9`}
      />
    </label>
  );
}
