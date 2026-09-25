import type { ComponentType } from "react";
import { artifactModules } from "../../registry";

export type ArtifactMeta = {
  title?: string;
  width?: number;
  height?: number;
};

type ArtifactModule = {
  default?: ComponentType;
  meta?: ArtifactMeta;
};

export type Artifact = {
  id: string;
  title: string;
  width: number;
  height: number;
  Component: ComponentType;
};

const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 480;

// Any `.tsx` file in /artifacts with a default-exported component shows up on the canvas.
export const artifacts: Artifact[] = Object.entries(
  artifactModules as Record<string, ArtifactModule>,
)
  .filter(([, mod]) => typeof mod.default === "function")
  .map(([path, mod]) => {
    const id = path.replace(/^\.\/artifacts\//, "").replace(/\.tsx$/, "");
    return {
      id,
      title: mod.meta?.title ?? id,
      width: mod.meta?.width ?? DEFAULT_WIDTH,
      height: mod.meta?.height ?? DEFAULT_HEIGHT,
      Component: mod.default as ComponentType,
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));
