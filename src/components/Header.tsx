"use client";

import { useEffect, useState } from "react";
import { useNews } from "@/lib/news-context";
import { timeAgo } from "@/lib/time";
import { ProgressRing } from "./ProgressRing";
import { MoonIcon, SlidersIcon, SunIcon, SyncIcon } from "./icons";

export default function Header({ onOpenConsole }: { onOpenConsole: () => void }) {
  const { data, refreshing, progress, refreshAndNotify, now } = useNews();
  const ratio = progress.total > 0 ? progress.done / progress.total : undefined;

  return (
    <header className="site-header">
      <div className="masthead mx-auto w-full max-w-[1180px] px-4 sm:px-0">
        <span aria-hidden className="brand-sigil" />
        <div className="min-w-0 leading-none">
          <p className="brand-kicker">A local intelligence reader</p>
          <h1 className="brand-name mt-1">Signal Desk</h1>
        </div>
        {data ? <p className="header-sync ml-auto hidden sm:block">LAST PULSE {timeAgo(data.generatedAt, now).toUpperCase()}</p> : <span className="ml-auto" />}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshAndNotify()}
            disabled={refreshing}
            aria-label="Sync news now"
            title="Sync now (R)"
            className="command-button command-button--accent command-button--icon"
          >
            {refreshing ? <ProgressRing size={16} stroke={2} spinning={ratio === undefined} progress={ratio} /> : <SyncIcon />}
          </button>
          <button type="button" onClick={onOpenConsole} className="command-button hidden sm:inline-flex">
            <SlidersIcon /> Desk controls
          </button>
          <button type="button" onClick={onOpenConsole} aria-label="Open desk controls" className="command-button command-button--icon sm:hidden">
            <SlidersIcon />
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch { /* Private browsing can reject storage access. */ }
    setDark(next);
  };

  return (
    <button type="button" onClick={toggle} aria-label="Toggle color theme" title={dark ? "Switch to light" : "Switch to dark"} className="command-button command-button--icon">
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
