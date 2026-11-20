"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DashboardSlide } from "@/components/sales/DashboardSlide";
import { DeckFrame } from "@/components/sales/DeckFrame";
import { GapSlide } from "@/components/sales/GapSlide";
import { ProspectSearch, readRecent, type ShopPick } from "@/components/sales/ProspectSearch";
import { SalesGate } from "@/components/sales/SalesGate";
import { StartSlide } from "@/components/sales/StartSlide";
import { TrySlide } from "@/components/sales/TrySlide";
import { Button } from "@/components/ui/Button";
import { SalesApiError, getKit, getProspect } from "@/lib/marketing/salesApi";
import type { CueVars } from "@/lib/marketing/salesScript";
import { DECK_KEY, DECK_STEPS, RECENT_KEY, RECENT_MAX, type DeckState, type DeckStep } from "@/lib/marketing/salesTypes";
import { usePricing } from "@/lib/pricing";

type Phase = { kind: "search" } | { kind: "loading"; name: string } | { kind: "deck" };

function readDeck(): DeckState | null {
  try {
    const raw = sessionStorage.getItem(DECK_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as DeckState;
    return d && d.prospect && d.kit && typeof d.name === "string" && DECK_STEPS.includes(d.step) ? d : null;
  } catch {
    return null;
  }
}

function writeDeck(d: DeckState | null): void {
  try {
    if (d) sessionStorage.setItem(DECK_KEY, JSON.stringify(d));
    else sessionStorage.removeItem(DECK_KEY);
  } catch {
    /* storage blocked: the deck just won't survive a reload */
  }
}

function remember(shop: ShopPick, name: string): void {
  try {
    const list = [
      { place_id: shop.place_id, name, address: shop.address ?? "", at: new Date().toISOString() },
      ...readRecent().filter((r) => r.place_id !== shop.place_id),
    ].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* recent list is a convenience only */
  }
}

function buildError(e: unknown): string {
  if (e instanceof SalesApiError) {
    if (e.status === 503) return "Google is unavailable right now, so the demo couldn't be built. Try again in a minute.";
    if (e.status === 429) return "The demo limit is reached for now. Try again later.";
    if (e.status === 404) return "Google couldn't find that listing. Search again.";
    if (e.status === 0) return "No connection. Check the internet and try again.";
  }
  return "The demo couldn't be built. Try again.";
}

/** Within this long of expiry, the scan-to-try link is renewed before the owner scans it. */
const TRY_RENEW_MS = 15 * 60 * 1000;

function Deck({ signOut }: { signOut: () => void }) {
  const pricing = usePricing();
  const [phase, setPhase] = useState<Phase>({ kind: "search" });
  const [deck, setDeck] = useState<DeckState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verticalBusy, setVerticalBusy] = useState(false);
  // Every pick gets a number; a slower, older answer can't replace a newer pick or a cancel.
  const pickId = useRef(0);
  const restored = useRef(false);

  // Restore the deck once (it survives the trip to the try page and back, and a reload).
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const url = new URL(window.location.href);
    const resume = url.searchParams.get("resume");
    if (resume) {
      url.searchParams.delete("resume");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    const saved = readDeck();
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is browser-only, read once after hydration
    setDeck(resume === "dashboard" ? { ...saved, step: "dashboard" } : saved);
    setPhase({ kind: "deck" });
  }, []);

  // Save every change.
  useEffect(() => {
    if (deck) writeDeck(deck);
  }, [deck]);

  // A deck restored hours later carries a scan-to-try link that is about to stop working: renew it.
  const placeId = deck?.prospect.place_id;
  const deckName = deck?.name;
  const vertical = deck?.kit.vertical;
  const expiresAt = deck?.kit.try.expires_at;
  useEffect(() => {
    if (!placeId || !deckName || !vertical || !expiresAt) return;
    if (new Date(expiresAt).getTime() - Date.now() > TRY_RENEW_MS) return;
    let live = true;
    getKit({ placeId, name: deckName, vertical })
      .then((kit) => {
        if (live) setDeck((d) => (d && d.prospect.place_id === placeId ? { ...d, kit } : d));
      })
      .catch(() => {
        /* the old link still shows; the presenter can re-open the shop */
      });
    return () => {
      live = false;
    };
  }, [placeId, deckName, vertical, expiresAt]);

  const pick = useCallback(async (shop: ShopPick) => {
    const id = ++pickId.current;
    setNotice(null);
    setPhase({ kind: "loading", name: shop.name });
    try {
      const prospect = await getProspect(shop.place_id);
      if (id !== pickId.current) return;
      const name = prospect.report.business.name || shop.name;
      const kit = await getKit({ placeId: prospect.place_id || shop.place_id, name, vertical: prospect.vertical });
      if (id !== pickId.current) return;
      remember({ ...shop, address: prospect.shop.address || shop.address }, name);
      setDeck({ name, prospect, kit, step: "gap" });
      setPhase({ kind: "deck" });
    } catch (e) {
      if (id !== pickId.current) return;
      if (e instanceof SalesApiError && e.status === 401) {
        signOut();
        return;
      }
      setNotice(buildError(e));
      setPhase({ kind: "search" });
    }
  }, [signOut]);

  const cancel = () => {
    pickId.current++;
    setPhase({ kind: "search" });
  };

  const end = useCallback(() => {
    pickId.current++;
    writeDeck(null);
    setDeck(null);
    setNotice(null);
    setPhase({ kind: "search" });
  }, []);

  const setStep = useCallback((step: DeckStep) => setDeck((d) => (d ? { ...d, step } : d)), []);

  const changeVertical = useCallback(
    async (v: string) => {
      if (!deck || v === deck.kit.vertical) return;
      const { place_id } = deck.prospect;
      setVerticalBusy(true);
      try {
        const kit = await getKit({ placeId: place_id, name: deck.name, vertical: v });
        setDeck((d) => (d && d.prospect.place_id === place_id ? { ...d, kit } : d));
      } catch (e) {
        if (e instanceof SalesApiError && e.status === 401) signOut();
      } finally {
        setVerticalBusy(false);
      }
    },
    [deck, signOut],
  );

  const vars = useMemo<CueVars>(() => {
    if (!deck) return {};
    const { business, competitors } = deck.prospect.report;
    const rival = competitors[0] ?? null;
    return {
      name: deck.name,
      m: business.review_count ?? 0,
      rival: rival?.name,
      n: rival?.review_count ?? undefined,
      price: pricing.ready ? pricing.monthly : null,
      perDay:
        pricing.ready && pricing.monthlyMinor !== null ? pricing.money(Math.round(pricing.monthlyMinor / 30)) : null,
    };
  }, [deck, pricing]);

  if (phase.kind === "loading") {
    return (
      <main className="marketing-root min-h-[100dvh] bg-bg text-ink flex items-center justify-center px-6">
        <div role="status" className="flow-step flex max-w-sm flex-col items-center text-center">
          <span aria-hidden className="w-10 h-10 rounded-full border-[3px] border-accent border-t-transparent animate-spin" />
          <p className="font-display text-2xl text-ink mt-6">Building {phase.name}&rsquo;s demo…</p>
          <p className="text-sm text-text-2 mt-2">Reading its Google listing and the shops nearby.</p>
          <Button variant="ghost" onClick={cancel} className="mt-6">
            Cancel
          </Button>
        </div>
      </main>
    );
  }

  if (phase.kind === "deck" && deck) {
    return (
      <DeckFrame
        name={deck.name}
        step={deck.step}
        onStep={setStep}
        vertical={deck.kit.vertical}
        onVertical={changeVertical}
        verticalBusy={verticalBusy}
        onEnd={end}
        vars={vars}
      >
        {deck.step === "gap" && <GapSlide prospect={deck.prospect} name={deck.name} />}
        {deck.step === "try" && <TrySlide kit={deck.kit} name={deck.name} />}
        {deck.step === "dashboard" && <DashboardSlide prospect={deck.prospect} kit={deck.kit} name={deck.name} />}
        {deck.step === "start" && <StartSlide kit={deck.kit} name={deck.name} onEnd={end} />}
      </DeckFrame>
    );
  }

  return <ProspectSearch onPick={pick} onSignOut={signOut} notice={notice} />;
}

/** /marketing: the in-shop sales demo. PIN gate, then find the shop, then the 4-step deck. */
export function SalesDemo() {
  return <SalesGate>{(_role, signOut) => <Deck signOut={signOut} />}</SalesGate>;
}
