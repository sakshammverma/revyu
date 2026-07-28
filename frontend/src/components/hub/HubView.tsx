"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Icon } from "@/components/hub/Icons";
import { beacon, type HubPayload } from "@/lib/hub/api";

// Tiles are equal in size and weight, and none of the copy refers to another
// module (FR-80, CR-6.2).
export function HubView({ slug, hub, quiet = false }: { slug: string; hub: HubPayload; quiet?: boolean }) {
  const { outlet, profile, open_now, modules } = hub;

  useEffect(() => {
    if (!quiet) beacon(outlet.id, "hub_viewed", { modules: modules.map((m) => m.key) });
  }, [outlet.id, modules, quiet]);

  const odd = modules.length % 2 === 1;

  return (
    <main className="flex flex-col gap-4">
      <header className="v2-sheet border border-[#e8ecec] overflow-hidden">
        {profile?.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.cover_image_url} alt="" className="w-full h-28 object-cover" loading="eager" />
        )}
        <div className="p-5 flex items-center gap-4">
          {outlet.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={outlet.logo_url} alt="" className="w-14 h-14 rounded-xl object-contain bg-[#f2f7f7] border border-[#e8ecec]" />
          )}
          <div className="min-w-0">
            <h1 className="font-display text-xl leading-tight text-[#1a1e23] truncate">{outlet.name}</h1>
            {(profile?.tagline || profile?.locality) && (
              <p className="text-sm text-[#515a63] mt-0.5 line-clamp-2">{profile?.tagline || profile?.locality}</p>
            )}
            {open_now && (
              <p className={`text-xs font-semibold mt-1.5 ${open_now.open ? "text-[#2f7a16]" : "text-[#59636a]"}`}>
                {open_now.open ? `Open now${open_now.until ? ` · until ${open_now.until}` : ""}` : "Closed right now"}
              </p>
            )}
          </div>
        </div>
      </header>

      <ul className="grid grid-cols-2 gap-3">
        {modules.map((m, i) => (
          <li key={m.key} className={odd && i === modules.length - 1 ? "col-span-2" : ""}>
            <Link
              href={m.key === "review" ? `/r/${slug}/review?from=hub` : `/r/${slug}/${m.route}`}
              onClick={(e) => {
                if (quiet) e.preventDefault();
                else beacon(outlet.id, "module_selected", { module: m.key });
              }}
              className="v2-sheet border border-[#e8ecec] min-h-[132px] h-full p-4 flex flex-col justify-between gap-4 transition-transform duration-150 active:scale-[0.98] hover:border-[#bfc8ca] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#397dff] motion-reduce:transition-none"
            >
              <span className="w-10 h-10 rounded-xl bg-[#e7f5fd] text-[#2f68db] flex items-center justify-center">
                <Icon name={m.icon} />
              </span>
              <span>
                <span className="block font-semibold text-[#1a1e23] leading-snug">{m.label}</span>
                <span className="block text-xs text-[#59636a] mt-0.5 leading-snug">{m.blurb}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-center text-xs text-[#59636a] pt-2">Powered by Revyu</p>
    </main>
  );
}
