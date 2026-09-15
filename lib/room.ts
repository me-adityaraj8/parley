/**
 * Room identity helpers.
 *
 * Room IDs double as the access control for a call: anyone with the link can
 * join, nobody without it can. That makes ID entropy a security property,
 * not a cosmetic one — so we use crypto randomness, never Math.random().
 */

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no l/i/o/0/1 — ambiguous when read aloud
const GROUP = 4;
const GROUPS = 3;

/** e.g. "k4mq-7rtz-9wfx" — 15 chars of base-31 ≈ 74 bits of entropy. */
export function generateRoomId(): string {
  const bytes = new Uint8Array(GROUP * GROUPS);
  crypto.getRandomValues(bytes);

  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length] ?? "x");
  const groups: string[] = [];
  for (let i = 0; i < GROUPS; i++) {
    groups.push(chars.slice(i * GROUP, (i + 1) * GROUP).join(""));
  }
  return groups.join("-");
}

const ROOM_RE = new RegExp(`^[${ALPHABET}]{${GROUP}}(-[${ALPHABET}]{${GROUP}}){${GROUPS - 1}}$`);

export function isValidRoomId(id: string): boolean {
  return ROOM_RE.test(id);
}

export function roomUrl(roomId: string): string {
  if (typeof window === "undefined") return `/r/${roomId}`;
  return `${window.location.origin}/r/${roomId}`;
}

/** Stable hue per peer, so a participant's colour never changes mid-call. */
export function hueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export function avatarStyle(id: string): { background: string; color: string } {
  const hue = hueFromId(id);
  return {
    background: `linear-gradient(145deg, oklch(0.55 0.16 ${hue}), oklch(0.38 0.12 ${(hue + 40) % 360}))`,
    color: "oklch(0.98 0 0)",
  };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "?").slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Lightweight id for chat messages — collision risk here is inconsequential. */
export function messageId(): string {
  return crypto.randomUUID();
}

const NAME_KEY = "parley:display-name";

export function loadDisplayName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    // Private browsing and blocked-storage settings throw on access.
    return "";
  }
}

export function saveDisplayName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    /* non-fatal */
  }
}
