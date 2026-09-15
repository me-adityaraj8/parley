"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Copy, CornerUpLeft, MessageSquare, Send, SmilePlus, X } from "lucide-react";
import type { ChatMessage } from "@/types";
import { Input } from "@/components/ui/input";
import { gsap, useGSAP } from "@/lib/gsap";
import { messageIn, panelIn, prefersReducedMotion } from "@/lib/animations";
import { avatarStyle, initials } from "@/lib/room";
import { cn } from "@/lib/utils";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉"];

interface ChatPanelProps {
  open: boolean;
  messages: ChatMessage[];
  typingPeers: string[];
  onSend: (body: string, replyTo?: string) => void;
  onTyping: (on: boolean) => void;
  onReact: (messageId: string, emoji: string) => void;
  onClose: () => void;
}

export function ChatPanel({
  open,
  messages,
  typingPeers,
  onSend,
  onTyping,
  onReact,
  onClose,
}: ChatPanelProps) {
  const root = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
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
    onSend(draft, replyTo?.id);
    setDraft("");
    setReplyTo(null);
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
          messages.map((m, i) =>
            m.system ? (
              <SystemNotice key={m.id} message={m} />
            ) : (
              <Bubble
                key={m.id}
                message={m}
                repliedTo={m.replyTo ? messages.find((x) => x.id === m.replyTo) : undefined}
                grouped={
                  i > 0 &&
                  !messages[i - 1]?.system &&
                  messages[i - 1]?.authorId === m.authorId &&
                  m.at - (messages[i - 1]?.at ?? 0) < 60_000
                }
                onReact={onReact}
                onReply={() => setReplyTo(m)}
              />
            ),
          )
        )}
      </div>

      {typingPeers.length > 0 && (
        <p className="px-4 pb-1 text-xs text-muted-foreground" aria-live="polite">
          {typingPeers.length === 1
            ? `${typingPeers[0]} is typing…`
            : `${typingPeers.length} people are typing…`}
        </p>
      )}

      {replyTo && (
        <div className="flex items-center gap-2 border-t border-hairline px-3 py-2">
          <CornerUpLeft className="size-3 shrink-0 text-violet" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            Replying to <span className="text-foreground">{replyTo.mine ? "yourself" : replyTo.authorName}</span>
            {" — "}
            {replyTo.body}
          </p>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            aria-label="Cancel reply"
            className="flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-white/10"
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>
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

function SystemNotice({ message }: { message: ChatMessage }) {
  return (
    <p
      data-msg={message.id}
      className="mx-auto w-fit rounded-full bg-white/5 px-3 py-1 text-center text-[11px] text-muted-foreground"
    >
      {message.body}
    </p>
  );
}

function Bubble({
  message,
  grouped,
  repliedTo,
  onReact,
  onReply,
}: {
  message: ChatMessage;
  grouped: boolean;
  repliedTo?: ChatMessage;
  onReact: (id: string, emoji: string) => void;
  onReply: () => void;
}) {
  const [picker, setPicker] = useState(false);
  const time = new Date(message.at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const copy = () => {
    void navigator.clipboard.writeText(message.body).catch(() => {});
  };

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

      <div className={cn("group/msg relative max-w-[78%]", message.mine && "text-right")}>
        {!grouped && (
          <p className="mb-1 text-[11px] text-muted-foreground">
            {message.mine ? "You" : message.authorName}
            <span className="ml-1.5 opacity-60">{time}</span>
          </p>
        )}
        {repliedTo && (
          <div className="mb-1 truncate rounded-lg border-l-2 border-violet/60 bg-white/5 px-2 py-1 text-left text-[11px] text-muted-foreground">
            {repliedTo.authorName}: {repliedTo.body}
          </div>
        )}

        <div
          className={cn(
            "inline-block rounded-2xl px-3 py-2 text-sm break-words text-left",
            message.mine
              ? "rounded-br-md bg-violet/90 text-white"
              : "rounded-bl-md bg-white/8",
            message.failed && "opacity-60 ring-1 ring-danger/50",
          )}
        >
          {message.body}
        </div>

        {/* Hover actions — kept out of the way until the message is targeted. */}
        <div
          className={cn(
            "absolute top-0 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/msg:opacity-100",
            message.mine ? "left-0 -translate-x-full pr-1" : "right-0 translate-x-full pl-1",
          )}
        >
          <button
            type="button"
            onClick={() => setPicker((p) => !p)}
            aria-label="React to message"
            className="flex size-6 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <SmilePlus className="size-3" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onReply}
            aria-label="Reply to message"
            className="flex size-6 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <CornerUpLeft className="size-3" aria-hidden />
          </button>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy message"
            className="flex size-6 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <Copy className="size-3" aria-hidden />
          </button>
        </div>

        {picker && (
          <div className="glass-strong mt-1 inline-flex gap-0.5 rounded-full p-1">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onReact(message.id, emoji);
                  setPicker(false);
                }}
                aria-label={`React ${emoji}`}
                className="flex size-6 items-center justify-center rounded-full text-sm transition-transform hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", message.mine && "justify-end")}>
            {Object.entries(message.reactions).map(([emoji, peers]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(message.id, emoji)}
                className="flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[11px] transition-colors hover:bg-white/20"
              >
                <span>{emoji}</span>
                <span className="tabular-nums text-muted-foreground">{peers.length}</span>
              </button>
            ))}
          </div>
        )}
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
