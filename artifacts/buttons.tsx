"use client";

import type { DialConfig, ResolvedValues } from "dialkit";
import { motion } from "motion/react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { toMotion, useArtifactDial } from "@/app/lib/dial";

export const meta = { title: "button-variants", width: 560, height: 440 };

type Variant = "primary" | "secondary" | "outline" | "ghost" | "soft" | "destructive";
type Size = "sm" | "md" | "lg";

const VARIANTS: Variant[] = ["primary", "secondary", "outline", "ghost", "soft", "destructive"];
const SIZE_SCALE: Record<Size, number> = { sm: 0.8, md: 1, lg: 1.2 };

const config = {
  shape: {
    radius: [10, 0, 32],
    height: [40, 28, 64],
    paddingX: [16, 6, 40],
    gap: [8, 0, 20],
  },
  type: {
    fontSize: [14, 10, 22],
    fontWeight: [500, 300, 800, 100],
  },
  color: {
    accent: "#18181b",
    accentText: "#ffffff",
    destructive: "#ef4444",
  },
  effects: {
    shadow: true,
    showIcons: true,
    pressScale: [0.96, 0.8, 1, 0.01],
    press: { type: "spring", visualDuration: 0.25, bounce: 0.4 },
  },
  background: "#ffffff",
} satisfies DialConfig;

type Dial = ResolvedValues<typeof config>;

export default function Buttons() {
  const dial = useArtifactDial("Buttons", config);

  return (
    <div className="flex w-full flex-col gap-4" style={{ background: dial.background }}>
      <Section title="Variants">
        {VARIANTS.map((v) => (
          <Button key={v} variant={v} dial={dial}>
            {v[0].toUpperCase() + v.slice(1)}
          </Button>
        ))}
      </Section>

      <Section title="Sizes">
        {(["sm", "md", "lg"] as Size[]).map((s) => (
          <Button key={s} size={s} dial={dial}>
            Size {s}
          </Button>
        ))}
      </Section>

      <Section title="States">
        <Button dial={dial} disabled>
          Disabled
        </Button>
        <LoadingButton dial={dial} />
        <Button dial={dial} variant="outline" iconOnly aria-label="Add">
          +
        </Button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 font-mono text-[11px] tracking-wide text-zinc-400 uppercase">
        {title}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Button({
  dial,
  variant = "primary",
  size = "md",
  disabled,
  iconOnly,
  onClick,
  children,
  ...rest
}: {
  dial: Dial;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  iconOnly?: boolean;
  onClick?: () => void;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const { shape, type, color, effects } = dial;
  const k = SIZE_SCALE[size];
  const height = shape.height * k;

  const styles: Record<Variant, CSSProperties> = {
    primary: { background: color.accent, color: color.accentText },
    secondary: { background: "#f4f4f5", color: "#18181b" },
    outline: { background: "transparent", color: "#18181b", boxShadow: "inset 0 0 0 1px #e4e4e7" },
    ghost: { background: "transparent", color: "#18181b" },
    soft: {
      background: `color-mix(in oklab, ${color.accent} 12%, transparent)`,
      color: color.accent,
    },
    destructive: { background: color.destructive, color: "#ffffff" },
  };

  const raised = effects.shadow && (variant === "primary" || variant === "destructive");

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: effects.pressScale }}
      transition={toMotion(effects.press)}
      className="inline-flex items-center justify-center whitespace-nowrap transition-[filter,background-color] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        height,
        minWidth: iconOnly ? height : undefined,
        paddingInline: iconOnly ? 0 : shape.paddingX * k,
        gap: shape.gap * k,
        borderRadius: shape.radius * k,
        fontSize: type.fontSize * k,
        fontWeight: type.fontWeight,
        ...styles[variant],
        ...(raised && {
          boxShadow: "0 1px 2px rgb(0 0 0 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.15)",
        }),
      }}
      {...rest}
    >
      {effects.showIcons && !iconOnly && <Dot />}
      {children}
    </motion.button>
  );
}

function LoadingButton({ dial }: { dial: Dial }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      dial={dial}
      variant="secondary"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        setTimeout(() => setLoading(false), 1500);
      }}
    >
      {loading ? <Spinner /> : null}
      {loading ? "Saving…" : "Click to load"}
    </Button>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />;
}

function Spinner() {
  return (
    <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}
