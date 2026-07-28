// Small inline icon set: no icon-font or library on the customer-flow budget.
const PATHS: Record<string, string> = {
  pencil: "M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  menu: "M5 7h14M5 12h14M5 17h9",
  badge: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8L3.5 9.2l5.9-.9L12 3z",
  pin: "M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  whatsapp: "M4 20l1.3-4.2A8 8 0 1 1 8.300 18.800L4 20zM9 9c0 3 3 6 6 6l1.300-1.500-2-1-1 .8c-1-.4-2-1.400-2.400-2.400l.8-1-1-2L9 9z",
  instagram: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM17.500 6.500h.01",
  facebook: "M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.500c0-.3.200-.5.500-.5z",
  youtube: "M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8zM10 9l5 3-5 3V9z",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.500 2.500 3.500 5.500 3.500 9s-1 6.500-3.500 9c-2.500-2.500-3.500-5.500-3.500-9S9.500 5.500 12 3z",
  mail: "M4 6h16v12H4V6zm0 0l8 7 8-7",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
  check: "M5 12.500l4.500 4.500L19 7",
  gift: "M4 10h16v10H4V10zM3 7h18v3H3V7zM12 7v13M12 7c-2-4-6-3-5 0 .4 1.200 2.500 1.300 5 0zm0 0c2-4 6-3 5 0-.4 1.200-2.500 1.300-5 0z",
  heart: "M12 20s-8-5-8-11a4.500 4.500 0 0 1 8-2.800A4.500 4.500 0 0 1 20 9c0 6-8 11-8 11z",
  crown: "M3 18h18l-1.500-10-4.500 4-3-6-3 6-4.500-4L3 18z",
  flame: "M12 3c1 4 5 5.500 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.500 1 2 1.500 2C10 8.500 11 5.500 12 3z",
  gem: "M6 4h12l3 5-9 11L3 9l3-5zM3 9h18M9 4l3 5 3-5M12 9v11",
  leaf: "M5 19C5 10 10 5 20 4c0 10-5 15-14 15zM5 19l8-8",
  bolt: "M13 3L5 13h6l-1 8 8-10h-6l1-8z",
  sparkle: "M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800L12 3z",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
};

export function Icon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  const d = PATHS[name] ?? PATHS.link;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
