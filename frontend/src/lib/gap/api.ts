import { API_BASE } from "@/lib/api-base";

export interface GapBusiness {
  place_id: string;
  name: string;
  rating: number | null;
  review_count: number | null;
}

export interface GapReport {
  business: GapBusiness;
  competitors: GapBusiness[];
  review_gap: number;
  rank_by_reviews: number;
  group_size: number;
  headline: string;
}

export class GapApiError extends Error {
  status: number;
  constructor(status: number) {
    super(`gap api ${status}`);
    this.status = status;
  }
}

export async function fetchGapReport(placeId: string): Promise<GapReport> {
  const res = await fetch(`${API_BASE}/api/gap-report?place_id=${encodeURIComponent(placeId)}`);
  if (!res.ok) throw new GapApiError(res.status);
  return res.json();
}

export async function emailGapReport(placeId: string, email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/gap-report/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ place_id: placeId, email }),
  });
  if (!res.ok) throw new GapApiError(res.status);
}
