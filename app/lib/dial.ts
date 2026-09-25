"use client";

import { createContext, useContext } from "react";
import {
  useDialKit,
  type DialConfig,
  type TransitionConfig,
  type UseDialOptions,
} from "dialkit";
import type { Transition } from "motion/react";

export const ArtifactContext = createContext<string | null>(null);

export const dialPanelPrefix = (artifactId: string) => `${artifactId}::`;

/**
 * `useDialKit` scoped to the artifact it's rendered in, so the canvas can show
 * only the selected artifact's controls. Values persist across reloads by default.
 */
export function useArtifactDial<T extends DialConfig>(
  name: string,
  config: T,
  options?: UseDialOptions,
) {
  const artifactId = useContext(ArtifactContext) ?? "unknown";
  return useDialKit(name, config, {
    persist: true,
    ...options,
    id: dialPanelPrefix(artifactId) + (options?.id ?? name),
  });
}

/** Convert a DialKit spring/easing value into a Motion transition. */
export function toMotion(t: TransitionConfig): Transition {
  return t.type === "easing" ? { duration: t.duration, ease: t.ease } : t;
}
