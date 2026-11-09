import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  sysadmGetSupportMessages,
  sysadmListSupportThreads,
  sysadmReplySupport,
  type SysadmSupportMessage,
  type SysadmSupportThread,
} from "@/lib/sysadm.functions";

const inputClass = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm";

export function SysadmSupportPanel() {
  const listThreads = useServerFn(sysadmListSupportThreads);
  const getMessages = useServerFn(sysadmGetSupportMessages);
  const reply = useServerFn(sysadmReplySupport);
  const [threads, setThreads] = useState<SysadmSupportThread[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [messages, setMessages] = useState<SysadmSupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const seenUnread = useRef<Map<string, number> | null>(null);
  const messagesPane = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const refreshThreads = useCallback(async () => {
    try {
      const rows = await listThreads();
      const previous = seenUnread.current;
      if (previous) {
        for (const thread of rows) {
          if ((thread.unread_count ?? 0) > (previous.get(thread.user_id) ?? 0)) {
            toast.info(`Nova mensagem de suporte: ${thread.user_name}`);
          }
        }
      }
      seenUnread.current = new Map(
        rows.map((thread) => [thread.user_id, thread.unread_count ?? 0]),
      );
      setThreads(rows);
      setSelectedUserId((current) => current || rows[0]?.user_id || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar conversas");
    } finally {
      setLoading(false);
    }
  }, [listThreads]);

  const refreshMessages = useCallback(
    async (userId: string) => {
      if (!userId) {
        setMessages([]);
        return;
      }
      try {
        const rows = await getMessages({ data: { userId } });
        setMessages(rows);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível carregar mensagens");
      }
    },
    [getMessages],
  );

  useEffect(() => {
    void refreshThreads();
    const timer = window.setInterval(() => void refreshThreads(), 7000);
    return () => window.clearInterval(timer);
  }, [refreshThreads]);

  useEffect(() => {
    if (!selectedUserId) return;
    stickToBottom.current = true;
    void refreshMessages(selectedUserId);
    const timer = window.setInterval(() => void refreshMessages(selectedUserId), 5000);
    return () => window.clearInterval(timer);
  }, [selectedUserId, refreshMessages]);

  useEffect(() => {
    const pane = messagesPane.current;
    if (pane && stickToBottom.current) pane.scrollTop = pane.scrollHeight;
  }, [messages]);

  async function sendReply() {
    const text = draft.trim();
    if (!text || !selectedUserId || sending) return;
    setSending(true);
    try {
      await reply({ data: { userId: selectedUserId, message: text } });
      setDraft("");
      stickToBottom.current = true;
      await refreshMessages(selectedUserId);
      await refreshThreads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível responder");
    } finally {
      setSending(false);
    }
  }

  const selected = threads.find((thread) => thread.user_id === selectedUserId);

  return (
    <section className="mt-5 rounded-3xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Suporte aos usuários</h2>
        <span className="ml-auto rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
          {threads.reduce((total, thread) => total + (thread.unread_count ?? 0), 0)} não lida(s)
        </span>
      </div>
      <div className="grid h-[430px] grid-rows-[130px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border md:grid-cols-[250px_minmax(0,1fr)] md:grid-rows-1">
        <div className="min-h-0 overflow-y-auto border-b border-border md:border-b-0 md:border-r">
          {loading && <p className="p-4 text-sm text-muted-foreground">Carregando conversas…</p>}
          {!loading && !threads.length && (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa de suporte.</p>
          )}
          {threads.map((thread) => (
            <button
              key={thread.user_id}
              type="button"
              onClick={() => setSelectedUserId(thread.user_id)}
              className={`block w-full border-b border-border p-3 text-left ${selectedUserId === thread.user_id ? "bg-primary/10" : "hover:bg-secondary/60"}`}
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-bold">
                  {thread.user_name}
                </span>
                {thread.unread_count > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {thread.unread_count}
                  </span>
                )}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {thread.workspace_name || thread.email}
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {thread.last_message}
              </span>
            </button>
          ))}
        </div>
        <div className="flex min-h-0 flex-col">
          {selected ? (
            <>
              <header className="border-b border-border p-3">
                <p className="text-sm font-bold">
                  {selected.user_name} · {selected.workspace_name || selected.login}
                </p>
                <p className="text-xs text-muted-foreground">{selected.email}</p>
              </header>
              <div
                ref={messagesPane}
                onScroll={(event) => {
                  const pane = event.currentTarget;
                  stickToBottom.current =
                    pane.scrollHeight - pane.scrollTop - pane.clientHeight < 80;
                }}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
              >
                {messages.map((item) => (
                  <div
                    key={item.id}
                    className={`max-w-[88%] rounded-2xl px-3 py-2 ${item.sender_role === "sysadm" ? "ml-auto bg-primary text-primary-foreground" : "mr-auto bg-secondary"}`}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm">{item.message}</p>
                    <p
                      className={`mt-1 text-right text-[10px] ${item.sender_role === "sysadm" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    >
                      {item.sender_role === "sysadm" ? "SysAdm" : selected.user_name} ·{" "}
                      {new Date(item.created_at).toLocaleString("pt-BR")}
                      {item.source_ip && item.sender_role === "user"
                        ? ` · IP ${item.source_ip}`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
              <form
                className="flex items-end gap-2 border-t border-border p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendReply();
                }}
              >
                <textarea
                  className={`${inputClass} max-h-28 min-h-10 resize-y`}
                  rows={1}
                  maxLength={4000}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendReply();
                    }
                  }}
                  placeholder="Responder ao usuário…"
                />
                <button
                  type="submit"
                  aria-label="Enviar resposta"
                  disabled={sending || !draft.trim()}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <p className="grid flex-1 place-items-center p-4 text-sm text-muted-foreground">
              Selecione uma conversa para ler e responder.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
