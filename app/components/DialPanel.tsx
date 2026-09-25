"use client";

import {
  ControlRenderer,
  DialStore,
  Folder,
  PresetManager,
  type PanelConfig,
} from "dialkit";
import "dialkit/styles.css";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState, useSyncExternalStore } from "react";
import { dialPanelPrefix } from "../lib/dial";

const NO_PANELS: PanelConfig[] = [];

/** A DialKit panel that only shows the controls registered by one artifact. */
export function DialPanel({ artifactId, title }: { artifactId: string | null; title?: string }) {
  const panels = useSyncExternalStore(
    (cb) => DialStore.subscribeGlobal(cb),
    () => DialStore.getPanels("panel"),
    () => NO_PANELS,
  );
  const visible = artifactId
    ? panels.filter((p) => p.id.startsWith(dialPanelPrefix(artifactId)))
    : NO_PANELS;

  return (
    <div className="dialkit-root" data-mode="popover" data-theme="dark">
      <AnimatePresence>
        {visible.length > 0 && (
          <motion.div
            key={artifactId}
            className="dialkit-panel"
            data-position="top-right"
            data-origin-x="right"
            data-origin-y="top"
            data-mode="popover"
            data-multiple={visible.length > 1 ? "true" : undefined}
            initial={{ opacity: 0, x: 12, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 12, scale: 0.98 }}
            transition={{ type: "spring", visualDuration: 0.25, bounce: 0.1 }}
          >
            <div className="dialkit-panel-wrapper">
              {visible.length === 1 ? (
                <PanelFolder panel={visible[0]} isRoot />
              ) : (
                <RootFolder title={title ?? "Controls"}>
                  {visible.map((p) => (
                    <PanelFolder key={p.id} panel={p} />
                  ))}
                </RootFolder>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RootFolder({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Folder title={title} isRoot open={open} onOpenChange={setOpen}>
      {children}
    </Folder>
  );
}

function PanelFolder({ panel, isRoot }: { panel: PanelConfig; isRoot?: boolean }) {
  const subscribe = useCallback((cb: () => void) => DialStore.subscribe(panel.id, cb), [panel.id]);
  const getValues = useCallback(() => DialStore.getValues(panel.id), [panel.id]);
  const values = useSyncExternalStore(subscribe, getValues, getValues);
  const [open, setOpen] = useState(true);

  return (
    <Folder
      title={panel.name}
      isRoot={isRoot}
      open={open}
      onOpenChange={setOpen}
      toolbar={
        <PresetManager
          panelId={panel.id}
          presets={DialStore.getPresets(panel.id)}
          activePresetId={DialStore.getActivePresetId(panel.id)}
        />
      }
    >
      <ControlRenderer panelId={panel.id} controls={panel.controls} values={values} />
    </Folder>
  );
}
