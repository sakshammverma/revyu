"use client";

import { Icon } from "@/components/hub/Icons";
import { beacon, type ConnectPayload } from "@/lib/hub/api";

const LABELS: Record<string, string> = {
  google_maps: "Google Maps",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
  website: "Website",
  phone: "Call us",
  email: "Email",
  custom: "Link",
};
const ICONS: Record<string, string> = {
  google_maps: "pin",
  instagram: "instagram",
  facebook: "facebook",
  youtube: "youtube",
  whatsapp: "whatsapp",
  website: "globe",
  phone: "phone",
  email: "mail",
  custom: "link",
};

function vcard(name: string, phone?: string | null, url?: string) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${name}`, `ORG:${name}`];
  if (phone) lines.push(`TEL;TYPE=WORK:${phone}`);
  if (url) lines.push(`URL:${url}`);
  lines.push("END:VCARD");
  const blob = new Blob([lines.join("\r\n")], { type: "text/vcard" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/\W+/g, "-")}.vcf`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Links open in a new context; each tap emits link_clicked {kind} (FR-88).
// Nothing here is conditioned on following or liking anything (FR-91).
export function ConnectView({ data }: { data: ConnectPayload }) {
  const links = data.links ?? [];
  const profile = data.profile;
  const maps = links.find((l) => l.kind === "google_maps");
  const rest = links.filter((l) => l !== maps);
  const phone = profile?.phone;
  const site = links.find((l) => l.kind === "website")?.url;

  const click = (kind: string) => beacon(data.outlet.id, "link_clicked", { kind });

  return (
    <div className="flex flex-col gap-3">
      {(maps || profile?.address_line) && (
        <a
          href={maps?.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => click("google_maps")}
          className="v2-sheet border border-[#e8ecec] p-4 flex items-center gap-4 min-h-[72px] active:scale-[0.99] transition-transform"
        >
          <span className="w-11 h-11 rounded-xl bg-[#e7f5fd] text-[#2f68db] flex items-center justify-center shrink-0">
            <Icon name="pin" className="w-6 h-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-[#1a1e23]">Get directions</span>
            <span className="block text-sm text-[#515a63] truncate">
              {[profile?.address_line, profile?.locality].filter(Boolean).join(", ") || "Open in Google Maps"}
            </span>
          </span>
          <Icon name="arrow" className="w-5 h-5 text-[#59636a]" />
        </a>
      )}

      {phone && !rest.some((l) => l.kind === "phone") && (
        <a
          href={`tel:${phone}`}
          onClick={() => click("phone")}
          className="v2-sheet border border-[#e8ecec] p-4 flex items-center gap-4 min-h-[64px]"
        >
          <Icon name="phone" className="w-5 h-5 text-[#2f68db]" />
          <span className="font-semibold text-[#1a1e23] flex-1">Call us</span>
          <span className="text-sm text-[#515a63]">{phone}</span>
        </a>
      )}

      {rest.map((l) => (
        <a
          key={l.id}
          href={l.url}
          target={l.url.startsWith("http") ? "_blank" : undefined}
          rel="noopener noreferrer"
          onClick={() => click(l.kind)}
          className="v2-sheet border border-[#e8ecec] p-4 flex items-center gap-4 min-h-[64px] active:scale-[0.99] transition-transform"
        >
          <span className="w-10 h-10 rounded-xl bg-[#f2f7f7] text-[#1a1e23] flex items-center justify-center shrink-0">
            <Icon name={ICONS[l.kind] ?? "link"} />
          </span>
          <span className="font-semibold text-[#1a1e23] flex-1 truncate">{l.label || LABELS[l.kind] || "Link"}</span>
          <Icon name="arrow" className="w-5 h-5 text-[#59636a]" />
        </a>
      ))}

      {data.open_now && (
        <p className="text-sm text-[#515a63] flex items-center gap-2 px-1">
          <Icon name="clock" className="w-4 h-4" />
          {data.open_now.open ? `Open now${data.open_now.until ? ` until ${data.open_now.until}` : ""}` : "Closed right now"}
        </p>
      )}

      <button
        type="button"
        onClick={() => vcard(data.outlet.name, phone, site)}
        className="btn-pill-light min-h-[48px] mt-1 inline-flex items-center justify-center gap-2"
      >
        <Icon name="download" className="w-4 h-4" /> Save contact
      </button>
    </div>
  );
}
