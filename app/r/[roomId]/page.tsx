import { notFound } from "next/navigation";
import { isValidRoomId } from "@/lib/room";
import { RoomClient } from "@/components/room/room-client";
import { BrowserGate } from "@/components/shared/browser-gate";

export const metadata = { title: "Call" };

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  // Reject malformed IDs before mounting any media code — this also stops
  // the signaling server spinning up a party instance for a junk room.
  if (!isValidRoomId(roomId)) notFound();
  return (
    <BrowserGate>
      <RoomClient roomId={roomId} />
    </BrowserGate>
  );
}
