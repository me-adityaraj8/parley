/**
 * Parley signaling Worker.
 *
 * Routes `/parties/main/<roomId>` WebSocket upgrades to a Durable Object
 * instance named after the room. The path shape is deliberately identical to
 * PartyKit's, so the browser client (partysocket) needs no changes.
 */

import { RoomDurableObject } from "./room";

export { RoomDurableObject };

interface Env {
  ROOM: DurableObjectNamespace;
}

const ROUTE = /^\/parties\/([^/]+)\/([^/]+)\/?$/;

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("Parley signaling server — OK", {
        headers: { "content-type": "text/plain" },
      });
    }

    const match = ROUTE.exec(url.pathname);
    if (!match) return new Response("Not found", { status: 404 });

    const [, party, roomId] = match;
    if (party !== "main" || !roomId) {
      return new Response("Not found", { status: 404 });
    }

    // idFromName is deterministic: the same room string always resolves to
    // the same object, in one location, worldwide. That is what makes a
    // room a room.
    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);

    // Pass the room name through so `welcome` can echo it back.
    const forwarded = new URL(request.url);
    forwarded.searchParams.set("_room", roomId);

    return stub.fetch(new Request(forwarded.toString(), request));
  },
};

export default handler;
