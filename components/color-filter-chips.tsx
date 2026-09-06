"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Asset } from "@/types";
import { getCurrentVersion } from "@/lib/utils";
import { resolvePublicAssetPath } from "@/lib/base-path";

export type VisualTone =
  | "red"
  | "orange"
  | "amber"
  | "green"
  | "teal"
  | "cyan"
  | "blue"
  | "violet"
  | "magenta"
  | "gray";

export interface ToneSwatch {
  tone: VisualTone;
  label: string;
  hex: string;
}

export const TONE_SWATCHES: ToneSwatch[] = [
  { tone: "red", label: "Red", hex: "#ef4444" },
  { tone: "orange", label: "Orange", hex: "#f97316" },
  { tone: "amber", label: "Amber", hex: "#f59e0b" },
  { tone: "green", label: "Green", hex: "#22c55e" },
  { tone: "teal", label: "Teal", hex: "#14b8a6" },
  { tone: "cyan", label: "Cyan", hex: "#06b6d4" },
  { tone: "blue", label: "Blue", hex: "#3b82f6" },
  { tone: "violet", label: "Violet", hex: "#8b5cf6" },
  { tone: "magenta", label: "Magenta", hex: "#d946ef" },
  { tone: "gray", label: "Gray", hex: "#8b9aab" },
];

const TONE_BY_INDEX: Record<number, VisualTone> = {
  0: "red",
  1: "orange",
  2: "amber",
  3: "green",
  4: "teal",
  5: "cyan",
  6: "blue",
  7: "violet",
  8: "magenta",
};

function classifyTone(r: number, g: number, b: number): VisualTone {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta < 26) return "gray";

  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  const bucket = Math.floor(((hue + 15) % 360) / 30);
  return TONE_BY_INDEX[bucket] ?? "gray";
}

async function sampleDominantTone(url: string, type: Asset["type"]): Promise<VisualTone | null> {
  if (typeof window === "undefined") return null;
  if (type === "audio" || type === "3d" || type === "other") return null;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  try {
    await img.decode();
  } catch {
    return null;
  }

  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(img, 0, 0, size, size);
  } catch {
    return null;
  }

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return null;
  }

  const counts = new Map<VisualTone, number>();
  for (let i = 0; i < data.length; i += 4) {
    const tone = classifyTone(data[i], data[i + 1], data[i + 2]);
    counts.set(tone, (counts.get(tone) ?? 0) + 1);
  }

  let best: VisualTone = "gray";
  let bestCount = 0;
  for (const [tone, count] of counts) {
    if (count > bestCount) {
      best = tone;
      bestCount = count;
    }
  }
  return best;
}

interface ColorFilterChipsProps {
  assets: Asset[];
  selectedTone: VisualTone | null;
  onToneChange: (tone: VisualTone | null) => void;
  onTonesComputed?: (map: ReadonlyMap<string, VisualTone>) => void;
  disabled?: boolean;
}

/**
 * Stage 1.2 — Visual color-filter chips for hybrid search.
 *
 * On mount (and whenever the result set changes) samples each image/video
 * asset's thumbnail through an offscreen canvas to derive its dominant visual
 * tone, then renders a swatch chip per tone. Toggling a chip filters the
 * displayed results by that tone with a framer-motion exit/entry transition.
 */
export function ColorFilterChips({
  assets,
  selectedTone,
  onToneChange,
  onTonesComputed,
  disabled = false,
}: ColorFilterChipsProps) {
  const [tonesByAsset, setTonesByAsset] = useState<Map<string, VisualTone>>(new Map());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function compute() {
      const map = new Map<string, VisualTone>();
      const jobs = assets.map(async (asset) => {
        const version = getCurrentVersion(asset);
        const src = resolvePublicAssetPath(version.thumbnailPath);
        const tone = await sampleDominantTone(src, asset.type);
        if (tone) map.set(asset.id, tone);
      });
      await Promise.all(jobs);
      if (!cancelled) {
        setTonesByAsset(map);
        setReady(true);
        onTonesComputed?.(map);
      }
    }

    void compute();
    return () => {
      cancelled = true;
    };
  }, [assets, onTonesComputed]);

  const available = useMemo<Set<VisualTone>>(() => {
    return new Set(tonesByAsset.values());
  }, [tonesByAsset]);

  const swatches = useMemo(
    () => TONE_SWATCHES.filter((s) => available.has(s.tone)),
    [available],
  );

  if (!ready || swatches.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        Tone
      </span>
      <AnimatePresence>
        {swatches.map((swatch) => {
          const active = selectedTone === swatch.tone;
          return (
            <motion.button
              key={swatch.tone}
              type="button"
              layout
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 380, damping: 24 }}
              onClick={() => onToneChange(active ? null : swatch.tone)}
              disabled={disabled}
              title={`Filter by ${swatch.label} tone`}
              aria-pressed={active}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors duration-[var(--duration-fast)] ${
                active
                  ? "border-accent bg-accent/15 text-foreground"
                  : "border-border bg-surface text-muted hover:border-accent/40 hover:text-foreground"
              }`}
            >
              <span
                className="h-3 w-3 rounded-full border border-black/20"
                style={{ backgroundColor: swatch.hex }}
                aria-hidden="true"
              />
              {swatch.label}
            </motion.button>
          );
        })}
      </AnimatePresence>
      {selectedTone && (
        <button
          type="button"
          onClick={() => onToneChange(null)}
          className="text-xs text-muted underline-offset-2 hover:text-accent hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}