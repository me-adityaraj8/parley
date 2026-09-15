"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LinkState, Participant, PanelId } from "@/types";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useScreenShare } from "@/hooks/useScreenShare";
import { useChat } from "@/hooks/useChat";
import { useGSAP } from "@/lib/gsap";
import { stageEnter } from "@/lib/animations";
import { loadDisplayName, saveDisplayName } from "@/lib/room";
import { AmbientBackground } from "@/components/shared/ambient-background";
import { Lobby } from "./lobby";
import { WaitingState } from "./waiting-state";
import { RoomFull } from "./room-full";
import { VideoGrid } from "@/components/call/video-grid";
import { ControlDock } from "@/components/call/control-dock";
import { RoomHeader } from "@/components/call/room-header";
import { ParticipantsPanel } from "@/components/call/participants-panel";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ShareBanner } from "@/components/call/share-banner";

export function RoomClient({ roomId }: { roomId: string }) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);

  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [panel, setPanel] = useState<PanelId>(null);

  const media = useLocalMedia();
  const { level, speaking: selfSpeaking } = useAudioLevel(
    media.stream,
    media.flags.audio,
  );

  // Chat needs `broadcast` from useWebRTC, and useWebRTC needs chat's
  // receiver. A ref breaks the cycle without restructuring either hook.
  const chatReceiveRef = useRef<
    ((from: string, n: string, m: never) => void) | null
  >(null);

  const rtc = useWebRTC({
    roomId,
    displayName: name || "Guest",
    localStream: media.stream,
    localFlags: media.flags,
    enabled: joined,
    onData: (from, peerName, msg) => {
      chatReceiveRef.current?.(from, peerName, msg as never);
    },
  });

  const screen = useScreenShare({
    localStream: media.stream,
    replaceVideoTrack: rtc.replaceVideoTrack,
  });

  const chat = useChat({
    selfId: rtc.selfId,
    selfName: name || "Guest",
    broadcast: rtc.broadcast,
  });
  chatReceiveRef.current = chat.receive as never;

  // Load a remembered name once on mount.
  useEffect(() => {
    setName(loadDisplayName());
  }, []);

  // Request camera access as soon as the lobby mounts.
  useEffect(() => {
    void media.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep peers informed that we are (or are not) sharing a screen.
  useEffect(() => {
    if (!joined) return;
    rtc.send({
      t: "media",
      media: { ...media.flags, screen: screen.sharing },
    });
    rtc.broadcast({
      t: "media",
      media: { ...media.flags, screen: screen.sharing },
    });
  }, [screen.sharing, joined]); // eslint-disable-line react-hooks/exhaustive-deps

  // Must be an effect, not a render-phase call: setPanelOpen updates state,
  // and calling it during render puts React into an infinite render loop.
  useEffect(() => {
    chat.setPanelOpen(panel === "chat");
  }, [panel, chat.setPanelOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------ participants

  const localParticipant = useMemo<Participant>(
    () => ({
      id: rtc.selfId ?? "local",
      name: name || "Guest",
      isLocal: true,
      // While sharing, the local tile shows the screen so you can see what
      // others see — a common source of "am I sharing the right window?".
      stream: screen.sharing ? screen.screenStream : media.stream,
      media: { ...media.flags, screen: screen.sharing },
      link: "connected" as LinkState,
      speaking: selfSpeaking && media.flags.audio,
    }),
    [
      rtc.selfId,
      name,
      media.stream,
      media.flags,
      screen.sharing,
      screen.screenStream,
      selfSpeaking,
    ],
  );

  const participants = useMemo(
    () => [localParticipant, ...rtc.participants],
    [localParticipant, rtc.participants],
  );

  const sharer = participants.find((p) => p.media.screen) ?? null;

  const worstLink = useMemo<LinkState>(() => {
    const order: LinkState[] = [
      "failed",
      "reconnecting",
      "connecting",
      "new",
      "connected",
      "closed",
    ];
    for (const state of order) {
      if (rtc.participants.some((p) => p.link === state)) return state;
    }
    return "connected";
  }, [rtc.participants]);

  // ---------------------------------------------------------------- actions

  const handleJoin = useCallback(() => {
    saveDisplayName(name.trim());
    setJoined(true);
  }, [name]);

  const handleLeave = useCallback(() => {
    media.stop();
    router.push("/");
  }, [media, router]);

  // Keyboard shortcuts. Skipped while typing so "m" in a chat message does
  // not mute the microphone.
  useEffect(() => {
    if (!joined) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "m":
          media.toggleAudio();
          break;
        case "v":
          media.toggleVideo();
          break;
        case "s":
          screen.toggle();
          break;
        case "c":
          setPanel((p) => (p === "chat" ? null : "chat"));
          break;
        case "p":
          setPanel((p) => (p === "participants" ? null : "participants"));
          break;
        case "escape":
          setPanel(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [joined, media, screen]);

  useGSAP(
    () => {
      if (joined && stageRef.current) stageEnter(stageRef.current);
    },
    { dependencies: [joined] },
  );

  // ----------------------------------------------------------------- render

  if (rtc.roomFull) return <RoomFull />;

  if (!joined) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center">
        <AmbientBackground />
        <Lobby
          roomId={roomId}
          stream={media.stream}
          permission={media.permission}
          failure={media.failure}
          devices={media.devices}
          selection={media.selection}
          flags={media.flags}
          level={level}
          name={name}
          joining={false}
          onName={setName}
          onToggleAudio={() => media.toggleAudio()}
          onToggleVideo={() => media.toggleVideo()}
          onSelectDevice={media.selectDevice}
          onRetry={() => void media.retry()}
          onJoin={handleJoin}
        />
      </main>
    );
  }

  const alone = participants.length <= 1;

  return (
    <main
      ref={stageRef}
      className="relative flex h-dvh flex-col overflow-hidden"
    >
      <AmbientBackground />

      <RoomHeader
        roomId={roomId}
        participantCount={participants.length}
        signaling={rtc.signalingStatus}
        worstLink={worstLink}
      />

      {screen.sharing && <ShareBanner onStop={() => void screen.stop()} />}

      <div className="flex min-h-0 flex-1 gap-3 p-3 sm:px-5">
        <div className="min-w-0 flex-1">
          {alone ? (
            <WaitingState roomId={roomId} local={localParticipant} />
          ) : (
            <VideoGrid
              participants={participants}
              localId={localParticipant.id}
              stageId={sharer?.id ?? null}
            />
          )}
        </div>

        {panel !== null && (
          <div className="absolute inset-0 z-20 p-3 sm:relative sm:inset-auto sm:z-auto sm:w-80 sm:p-0">
            {panel === "chat" ? (
              <ChatPanel
                open
                messages={chat.messages}
                typingPeers={chat.typingPeers}
                onSend={chat.send}
                onTyping={chat.sendTyping}
                onClose={() => setPanel(null)}
              />
            ) : (
              <ParticipantsPanel
                open
                participants={participants}
                onClose={() => setPanel(null)}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex justify-center px-3 pb-3">
        <ControlDock
          audio={media.flags.audio}
          video={media.flags.video}
          sharing={screen.sharing}
          screenShareSupported={screen.supported}
          panel={panel}
          unreadCount={chat.unread}
          participantCount={participants.length}
          onToggleAudio={() => media.toggleAudio()}
          onToggleVideo={() => media.toggleVideo()}
          onToggleShare={screen.toggle}
          onPanel={setPanel}
          onLeave={handleLeave}
        />
      </div>
    </main>
  );
}
