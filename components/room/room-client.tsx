"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DataMessage, LinkState, Participant, PanelId, PeerId } from "@/types";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { useActiveSpeakers } from "@/hooks/useActiveSpeakers";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useScreenShare } from "@/hooks/useScreenShare";
import { useChat } from "@/hooks/useChat";
import { useCallStats } from "@/hooks/useCallStats";
import { useFileTransfer } from "@/hooks/useFileTransfer";
import { useWhiteboard } from "@/hooks/useWhiteboard";
import { useReactions } from "@/hooks/useReactions";
import { useRecording } from "@/hooks/useRecording";
import { usePushToTalk } from "@/hooks/usePushToTalk";
import { useGSAP } from "@/lib/gsap";
import { stageEnter } from "@/lib/animations";
import { loadDisplayName, saveDisplayName } from "@/lib/room";
import { AmbientBackground } from "@/components/shared/ambient-background";
import { Lobby } from "./lobby";
import { WaitingState } from "./waiting-state";
import { RoomFull } from "./room-full";
import { InviteDialog } from "./invite-dialog";
import { VideoGrid } from "@/components/call/video-grid";
import { ControlDock } from "@/components/call/control-dock";
import { RoomHeader } from "@/components/call/room-header";
import { ParticipantsPanel } from "@/components/call/participants-panel";
import { ReactionsLayer } from "@/components/call/reactions-layer";
import { RecordingIndicator } from "@/components/call/recording-indicator";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ShareBanner } from "@/components/call/share-banner";
import { DiagnosticsPanel } from "@/components/diagnostics/diagnostics-panel";
import { FilePanel } from "@/components/files/file-panel";
import { Whiteboard } from "@/components/whiteboard/whiteboard";

