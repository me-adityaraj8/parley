"use client";

import { useEffect, useRef } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Mic,
  MicOff,
  RefreshCw,
  Signal,
  Video,
  VideoOff,
  Volume2,
  Waves,
} from "lucide-react";
import { useNetworkProbe } from "@/hooks/useNetworkProbe";
import { useSpeakerTest } from "@/hooks/useSpeakerTest";
import { canSelectSpeaker } from "@/lib/media/devices";
import type {
  DeviceInventory,
  DeviceSelection,
  MediaFailure,
  MediaFlags,
  PermissionState,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGSAP } from "@/lib/gsap";
import { fadeUp, scaleIn, useMagnetic } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface LobbyProps {
  roomId: string;
  stream: MediaStream | null;
  permission: PermissionState;
  failure: MediaFailure | null;
  devices: DeviceInventory;
  selection: DeviceSelection;
  flags: MediaFlags;
  level: number;
  name: string;
  joining: boolean;
  onName: (name: string) => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onSelectDevice: (
    kind: "audioInput" | "videoInput" | "audioOutput",
    id: string,
  ) => void;
  onRetry: () => void;
  onJoin: () => void;
}

/**
 * The pre-call lobby.
 *
 * This screen exists for a reason beyond decoration: it is where the browser
 * permission prompt happens. Asking for camera access on a page that already
 * shows a preview frame gives the user context for the prompt, which
 * measurably improves grant rates over prompting on page load.
 */
