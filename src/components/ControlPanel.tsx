"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNews } from "@/lib/news-context";
import { useToast } from "@/components/toast";
import { fetchSettingsPayload, saveSettings } from "@/lib/api";
import { formatDuration, timeAgo } from "@/lib/time";
import type { Region, Settings, SettingsPayload, SourceDef } from "@/lib/types";
import { ProgressRing } from "./ProgressRing";
import { CheckIcon, CloseIcon, SyncIcon, XIcon } from "./icons";
import { PersianMark } from "./LionSunFlag";

const WINDOW_OPTIONS = [6, 12, 24, 48];
const INTERVAL_OPTIONS = [0, 15, 30, 60, 180, 360, 720];

function intervalLabel(min: number) {
  if (min === 0) return "Off";
  if (min < 60) return `${min}m`;
  return `${min / 60}h`;
}

export default function ControlPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, refreshing, progress, liveResults, lastDone, refreshAndNotify, now } = useNews();
  const toast = useToast();

  const [payload, setPayload] = useState<SettingsPayload | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || payload) return;
    fetchSettingsPayload()
      .then((p) => {
        setPayload(p);
        setSaved(p.settings);
        setDraft(p.settings);
      })
      .catch(() => toast("Failed to load settings", "error"));
  }, [open, payload, toast]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      returnFocusRef.current?.focus();
    };
  }, [open, onClose]);

  const dirty = useMemo(() => Boolean(saved && draft && JSON.stringify(draft) !== JSON.stringify(saved)), [saved, draft]);

  const registryByRegion = useMemo(() => {
    const groups: { region: Region; label: string; sources: SourceDef[] }[] = [
      { region: "global", label: "Global sources", sources: [] },
      { region: "persian-diaspora", label: "Persian sources", sources: [] },
      { region: "iran", label: "Iran sources", sources: [] },
    ];
    for (const s of payload?.registry ?? []) groups.find((g) => g.region === s.region)?.sources.push(s);
    return groups;
  }, [payload]);

  const enabledCount = useMemo(() => (draft ? Object.values(draft.sources).filter((s) => s.enabled).length : 0), [draft]);

  const nextSyncAt = useMemo(() => {
    if (!data || !saved?.autoRefreshMinutes) return null;
    return Date.parse(data.generatedAt) + saved.autoRefreshMinutes * 60_000;
  }, [data, saved]);

  const save = useCallback(async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const settings = await saveSettings(draft);
      setSaved(settings);
      setDraft(settings);
      setJustSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setJustSaved(false), 1600);
      toast("Settings saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  }, [draft, saving, toast]);

  const resetDefaults = useCallback(() => {
    if (!payload) return;
    setDraft({
      windowHours: 12,
      autoRefreshMinutes: 180,
      maxItems: 240,
      sources: Object.fromEntries(payload.registry.map((s) => [s.id, { enabled: true }])),
    });
  }, [payload]);

  const ratio = progress.total > 0 ? progress.done / progress.total : undefined;
  const syncPercent = ratio === undefined ? null : Math.round(ratio * 100);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="control-backdrop fixed inset-0 z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="control-panel-title"
            className="control-panel fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
          >
            <div className="control-panel__header flex items-center justify-between px-5 py-4">
              <div>
                <h2 id="control-panel-title" className="control-panel__title">Desk controls</h2>
                <p className="text-xs text-ink-muted">Tune the pulse of your local wire</p>
              </div>
              <button ref={closeRef} type="button" onClick={onClose} aria-label="Close panel" className="btn-icon">
                <CloseIcon />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              <section className="grid grid-cols-2 gap-2">
                <Stat label="Last sync" value={data ? timeAgo(data.generatedAt, now) : "—"} />
                <Stat
                  label="Next auto-sync"
                  value={saved?.autoRefreshMinutes ? (nextSyncAt ? (nextSyncAt > now ? formatDuration(nextSyncAt - now) : "due now") : "—") : "off"}
                />
                <Stat label="Stories" value={data ? String(data.itemCount) : "—"} />
                <Stat label="Window" value={`${saved?.windowHours ?? data?.windowHours ?? 12}h`} />
              </section>

              <section className={`control-sync ${refreshing ? "control-sync--active" : ""}`}>
                <div className="control-sync__glow" aria-hidden />
                <div className="control-sync__top">
                  <p className="control-sync__eyebrow">
                    <span className="control-sync__beacon" aria-hidden />
                    Wire refresh
                  </p>
                  <span className="control-sync__state">{refreshing ? "In progress" : "Ready"}</span>
                </div>

                <motion.button
                  whileHover={refreshing ? {} : { y: -2 }}
                  whileTap={refreshing ? {} : { scale: 0.985 }}
                  onClick={() => void refreshAndNotify()}
                  disabled={refreshing}
                  aria-label="Sync news now"
                  className="control-sync__action disabled:cursor-wait"
                >
                  <span className="control-sync__dial" aria-hidden>
                    {refreshing && (
                      <motion.span
                        className="control-sync__pulse"
                        animate={{ scale: [1, 1.28], opacity: [0.65, 0] }}
                        transition={{ repeat: Infinity, duration: 1.45, ease: "easeOut" }}
                      />
                    )}
                    <ProgressRing size={76} stroke={3.5} progress={ratio} spinning={refreshing && ratio === undefined} className="control-sync__ring" />
                    <SyncIcon size={22} className={refreshing ? "animate-spin" : ""} />
                  </span>
                  <span className="control-sync__copy">
                    <strong>{refreshing ? (progress.total ? `Scanning ${progress.done} of ${progress.total} sources` : "Contacting your sources") : "Sync the wire"}</strong>
                    <span>
                      {refreshing
                        ? syncPercent === null ? "Establishing the live feed..." : `${syncPercent}% complete - fresh results will appear here.`
                        : lastDone
                          ? `${lastDone.itemCount} stories found in ${(lastDone.ms / 1000).toFixed(1)} seconds.`
                          : "Fetch every enabled source and rebuild the latest briefing."}
                    </span>
                  </span>
                  <span className="control-sync__trigger">{refreshing ? (syncPercent === null ? "..." : `${syncPercent}%`) : "Run"}</span>
                </motion.button>

                <div className="control-sync__facts" aria-label="Sync details">
                  <div>
                    <span>Listening to</span>
                    <strong>{enabledCount || "—"} sources</strong>
                  </div>
                  <div>
                    <span>Last pulse</span>
                    <strong>{data ? timeAgo(data.generatedAt, now) : "Not yet synced"}</strong>
                  </div>
                </div>

                {(refreshing || liveResults.length > 0) && (
                  <div className="control-sync__results" aria-live="polite">
                    <AnimatePresence initial={false}>
                      {liveResults.map((s) => (
                        <motion.div
                          key={s.id}
                          layout
                          initial={{ opacity: 0, x: 18 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        className="control-live-result flex items-center gap-2 px-2.5 py-1.5 text-xs"
                        >
                          <span aria-hidden>{s.flag}</span>
                          <span dir="auto" className="truncate font-medium">{s.name}</span>
                          {s.ok ? (
                            <span className="ml-auto flex shrink-0 items-center gap-1.5 text-ok">
                              <AnimatedCheck /> {s.count} · {s.ms}ms
                            </span>
                          ) : (
                            <span className="ml-auto flex shrink-0 items-center gap-1 text-bad" title={s.error}>
                              <XIcon /> offline
                            </span>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {refreshing && liveResults.length === 0 && <p className="control-sync__waiting animate-pulse">Waiting for the first response...</p>}
                  </div>
                )}
              </section>

              <section className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="control-panel__section-title">Update system</h3>
                  {dirty && (
                    <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1.5 text-xs text-warn">
                      <span className="h-1.5 w-1.5 rounded-full bg-warn" /> unsaved changes
                    </motion.span>
                  )}
                </div>

                <SettingRow label="Time window" hint="Only stories newer than this are kept">
                  <Segmented
                    id="window"
                    options={WINDOW_OPTIONS}
                    value={draft?.windowHours ?? 12}
                    onChange={(v) => setDraft((d) => d && { ...d, windowHours: v })}
                    format={(v) => `${v}h`}
                  />
                </SettingRow>

                <SettingRow label="Auto-sync" hint="Background refresh while the server runs">
                  <Segmented
                    id="interval"
                    options={INTERVAL_OPTIONS}
                    value={draft?.autoRefreshMinutes ?? 180}
                    onChange={(v) => setDraft((d) => d && { ...d, autoRefreshMinutes: v })}
                    format={intervalLabel}
                  />
                </SettingRow>

                <SettingRow label="Sources" hint={`${enabledCount}/${payload?.registry.length ?? 0} enabled`}>
                  <div className="control-source-list max-h-64 space-y-3 overflow-y-auto p-3">
                    {!payload && <p className="animate-pulse text-xs text-ink-muted">Loading…</p>}
                    {registryByRegion.map((group) => (
                      <div key={group.region}>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                          {group.region === "persian-diaspora" ? <PersianMark size={13}>{group.label}</PersianMark> : group.label}
                        </p>
                        <ul className="space-y-1">
                          {group.sources.map((s) => {
                            const checked = draft?.sources[s.id]?.enabled ?? true;
                            return (
                              <li key={s.id} className="flex items-center gap-2 py-0.5">
                                <span aria-hidden>{s.flag}</span>
                                <span dir="auto" className={`source-setting__name text-sm ${checked ? "" : "text-ink-muted line-through"}`}>{s.name}</span>
                                <span className="source-setting__country">{s.country}</span>
                                <span className="ml-auto">
                                  <Switch
                                    checked={checked}
                                    label={`Toggle ${s.name}`}
                                    onChange={(v) =>
                                      setDraft((d) => d && { ...d, sources: { ...d.sources, [s.id]: { enabled: v } } })
                                    }
                                  />
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </SettingRow>

                <div className="flex items-center gap-2 pt-1">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => void save()}
                    disabled={!dirty || saving || !draft}
                    className="btn control-primary h-9 flex-1 disabled:opacity-50"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {justSaved ? (
                        <motion.span key="saved" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center gap-1.5">
                          <CheckIcon /> Saved
                        </motion.span>
                      ) : (
                        <motion.span key="save" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                          {saving ? "Saving…" : "Save settings"}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={resetDefaults} disabled={!payload || saving} className="btn h-9 disabled:opacity-50">
                    Reset
                  </motion.button>
                </div>
                <p className="text-[11px] leading-relaxed text-ink-muted">
                  Settings apply from the next sync and persist in <code className="font-mono">data/settings.json</code>. The build step and the
                  scheduler honor the same file.
                </p>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="control-stat px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        {hint && <span className="truncate text-[11px] text-ink-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends number>({
  id,
  options,
  value,
  onChange,
  format,
}: {
  id: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
}) {
  return (
    <div className="flex border border-line bg-canvas-subtle p-0.5" role="radiogroup" aria-label={id}>
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option)}
            className={`relative flex-1 px-2 py-1 text-xs font-medium transition-colors ${active ? "text-ink" : "text-ink-muted hover:text-ink"}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 border border-ink bg-surface-raised"
                transition={{ type: "spring", stiffness: 450, damping: 34 }}
              />
            )}
            <span className="relative z-10">{format(option)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 transition-colors duration-200 ${checked ? "bg-accent-emphasis" : "bg-line"}`}
    >
      <motion.span
        className="absolute left-0.5 top-0.5 h-5 w-5 bg-surface-raised"
        animate={{ x: checked ? 16 : 0 }}
        transition={{ type: "spring", stiffness: 550, damping: 33 }}
      />
    </button>
  );
}

function AnimatedCheck() {
  return (
    <motion.svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
      <motion.path
        d="M2.5 8.5 6 12l7.5-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />
    </motion.svg>
  );
}
