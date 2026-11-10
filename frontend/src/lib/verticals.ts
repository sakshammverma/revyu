/**
 * Business categories offered at signup, in display order: general shop first,
 * then shop types, then service businesses. Keys must match the config files in
 * src/server/verticals (a test keeps the two in sync).
 */
export const VERTICAL_OPTIONS: { key: string; label: string }[] = [
  { key: "general", label: "Shop, café, boutique or other" },
  { key: "restaurant", label: "Café / restaurant" },
  { key: "bakery", label: "Bakery / sweets" },
  { key: "retail", label: "Clothing / retail store" },
  { key: "grocery", label: "Grocery / kirana" },
  { key: "electronics", label: "Mobile / electronics & repair" },
  { key: "pharmacy", label: "Pharmacy / chemist" },
  { key: "automotive", label: "Car / bike service" },
  { key: "salon", label: "Salon / beauty" },
  { key: "gym", label: "Gym / fitness studio" },
  { key: "coaching", label: "Coaching centre" },
  { key: "dental", label: "Dental clinic" },
  { key: "physiotherapy", label: "Physiotherapy" },
];
