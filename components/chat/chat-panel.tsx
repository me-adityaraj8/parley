"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, X, AlertCircle } from "lucide-react";
import type { ChatMessage } from "@/types";
import { Input } from "@/components/ui/input";
import { gsap, useGSAP } from "@/lib/gsap";
import { messageIn, panelIn, prefersReducedMotion } from "@/lib/animations";
import { avatarStyle, initials } from "@/lib/room";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  open: boolean;
  messages: ChatMessage[];
  typingPeers: string[];
  onSend: (body: string) => void;
  onTyping: (on: boolean) => void;
  onClose: () => void;
}

export function ChatPanel({
  open,
  messages,
  typingPeers,
  onSend,
  onTyping,
  onClose,
}: ChatPanelProps) {
  const root = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const seen = useRef(new Set<string>());

  useGSAP(
    () => {
      if (open && root.current) panelIn(root.current, "right");
    },
    { scope: root, dependencies: [open] },
  );

  // Animate only messages we have not animated before — re-running over the
  // whole list on every render would re-trigger old messages.
  useEffect(() => {
    if (!listRef.current) return;
    for (const m of messages) {
      if (seen.current.has(m.id)) continue;
      seen.current.add(m.id);
      const el = listRef.current.querySelector<HTMLElement>(`[data-msg="${m.id}"]`);
      if (el) messageIn(el);
    }
    const list = listRef.current;
    gsap.to(list, {
      scrollTop: list.scrollHeight,
      duration: prefersReducedMotion() ? 0 : 0.4,
      ease: "power2.out",
      overwrite: true,
    });
  }, [messages]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
    onTyping(false);
  };

  if (!open) return null;

  return (
    <aside
      ref={root}
      aria-label="Chat"
      className="glass-strong flex h-full w-full flex-col rounded-2xl sm:w-80"
    >
      <header className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <MessageSquare className="size-4 text-violet" aria-hidden />
        <h2 className="text-sm font-medium">Chat</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="ml-auto flex size-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((m, i) => (
            <Bubble
              key={m.id}
              message={m}
              grouped={
                i > 0 &&
                messages[i - 1]?.authorId === m.authorId &&
                m.at - (messages[i - 1]?.at ?? 0) < 60_000
              }
            />
          ))
        )}
      </div>

      {typingPeers.length > 0 && (
        <p className="px-4 pb-1 text-xs text-muted-foreground" aria-live="polite">
          {typingPeers.length === 1
            ? `${typingPeers[0]} is typing…`
            : `${typingPeers.length} people are typing…`}
        </p>
      )}

      <form
        onSubmit={submit}
        className="flex items-center gap-2 border-t border-hairline p-3"
      >
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <Input
          id="chat-input"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onTyping(e.target.value.length > 0);
          }}
          onBlur={() => onTyping(false)}
          placeholder="Send a message"
          maxLength={2000}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border-transparent bg-white/5 px-4"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Send message"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full transition-all",
            draft.trim()
              ? "bg-violet text-white hover:brightness-110"
              : "bg-white/5 text-muted-foreground",
          )}
        >
          <Send className="size-4" aria-hidden />
        </button>
      </form>
    </aside>
  );
}

function Bubble({ message, grouped }: { message: ChatMessage; grouped: boolean }) {
  const time = new Date(message.at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      data-msg={message.id}
      className={cn("flex gap-2", message.mine && "flex-row-reverse")}
    >
      {!message.mine && !grouped ? (
        <span
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium"
          style={avatarStyle(message.authorId)}
          aria-hidden
        >
          {initials(message.authorName)}
        </span>
      ) : (
        !message.mine && <span className="size-7 shrink-0" aria-hidden />
      )}

      <div className={cn("max-w-[78%]", message.mine && "text-right")}>
        {!grouped && (
          <p className="mb-1 text-[11px] text-muted-foreground">
            {message.mine ? "You" : message.authorName}
            <span className="ml-1.5 opacity-60">{time}</span>
          </p>
        )}
        <div
          className={cn(
            "inline-block rounded-2xl px-3 py-2 text-sm break-words text-left",
            message.mine
              ? "bg-violet/90 text-white rounded-br-md"
              : "bg-white/8 rounded-bl-md",
            message.failed && "opacity-60 ring-1 ring-danger/50",
          )}
        >
          {message.body}
        </div>
        {message.failed && (
          <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-danger">
            <AlertCircle className="size-3" aria-hidden />
            Not delivered — no peers connected
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="glass flex size-12 items-center justify-center rounded-2xl">
        <MessageSquare className="size-5 text-violet" aria-hidden />
      </div>
      <p className="text-sm font-medium">No messages yet</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Messages are sent directly to each participant over the same encrypted
        connection as your video. Nothing is stored on a server.
      </p>
    </div>
  );
}
