"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ConnectTab } from "@/components/hub-editor/ConnectTab";
import { MenuTab } from "@/components/hub-editor/MenuTab";
import { PageTab } from "@/components/hub-editor/PageTab";
import { RewardsTab } from "@/components/hub-editor/RewardsTab";
import { useToasts } from "@/components/ui/kit";
import type { EditorState, HubApi } from "@/lib/hub/api";

type TabKey = "page" | "connect" | "menu" | "rewards";

// One editor for both mounts: the owner (/app/hub) and Revyu admin
// (/admin/outlets/[id]) differ only in the `api` transport and `isAdmin`.
export function HubEditor({ api, isAdmin = false, initialTab = "page" }: { api: HubApi; isAdmin?: boolean; initialTab?: TabKey }) {
  const [state, setState] = useState<EditorState | null>(null);
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const { push, node } = useToasts();

  const reload = useCallback(async () => {
    try {
      setState(await api.state());
      setNonce((n) => n + 1);
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

  if (error)
    return (
      <div className="v2-sheet border border-[#e8ecec] p-6 text-center">
        <p className="text-[#c62445] font-semibold">{error}</p>
        <button className="btn-primary mt-4 min-h-[44px] px-5" onClick={reload}>Retry</button>
      </div>
    );
  if (!state) return <div className="flex flex-col gap-3"><div className="ui-skeleton h-24 rounded-2xl" /><div className="ui-skeleton h-64 rounded-2xl" /></div>;

  const props = { api, state, reload, toast: push, isAdmin };
  const previewSrc = `/r/${state.slug}?preview=1`;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <div className="flex flex-col gap-4 min-w-0">
        <div role="tablist" aria-label="QR page sections" className="flex gap-1 p-1 rounded-xl bg-[#e8ecec] overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 min-h-[42px] px-4 rounded-lg text-sm font-semibold whitespace-nowrap inline-flex items-center justify-center gap-2 transition-colors ${tab === t.key ? "bg-white text-[#1a1e23] shadow-sm" : "text-[#515a63]"}`}
            >
              {t.label}
              {"on" in t && <span className={`w-2 h-2 rounded-full ${t.on ? "bg-[#449127]" : "bg-[#bfc8ca]"}`} aria-label={t.on ? "on" : "off"} />}
            </button>
          ))}
        </div>

        {tab === "page" && <PageTab key={`p${nonce}`} {...props} />}
        {tab === "connect" && <ConnectTab key={`c${nonce}`} {...props} />}
        {tab === "menu" && <MenuTab {...props} />}
        {tab === "rewards" && <RewardsTab {...props} />}
      </div>

      <aside className="hidden lg:block sticky top-20">
        <p className="vf-section-label mb-2">Live preview</p>
        <div className="rounded-[2rem] border-[6px] border-[#1f2429] overflow-hidden bg-[#f2f7f7] shadow-v2-phone">
          <iframe key={nonce} title="Customer view preview" src={previewSrc} className="w-full h-[560px] border-0" />
        </div>
        <a href={`/r/${state.slug}`} target="_blank" rel="noreferrer" className="btn-pill-light w-full mt-3 min-h-[44px] inline-flex items-center justify-center">Open on your phone ↗</a>
      </aside>
      {node}
    </div>
  );
}
