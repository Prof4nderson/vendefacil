import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getSupportMessages,
  getSupportUnreadCount,
  sendSupportMessage,
  type SupportMessage,
} from "@/lib/support.functions";

const inputClass = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm";

export function SupportChat({ enabled }: { enabled: boolean }) {
  const loadMessages = useServerFn(getSupportMessages);
  const loadUnread = useServerFn(getSupportUnreadCount);
  const send = useServerFn(sendSupportMessage);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingError, setLoadingError] = useState("");
  const messagesPane = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const poll = async () => {
      try {
        const count = await loadUnread();
        if (active) setUnread(count);
        if (open) {
          const rows = await loadMessages();
          if (active) {
            setMessages(rows);
            setLoadingError("");
            setUnread(0);
          }
        }
      } catch (error) {
        if (active)
          setLoadingError(
            error instanceof Error ? error.message : "Não foi possível carregar o suporte",
          );
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 6000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled, open, loadMessages, loadUnread]);

  useEffect(() => {
    const pane = messagesPane.current;
    if (open && pane && stickToBottom.current) pane.scrollTop = pane.scrollHeight;
  }, [messages, open]);

  async function submit() {
    const message = draft.trim();
    if (!message || sending) return;
    setSending(true);
    try {
      await send({ data: { message } });
      setDraft("");
      setLoadingError("");
      stickToBottom.current = true;
      const rows = await loadMessages();
      setMessages(rows);
      setUnread(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem");
    } finally {
      setSending(false);
    }
  }

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Abrir suporte"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-24 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 font-bold text-primary-foreground shadow-xl"
      >
        <MessageCircle className="h-5 w-5" /> Suporte
        {unread > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-xs text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <section className="fixed bottom-36 right-4 z-50 flex h-[min(520px,calc(100vh-11rem))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <header className="flex items-center gap-3 border-b border-border p-4">
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold">Suporte VendeFácil</p>
              <p className="text-xs text-muted-foreground">Envie sua dúvida para o SysAdm</p>
            </div>
            <button
              type="button"
              aria-label="Fechar suporte"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div
            ref={messagesPane}
            onScroll={(event) => {
              const pane = event.currentTarget;
              stickToBottom.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 80;
            }}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
          >
            {loadingError && (
              <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                {loadingError}
              </p>
            )}
            {!messages.length && !loadingError && (
              <p className="mt-8 text-center text-sm text-muted-foreground">
                Ainda não há mensagens. Como podemos ajudar?
              </p>
            )}
            {messages.map((item) => (
              <div
                key={item.id}
                className={`max-w-[88%] rounded-2xl px-3 py-2 ${item.sender_role === "user" ? "ml-auto bg-primary text-primary-foreground" : "mr-auto bg-secondary"}`}
              >
                <p className="whitespace-pre-wrap break-words text-sm">{item.message}</p>
                <p
                  className={`mt-1 text-right text-[10px] ${item.sender_role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                >
                  {item.sender_role === "user" ? "Você" : "SysAdm"} ·{" "}
                  {new Date(item.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <textarea
              className={`${inputClass} max-h-28 min-h-10 resize-y`}
              maxLength={4000}
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder="Escreva sua mensagem…"
            />
            <button
              type="submit"
              aria-label="Enviar mensagem"
              disabled={sending || !draft.trim()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