export function RoomClient({ roomId }: { roomId: string }) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);

  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");
  const [panel, setPanel] = useState<PanelId>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [spotlightId, setSpotlightId] = useState<PeerId | null>(null);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pttEnabled, setPttEnabled] = useState(false);
  const [volumes, setVolumes] = useState<Record<PeerId, number>>({});

  const media = useLocalMedia();
  const { level, speaking: selfSpeaking } = useAudioLevel(media.stream, media.flags.audio);

  /**
   * Screen sharing must be created AFTER useWebRTC (it needs replaceVideoTrack),
   * but useWebRTC needs the screen flag. This lifted state breaks the cycle so
   * exactly one place decides what `screen` is.
   */
  const [sharingFlag, setSharingFlag] = useState(false);
  const combinedFlags = useMemo(
    () => ({ ...media.flags, screen: sharingFlag }),
    [media.flags, sharingFlag],
  );

  // Feature hooks need `broadcast` from useWebRTC, and useWebRTC needs their
  // receivers. Refs break the cycle without restructuring either side.
  const routeDataRef = useRef<((from: PeerId, n: string, m: DataMessage) => void) | null>(null);
  const routeBulkRef = useRef<((from: PeerId, frame: ArrayBuffer) => void) | null>(null);
  const presenceRef = useRef<((e: "join" | "leave", n: string) => void) | null>(null);

  const rtc = useWebRTC({
    roomId,
    displayName: name || "Guest",
    localStream: media.stream,
    localFlags: combinedFlags,
    enabled: joined,
    onData: (from, peerName, msg) => routeDataRef.current?.(from, peerName, msg),
    onBulk: (from, frame) => routeBulkRef.current?.(from, frame),
    onPresence: (event, peerName) => presenceRef.current?.(event, peerName),
  });

  const screen = useScreenShare({
    localStream: media.stream,
    replaceVideoTrack: rtc.replaceVideoTrack,
  });

  useEffect(() => {
    setSharingFlag(screen.sharing);
  }, [screen.sharing]);

  const chat = useChat({
    selfId: rtc.selfId,
    selfName: name || "Guest",
    broadcast: rtc.broadcast,
  });

  const reactions = useReactions({
    selfId: rtc.selfId,
    selfName: name || "Guest",
    broadcast: rtc.broadcast,
  });

  const whiteboard = useWhiteboard({ selfId: rtc.selfId, broadcast: rtc.broadcast });

  const files = useFileTransfer({
    selfId: rtc.selfId,
    peers: rtc.participants.map((p) => ({ id: p.id, name: p.name })),
    sendTo: rtc.sendTo,
    sendBulkTo: rtc.sendBulkTo,
  });

  const stats = useCallStats({
    getConnections: rtc.getConnections,
    enabled: joined && panel === "diagnostics",
  });

  const recording = useRecording(media.stream);

  const setMic = useCallback((on: boolean) => media.toggleAudio(on), [media]);
  const ptt = usePushToTalk({ enabled: pttEnabled && joined, micOn: media.flags.audio, setMic });

  // ------------------------------------------------- data channel routing

  /**
   * One router for every control message. Keeping this in a single place
   * means there is exactly one `switch` over the wire protocol, rather than
   * each feature hook subscribing independently.
   */
  routeDataRef.current = useCallback(
    (from: PeerId, peerName: string, msg: DataMessage) => {
      switch (msg.t) {
        case "chat":
        case "chat-react":
        case "typing":
          chat.receive(from, peerName, msg);
          return;
        case "reaction":
          reactions.receive(from, peerName, msg.emoji);
          return;
        case "wb":
          whiteboard.receive(from, msg.op);
          return;
        case "file-offer":
        case "file-done":
        case "file-cancel":
          files.onControl(from, peerName, msg);
          return;
        default:
          return;
      }
    },
    [chat, reactions, whiteboard, files],
  );

  routeBulkRef.current = files.onBulk;

  presenceRef.current = useCallback(
    (event: "join" | "leave", peerName: string) => {
      chat.systemNotice(`${peerName} ${event === "join" ? "joined" : "left"}`);
    },
    [chat],
  );

  // System notices for our own screen share, so the log reads naturally.
  const prevSharing = useRef(false);
  useEffect(() => {
    if (!joined) return;
    if (screen.sharing !== prevSharing.current) {
      prevSharing.current = screen.sharing;
      chat.systemNotice(
        screen.sharing ? "You started screen sharing" : "You stopped screen sharing",
      );
    }
  }, [screen.sharing, joined, chat]);

  const remoteSharers = rtc.participants.filter((p) => p.media.screen).map((p) => p.id).join(",");
  const prevSharers = useRef("");
  useEffect(() => {
    if (!joined) return;
    const before = new Set(prevSharers.current.split(",").filter(Boolean));
    const now = new Set(remoteSharers.split(",").filter(Boolean));
    for (const id of now) {
      if (!before.has(id)) {
        const p = rtc.participants.find((x) => x.id === id);
        if (p) chat.systemNotice(`${p.name} started screen sharing`);
      }
    }
    prevSharers.current = remoteSharers;
  }, [remoteSharers, joined, rtc.participants, chat]);

  // ---------------------------------------------------------- lifecycle

  useEffect(() => setName(loadDisplayName()), []);
  useEffect(() => {
    void media.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chat.setPanelOpen(panel === "chat");
  }, [panel, chat.setPanelOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------- participants

  const remoteSignals = useActiveSpeakers(rtc.participants);

  const localParticipant = useMemo<Participant>(
    () => ({
      id: rtc.selfId ?? "local",
      name: name || "Guest",
      isLocal: true,
      stream: screen.sharing ? screen.screenStream : media.stream,
      media: { ...media.flags, screen: screen.sharing },
      link: "connected" as LinkState,
      speaking: selfSpeaking && media.flags.audio,
      level: media.flags.audio ? level : 0,
      handRaised,
      volume: 1,
    }),
    [
      rtc.selfId,
      name,
      media.stream,
      media.flags,
      screen.sharing,
      screen.screenStream,
      selfSpeaking,
      level,
      handRaised,
    ],
  );

  const participants = useMemo(
    () => [
      localParticipant,
      ...rtc.participants.map((p) => ({
        ...p,
        speaking: Boolean(remoteSignals[p.id]?.speaking) && p.media.audio,
        level: p.media.audio ? (remoteSignals[p.id]?.level ?? 0) : 0,
        volume: volumes[p.id] ?? 1,
      })),
    ],
    [localParticipant, rtc.participants, remoteSignals, volumes],
  );

  /** Screen share always wins the stage; otherwise honour the spotlight. */
  const sharer = participants.find((p) => p.media.screen) ?? null;
  const stageId = sharer?.id ?? spotlightId;

  const worstLink = useMemo<LinkState>(() => {
    const order: LinkState[] = ["failed", "reconnecting", "connecting", "new", "connected", "closed"];
    for (const state of order) {
      if (rtc.participants.some((p) => p.link === state)) return state;
    }
    return "connected";
  }, [rtc.participants]);

  // ------------------------------------------------------------ actions

  const toggleHand = useCallback(() => {
    setHandRaised((up) => {
      const next = !up;
      rtc.broadcast({ t: "hand", up: next });
      return next;
    });
  }, [rtc]);

  const setVolume = useCallback((id: PeerId, volume: number) => {
    setVolumes((prev) => ({ ...prev, [id]: volume }));
  }, []);

  const handleJoin = useCallback(() => {
    saveDisplayName(name.trim());
    setJoined(true);
  }, [name]);

  const handleLeave = useCallback(() => {
    if (recording.state === "recording" || recording.state === "paused") recording.stop();
    media.stop();
    router.push("/");
  }, [media, router, recording]);

  const handleRecord = useCallback(() => {
    if (recording.state === "recording" || recording.state === "paused") recording.stop();
    else recording.start();
  }, [recording]);

  // Keyboard shortcuts, skipped while typing.
  useEffect(() => {
    if (!joined) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "m": media.toggleAudio(); break;
        case "v": media.toggleVideo(); break;
        case "s": screen.toggle(); break;
        case "h": toggleHand(); break;
        case "c": setPanel((p) => (p === "chat" ? null : "chat")); break;
        case "p": setPanel((p) => (p === "participants" ? null : "participants")); break;
        case "d": setPanel((p) => (p === "diagnostics" ? null : "diagnostics")); break;
        case "escape":
          setPanel(null);
          setWhiteboardOpen(false);
          setInviteOpen(false);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [joined, media, screen, toggleHand]);

  useGSAP(
    () => {
      if (joined && stageRef.current) stageEnter(stageRef.current);
    },
    { dependencies: [joined] },
  );

  // ------------------------------------------------------------- render

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
    <main ref={stageRef} className="relative flex h-dvh flex-col overflow-hidden">
      <AmbientBackground />

      <RoomHeader
        roomId={roomId}
        participantCount={participants.length}
        signaling={rtc.signalingStatus}
        worstLink={worstLink}
      />

      {screen.sharing && <ShareBanner onStop={() => void screen.stop()} />}

      <RecordingIndicator
        state={recording.state}
        elapsed={recording.elapsed}
        url={recording.url}
        onPause={recording.pause}
        onResume={recording.resume}
        onStop={recording.stop}
        onDismiss={recording.reset}
      />

      {ptt.active && (
        <div className="flex justify-center px-3 pt-2">
          <span className="glass flex items-center gap-2 rounded-full border-live/40 px-3 py-1 text-xs text-live">
            <span className="size-1.5 animate-pulse rounded-full bg-live" aria-hidden />
            Push to talk — microphone live
          </span>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 gap-3 p-3 sm:px-5">
        <div className="min-w-0 flex-1">
          {alone && !whiteboardOpen ? (
            <WaitingState roomId={roomId} local={localParticipant} />
          ) : (
            <VideoGrid
              participants={participants}
              localId={localParticipant.id}
              stageId={stageId}
              onSpotlight={setSpotlightId}
              onVolume={setVolume}
            />
          )}
        </div>

        {whiteboardOpen && (
          <Whiteboard
            strokes={whiteboard.strokes}
            notes={whiteboard.notes}
            version={whiteboard.version}
            onBegin={whiteboard.beginStroke}
            onExtend={whiteboard.extendStroke}
            onEnd={whiteboard.endStroke}
            onText={whiteboard.addText}
            onUndo={whiteboard.undo}
            onClear={whiteboard.clear}
            onClose={() => setWhiteboardOpen(false)}
          />
        )}

        {panel !== null && (
          <div className="absolute inset-0 z-20 p-3 sm:relative sm:inset-auto sm:z-auto sm:w-80 sm:p-0">
            {panel === "chat" && (
              <ChatPanel
                open
                messages={chat.messages}
                typingPeers={chat.typingPeers}
                onSend={chat.send}
                onTyping={chat.sendTyping}
                onReact={chat.toggleReaction}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === "participants" && (
              <ParticipantsPanel
                open
                participants={participants}
                spotlightId={spotlightId}
                onSpotlight={setSpotlightId}
                onVolume={setVolume}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === "files" && (
              <FilePanel
                transfers={files.transfers}
                canSend={rtc.participants.length > 0}
                onSend={(f) => void files.sendFiles(f)}
                onCancel={files.cancel}
                onDismiss={files.dismiss}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === "diagnostics" && (
              <DiagnosticsPanel stats={stats} onClose={() => setPanel(null)} />
            )}
          </div>
        )}

        <ReactionsLayer reactions={reactions.floating} />
      </div>

      <div className="flex justify-center px-3 pb-3">
        <ControlDock
          audio={media.flags.audio}
          video={media.flags.video}
          sharing={screen.sharing}
          screenShareSupported={screen.supported}
          handRaised={handRaised}
          whiteboardOpen={whiteboardOpen}
          recording={recording.state === "recording" || recording.state === "paused"}
          pushToTalk={pttEnabled}
          panel={panel}
          unreadCount={chat.unread}
          participantCount={participants.length}
          activeTransfers={files.active}
          onToggleAudio={() => media.toggleAudio()}
          onToggleVideo={() => media.toggleVideo()}
          onToggleShare={screen.toggle}
          onToggleHand={toggleHand}
          onToggleWhiteboard={() => setWhiteboardOpen((w) => !w)}
          onTogglePushToTalk={() => setPttEnabled((p) => !p)}
          onReact={reactions.react}
          onPanel={setPanel}
          onRecord={handleRecord}
          onInvite={() => setInviteOpen(true)}
          onLeave={handleLeave}
        />
      </div>

      {inviteOpen && <InviteDialog roomId={roomId} onClose={() => setInviteOpen(false)} />}
    </main>
  );
}
