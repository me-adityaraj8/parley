"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Push-to-talk on the space bar.
 *
 * The microphone is unmuted while held and returns to its PREVIOUS state on
 * release — so if you were already unmuted, letting go does not mute you.
 *
 * Space is also the browser's "activate focused control" key, so we ignore
 * the event whenever focus is in a text field or on a button; otherwise
 * typing a space in chat would broadcast your microphone.
 */
export function usePushToTalk({
  enabled,
  micOn,
  setMic,
}: {
  enabled: boolean;
  micOn: boolean;
  setMic: (on: boolean) => void;
}) {
  const [active, setActive] = useState(false);
  const previous = useRef(micOn);
  const held = useRef(false);
  const micRef = useRef(micOn);
  micRef.current = micOn;

  useEffect(() => {
    if (!enabled) {
      if (held.current) {
        held.current = false;
        setActive(false);
      }
      return;
    }

    const isTypingTarget = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "BUTTON" ||
        node.isContentEditable ||
        node.getAttribute?.("role") === "textbox"
      );
    };

    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      if (held.current) return;
      held.current = true;
      previous.current = micRef.current;
      setActive(true);
      if (!micRef.current) setMic(true);
    };

    const onUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !held.current) return;
      held.current = false;
      setActive(false);
      if (!previous.current) setMic(false);
    };

    // If the window loses focus mid-hold we never receive keyup — restore.
    const onBlur = () => {
      if (!held.current) return;
      held.current = false;
      setActive(false);
      if (!previous.current) setMic(false);
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, setMic]);

  return { active };
}
