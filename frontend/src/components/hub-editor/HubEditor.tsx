"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ConnectTab } from "@/components/hub-editor/ConnectTab";
import { MenuTab } from "@/components/hub-editor/MenuTab";
import { PageTab } from "@/components/hub-editor/PageTab";
import { RewardsTab } from "@/components/hub-editor/RewardsTab";
import { ErrorState, Skeleton } from "@/components/ui";
import { useToasts } from "@/components/ui/kit";
import type { EditorState, HubApi } from "@/lib/hub/api";

const DESKTOP = "(min-width: 1024px)";
function useDesktop() {
  return useSyncExternalStore(
    (notify) => {
      const m = window.matchMedia(DESKTOP);
      m.addEventListener("change", notify);
      return () => m.removeEventListener("change", notify);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
}

type TabKey = "page" | "connect" | "menu" | "rewards";

// One editor for both mounts: the owner (/app/hub) and Revyu admin
// (/admin/outlets/[id]) differ only in the `api` transport and `isAdmin`.
export function HubEditor({ api, isAdmin = false, initialTab = "page" }: { api: HubApi; isAdmin?: boolean; initialTab?: TabKey }) {
  const [state, setState] = useState<EditorState | null>(null);
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [error, setError] = useState<string | null>(null);
  // previewNonce refreshes the iframe on every reload. The form tabs only remount
  // (reset their local form state) when asked to, so toggling a module or the scan
  // mode never wipes unsaved edits in the same tab.
  const [previewNonce, setPreviewNonce] = useState(0);
  const [formNonce, setFormNonce] = useState({ page: 0, connect: 0 });
  const { push } = useToasts();
  const desktop = useDesktop();

  const reload = useCallback(async (resetForm?: "page" | "connect") => {
    try {
      setState(await api.state());
      setPreviewNonce((n) => n + 1);
      if (resetForm) setFormNonce((f) => ({ ...f, [resetForm]: f[resetForm] + 1 }));
      setError(null);
    } catch {
      setError("We couldn't load your page settings.");
    }
  }, [api]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with external/async source on mount
  useEffect(() => { reload(); }, [reload]);

  const tabs = useMemo(() => {
    if (!state) return [];
    const m = Object.fromEntries(state.modules.map((x) => [x.key, x]));
    return [
      { key: "page" as const, label: "Page" },
      { key: "connect" as const, label: "Connect", on: m.connect?.enabled },
      { key: "menu" as const, label: state.menu_label, on: m.menu?.enabled },
      { key: "rewards" as const, label: "Rewards", on: m.rewards?.enabled },
    ];
  }, [state]);

  if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (!state)
    return (
      <div role="status" aria-busy="true" aria-label="Loading your page settings" className="flex flex-col gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );

  const props = { api, state, reload, toast: push, isAdmin };

  // WAI-ARIA tabs: Left/Right (and Home/End) move between tabs; only the selected tab is in the Tab order.
  function onTabKey(e: React.KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    const next = e.key === "ArrowRight" ? (index + 1) % tabs.length : e.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(tabs[next].key);
    document.getElementById(`hub-tab-${tabs[next].key}`)?.focus();
  }
  const previewSrc = `/r/${state.slug}?preview=1`;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <div className="flex flex-col gap-4 min-w-0">
        <div role="tablist" aria-label="QR page sections" className="flex gap-1 p-1 rounded-xl bg-line overflow-x-auto no-scrollbar">
          {tabs.map((t, i) => (
            <button
              key={t.key}
              id={`hub-tab-${t.key}`}
              role="tab"
              aria-selected={tab === t.key}
              aria-controls={`hub-panel-${t.key}`}
              tabIndex={tab === t.key ? 0 : -1}
              onKeyDown={(e) => onTabKey(e, i)}
              onClick={() => setTab(t.key)}
              className={`flex-1 min-h-[42px] px-4 rounded-lg text-sm font-semibold whitespace-nowrap inline-flex items-center justify-center gap-2 transition-colors ${tab === t.key ? "bg-white text-ink shadow-sm" : "text-text-2"}`}
            >
              {t.label}
              {"on" in t && (
                <>
                  <span aria-hidden className={`w-2 h-2 rounded-full ${t.on ? "bg-success" : "bg-[#bfc8ca]"}`} />
                  <span className="sr-only">{t.on ? "(on)" : "(off)"}</span>
                </>
              )}
            </button>
          ))}
        </div>

        {/* Page and Connect stay mounted (hidden) so unsaved edits survive a tab switch. */}
        <div role="tabpanel" id="hub-panel-page" aria-labelledby="hub-tab-page" hidden={tab !== "page"}>
          <PageTab key={`p${formNonce.page}`} {...props} />
        </div>
        <div role="tabpanel" id="hub-panel-connect" aria-labelledby="hub-tab-connect" hidden={tab !== "connect"}>
          <ConnectTab key={`c${formNonce.connect}`} {...props} />
        </div>
        {tab === "menu" && (
          <div role="tabpanel" id="hub-panel-menu" aria-labelledby="hub-tab-menu">
            <MenuTab {...props} />
          </div>
        )}
        {tab === "rewards" && (
          <div role="tabpanel" id="hub-panel-rewards" aria-labelledby="hub-tab-rewards">
            <RewardsTab {...props} />
          </div>
        )}
      </div>

      {/* Below lg the phone mock is hidden; owners on a phone can still open the real page. */}
      <a
        href={`/r/${state.slug}`}
        target="_blank"
        rel="noreferrer"
        className="lg:hidden btn-pill-light w-full min-h-[44px] inline-flex items-center justify-center"
      >
        Preview your page ↗
      </a>
      {/* Mounted only on desktop: a display:none iframe would still load the whole customer page on a phone. */}
      {desktop && (
      <aside className="sticky top-20">
        <p className="vf-section-label mb-2">Live preview</p>
        <div className="rounded-[2rem] border-[6px] border-ink-dark overflow-hidden bg-bg shadow-v2-phone">
          <iframe key={previewNonce} title="Customer view preview" src={previewSrc} className="w-full h-[560px] border-0" />
        </div>
        <a href={`/r/${state.slug}`} target="_blank" rel="noreferrer" className="btn-pill-light w-full mt-3 min-h-[44px] inline-flex items-center justify-center">Open on your phone ↗</a>
      </aside>
      )}
    </div>
  );
}
