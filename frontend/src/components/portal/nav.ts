// One list drives the desktop sidebar, the mobile tab bar and the "More" page, so they can't drift apart.
export interface NavItem {
  href: string;
  label: string;
  icon: string;
  group: "Daily" | "Setup" | "Grow" | "Account";
  note: string;
  /** Shorter label for the five-slot mobile tab bar, where long names wrap. */
  tabLabel?: string;
}

export const NAV: NavItem[] = [
  { href: "/app", label: "Overview", icon: "home", group: "Daily", note: "How your QR code is performing" },
  { href: "/app/feedback", label: "Feedback", icon: "mail", group: "Daily", note: "Private messages from customers" },
  { href: "/app/insights", label: "Insights", icon: "chart", group: "Daily", note: "Funnel, top compliments and your rating" },
  { href: "/app/qr", label: "QR & Print", icon: "qr", group: "Setup", note: "Your QR code and print-ready files" },
  { href: "/app/hub", label: "Customer page", tabLabel: "Page", icon: "layout", group: "Setup", note: "Links, menu, rewards and what customers see after scanning" },
  { href: "/app/competitors", label: "Competitors", icon: "flag", group: "Grow", note: "Follow nearby businesses and see who is gaining reviews" },
  { href: "/app/grow", label: "Grow", icon: "arrow", group: "Grow", note: "Website, video, content and automation services" },
  { href: "/app/referrals", label: "Refer & save", icon: "gift", group: "Grow", note: "70% off when a referral subscribes" },
  { href: "/app/billing", label: "Billing", icon: "card", group: "Account", note: "Your plan, payments and invoices" },
];

// The mobile bottom bar shows the daily destinations; everything else lives under "More".
export const MOBILE_PRIMARY = ["/app", "/app/feedback", "/app/qr", "/app/hub"];

export function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}