export function Lobby(props: LobbyProps) {
  const root = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const network = useNetworkProbe();
  const speaker = useSpeakerTest(props.selection.audioOutput);
  const speakerSupported = canSelectSpeaker();
  const joinRef = useMagnetic<HTMLButtonElement>(0.2);

  // Probe connectivity once, as soon as the lab opens.
  useEffect(() => {
    void network.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useGSAP(
    () => {
      scaleIn("[data-preview]", { duration: 0.8, from: 0.96 });
      fadeUp("[data-lobby-item]", { stagger: 0.07, delay: 0.15, duration: 0.6 });
    },
    { scope: root },
  );

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== props.stream) el.srcObject = props.stream;
  }, [props.stream]);

  const blocked = props.permission === "denied";
  const canJoin = props.permission === "granted" && props.name.trim().length > 0;

  return (
    <div
      ref={root}
      className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-4 py-10 lg:flex-row lg:items-stretch lg:gap-10"
    >
      {/* ---------------------------------------------------------- preview */}
      <div
        data-preview
        className="relative aspect-video w-full overflow-hidden rounded-3xl border border-hairline bg-surface bevel lg:flex-1"
      >
        {props.stream && props.flags.video ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="size-full -scale-x-100 object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 text-muted-foreground">
            {blocked ? (
              <AlertTriangle className="size-8 text-danger" aria-hidden />
            ) : (
              <VideoOff className="size-8" aria-hidden />
            )}
            <p className="text-sm">
              {blocked
                ? "Camera blocked"
                : props.permission === "prompting"
                  ? "Waiting for permission…"
                  : "Camera is off"}
            </p>
          </div>
        )}

        {/* Live mic level — proves the microphone works before joining. */}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-4">
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              props.flags.audio ? "bg-white/15" : "bg-danger/25 text-danger",
            )}
            aria-hidden
          >
            {props.flags.audio ? <Mic className="size-4" /> : <MicOff className="size-4" />}
          </span>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"
            role="meter"
            aria-label="Microphone level"
            aria-valuenow={Math.round(props.level * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-live transition-[width] duration-75"
              style={{ width: `${Math.min(100, props.level * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------- controls */}
      <div className="flex w-full flex-col justify-center gap-5 lg:w-80">
        <div data-lobby-item>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Joining room
          </p>
          <p className="mt-1 font-mono text-sm text-violet">{props.roomId}</p>
        </div>

        {props.failure && (
          <div
            data-lobby-item
            role="alert"
            className={cn(
              "rounded-2xl border p-4",
              blocked
                ? "border-danger/40 bg-danger/10"
                : "border-warn/40 bg-warn/10",
            )}
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              {props.failure.title}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {props.failure.detail}
            </p>
            {props.failure.retryable && (
              <button
                type="button"
                onClick={props.onRetry}
                className="mt-3 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs transition-colors hover:bg-white/20"
              >
                <RefreshCw className="size-3" aria-hidden />
                Try again
              </button>
            )}
          </div>
        )}

        <div data-lobby-item>
          <label htmlFor="display-name" className="text-sm text-muted-foreground">
            Your name
          </label>
          <Input
            id="display-name"
            value={props.name}
            onChange={(e) => props.onName(e.target.value)}
            placeholder="Who's joining?"
            maxLength={32}
            className="mt-1.5 h-11 rounded-xl border-hairline bg-white/5"
          />
        </div>

        <div data-lobby-item className="flex items-center gap-2">
          <ToggleButton
            on={props.flags.audio}
            onClick={props.onToggleAudio}
            label={props.flags.audio ? "Mute microphone" : "Unmute microphone"}
          >
            {props.flags.audio ? <Mic className="size-4" /> : <MicOff className="size-4" />}
          </ToggleButton>
          <ToggleButton
            on={props.flags.video}
            onClick={props.onToggleVideo}
            label={props.flags.video ? "Turn camera off" : "Turn camera on"}
          >
            {props.flags.video ? <Video className="size-4" /> : <VideoOff className="size-4" />}
          </ToggleButton>
        </div>

        {/* ------------------------------------------------- device lab */}
        <div data-lobby-item className="space-y-3 rounded-2xl border border-hairline bg-white/[0.03] p-3">
          <LabRow icon={<Camera className="size-3.5" />} label="Camera">
            <DeviceSelect
              label="Camera"
              hideLabel
              options={props.devices.videoInputs}
              value={props.selection.videoInput}
              onChange={(id) => props.onSelectDevice("videoInput", id)}
            />
          </LabRow>

          <LabRow icon={<Waves className="size-3.5" />} label="Microphone">
            <DeviceSelect
              label="Microphone"
              hideLabel
              options={props.devices.audioInputs}
              value={props.selection.audioInput}
              onChange={(id) => props.onSelectDevice("audioInput", id)}
            />
            <div className="mt-1.5 flex items-center gap-2">
              <div
                className="h-1 flex-1 overflow-hidden rounded-full bg-white/10"
                role="meter"
                aria-label="Microphone input level"
                aria-valuenow={Math.round(props.level * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-live transition-[width] duration-75"
                  style={{ width: `${Math.min(100, props.level * 100)}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-[10px] text-muted-foreground">
                {props.level > 0.02 ? "Hearing you" : "Say something"}
              </span>
            </div>
          </LabRow>

          <LabRow icon={<Volume2 className="size-3.5" />} label="Speaker">
            {speakerSupported ? (
              <DeviceSelect
                label="Speaker"
                hideLabel
                options={props.devices.audioOutputs}
                value={props.selection.audioOutput}
                onChange={(id) => props.onSelectDevice("audioOutput", id)}
              />
            ) : (
              <p className="text-[10px] text-muted-foreground">
                This browser does not allow choosing an output device.
              </p>
            )}
            <button
              type="button"
              onClick={() => void speaker.play()}
              className={cn(
                "mt-1.5 rounded-full px-3 py-1 text-[11px] transition-colors",
                speaker.playing ? "bg-live/20 text-live" : "bg-white/10 hover:bg-white/20",
              )}
            >
              {speaker.playing ? "Playing…" : "Play test sound"}
            </button>
          </LabRow>

          <LabRow icon={<Signal className="size-3.5" />} label="Network">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  network.result.grade === "direct" && "bg-live",
                  network.result.grade === "relay" && "bg-warn",
                  network.result.grade === "blocked" && "bg-warn",
                  network.result.grade === "error" && "bg-danger",
                  network.result.grade === "testing" && "animate-pulse bg-violet",
                  network.result.grade === "idle" && "bg-muted-foreground",
                )}
                aria-hidden
              />
              <span className="text-[11px]">{network.result.label}</span>
              {network.result.stunMs > 0 && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {network.result.stunMs} ms
                </span>
              )}
              <button
                type="button"
                onClick={() => void network.run()}
                className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] transition-colors hover:bg-white/20"
              >
                Retest
              </button>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              {network.result.detail}
            </p>
          </LabRow>
        </div>

        <Button
          ref={joinRef}
          data-lobby-item
          type="button"
          size="lg"
          onClick={props.onJoin}
          disabled={!canJoin || props.joining}
          className={cn(
            "group flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium transition-all",
            canJoin && !props.joining
              ? "bg-violet text-white glow-violet hover:brightness-110"
              : "cursor-not-allowed bg-white/5 text-muted-foreground",
          )}
        >
          {props.joining ? (
            <>
              <RefreshCw className="size-4 animate-spin" aria-hidden />
              Connecting…
            </>
          ) : (
            <>
              Join call
              <ArrowRight data-magnet-icon className="size-4" aria-hidden />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ToggleButton({
  on,
  onClick,
  label,
  children,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={!on}
      className={cn(
        "flex size-10 items-center justify-center rounded-full transition-colors",
        on ? "bg-white/5 hover:bg-white/10" : "bg-danger/20 text-danger hover:bg-danger/30",
      )}
    >
      {children}
    </button>
  );
}

function LabRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function DeviceSelect({
  label,
  hideLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  hideLabel?: boolean;
  options: { deviceId: string; label: string }[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const id = `device-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className={cn("text-xs text-muted-foreground", hideLabel && "sr-only")}>
        {label}
      </label>
      <select
        id={id}
        value={value ?? options[0]?.deviceId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={options.length === 0}
        className="w-full rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-violet"
      >
        {options.length === 0 ? (
          <option>No devices found</option>
        ) : (
          options.map((o) => (
            <option key={o.deviceId} value={o.deviceId}>
              {o.label}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
