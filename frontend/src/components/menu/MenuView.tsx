"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { beacon, formatMoney, type MenuItemData, type MenuPayload } from "@/lib/hub/api";

const DIET: Record<string, { label: string; color: string }> = {
  veg: { label: "Veg", color: "#449127" },
  non_veg: { label: "Non-veg", color: "#c62445" },
  vegan: { label: "Vegan", color: "#2f7a16" },
  egg: { label: "Egg", color: "#b7791f" },
};

export function PriceText({ item }: { item: MenuItemData }) {
  if (item.price_on_request || item.amount_minor === null)
    return <span className="text-sm text-[#59636a]">Price on request</span>;
  return (
    <span className="text-sm font-semibold text-[#1a1e23] whitespace-nowrap">
      {item.price_prefix ? `${item.price_prefix} ` : ""}
      {formatMoney(item.amount_minor, item.currency_code)}
    </span>
  );
}

export function MenuView({ data }: { data: MenuPayload }) {
  const cats = useMemo(() => (data.categories ?? []).filter((c) => c.items.length), [data.categories]);
  const [active, setActive] = useState(cats[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<MenuItemData | null>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const total = cats.reduce((n, c) => n + c.items.length, 0);

  useEffect(() => {
    beacon(data.outlet.id, "menu_viewed");
  }, [data.outlet.id]);

  useEffect(() => {
    if (query) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.getAttribute("data-cat") ?? "");
      },
      { rootMargin: "-120px 0px -65% 0px" }
    );
    Object.values(refs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [cats, query]);

  const q = query.trim().toLowerCase();
  const shown = q
    ? cats
        .map((c) => ({
          ...c,
          items: c.items.filter((i) => (i.name + " " + (i.description ?? "")).toLowerCase().includes(q)),
        }))
        .filter((c) => c.items.length)
    : cats;

  if (!cats.length)
    return (
      <p className="v2-sheet border border-[#e8ecec] p-6 text-sm text-[#515a63] text-center">Nothing listed yet.</p>
    );

  return (
    <div className="flex flex-col gap-3">
      {total > 12 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${data.label?.toLowerCase() ?? "items"}`}
          aria-label="Search"
          className="w-full rounded-xl border border-[#d5dcdc] bg-white px-4 py-3 text-base outline-none focus:border-[#397dff] focus:ring-2 focus:ring-[#397dff]/25"
        />
      )}
      {!q && cats.length > 1 && (
        <div className="sticky top-[52px] z-10 -mx-3 px-3 py-2 bg-[#f2f7f7]/95 backdrop-blur overflow-x-auto flex gap-2 no-scrollbar">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => refs.current[c.id]?.scrollIntoView({ behavior: "smooth", block: "start" })}
              aria-current={active === c.id}
              className={`shrink-0 min-h-[40px] px-4 rounded-full text-sm font-semibold border transition-colors ${
                active === c.id
                  ? "bg-[#1f2429] text-white border-[#1f2429]"
                  : "bg-white text-[#1a1e23] border-[#d5dcdc]"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {shown.map((c) => (
        <section
          key={c.id}
          data-cat={c.id}
          ref={(el) => {
            refs.current[c.id] = el;
          }}
          className="scroll-mt-28"
        >
          <h2 className="vf-section-label mb-2">{c.name}</h2>
          <ul className="v2-sheet border border-[#e8ecec] divide-y divide-[#e8ecec]">
            {c.items.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => setOpen(i)}
                  className={`w-full text-left p-4 flex gap-3 items-start min-h-[72px] ${i.available ? "" : "opacity-55"}`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#1a1e23]">{i.name}</span>
                      {i.dietary.map((d) => (
                        <span
                          key={d}
                          title={DIET[d]?.label}
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ background: DIET[d]?.color }}
                        />
                      ))}
                    </span>
                    {i.description && (
                      <span className="block text-sm text-[#515a63] mt-0.5 line-clamp-2">{i.description}</span>
                    )}
                    <span className="flex items-center gap-2 mt-1.5">
                      <PriceText item={i} />
                      {i.duration_min && <span className="text-xs text-[#59636a]">· {i.duration_min} min</span>}
                      {!i.available && <span className="text-xs font-semibold text-[#59636a]">· Unavailable</span>}
                    </span>
                  </span>
                  {i.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={i.photo_url}
                      alt=""
                      loading="lazy"
                      width={72}
                      height={72}
                      className="w-[72px] h-[72px] rounded-lg object-cover shrink-0 bg-[#f2f7f7]"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {q && !shown.length && <p className="text-sm text-[#515a63] text-center py-6">No matches.</p>}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={open.name}
        >
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setOpen(null)} />
          <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto">
            {open.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={open.photo_url} alt="" className="w-full h-52 object-cover rounded-xl mb-4" />
            )}
            <h3 className="font-display text-xl text-[#1a1e23]">{open.name}</h3>
            <div className="mt-1">
              <PriceText item={open} />
            </div>
            {open.description && <p className="text-sm text-[#515a63] mt-3 leading-relaxed">{open.description}</p>}
            <button type="button" onClick={() => setOpen(null)} className="btn-pill-light w-full min-h-[48px] mt-5">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
