"use client";

import { useState } from "react";
import { useAssets } from "@/lib/assets-context";
import { Button } from "./ui/button";

export function DemoResetButton() {
  const { resetDemo } = useAssets();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
        <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
          Reset session demo state?
        </p>
        <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
          Restores seeded assets and clears curator decisions, uploads, and session edits.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="danger"
            className="flex-1 px-2 py-1.5 text-xs"
            onClick={() => {
              resetDemo();
              setConfirming(false);
            }}
          >
            Confirm reset
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1 px-2 py-1.5 text-xs"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full justify-start px-3 py-2 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      onClick={() => setConfirming(true)}
    >
      Reset demo session
    </Button>
  );
}
