/**
 * Data loaders for the server-rendered customer pages (/r/[slug]/...). These
 * call the services directly instead of looping back through HTTP to the API.
 */
import { cache } from "react";
import { after, connection } from "next/server";

import type { FlowConfig as ClientFlowConfig } from "@/lib/flow/api";
import type { ConnectPayload, HubPayload, MenuPayload, RewardsInfo } from "@/lib/hub/api";
import { getDb } from "@/server/db";
import { recordEvents } from "@/server/services/events";
import { buildFlowConfig, findOutletBySlug, type Outlet } from "@/server/services/flow";
import {
  getConnectPayload,
  getHubPayload,
  getMenuPayload,
  getRewardsPayload,
} from "@/server/services/hub";

/**
 * Resolve the outlet and build a payload. Reading from the database does not
 * opt a page out of static caching the way `fetch(..., {cache: "no-store"})`
 * did, so connection() makes that explicit: menus, tags and state must never
 * be served stale.
 */
// The page and the review flow both resolve the same outlet in one render; look it up once.
const outletForRequest = cache((slug: string) => findOutletBySlug(getDb(), slug));

async function load<T>(slug: string, build: (outlet: Outlet) => Promise<T>): Promise<T | null> {
  await connection();
  const outlet = await outletForRequest(slug);
  return outlet ? build(outlet) : null;
}

export const loadFlowConfig = (slug: string): Promise<ClientFlowConfig | null> =>
  load(slug, (outlet) => buildFlowConfig(getDb(), outlet));
export const loadHub = (slug: string) =>
  load(slug, (outlet) => getHubPayload(getDb(), outlet)) as Promise<HubPayload | null>;
export const loadConnect = (slug: string) =>
  load(slug, (outlet) => getConnectPayload(getDb(), outlet)) as Promise<ConnectPayload | null>;
export const loadMenu = (slug: string) =>
  load(slug, (outlet) => getMenuPayload(getDb(), outlet)) as Promise<MenuPayload | null>;
export const loadRewards = (slug: string) =>
  load(slug, (outlet) => getRewardsPayload(getDb(), outlet)) as Promise<RewardsInfo | null>;

/**
 * The scan event fired when a QR is opened. Runs after the response is sent so
 * it never delays render, and never throws into the customer's page.
 */
export function recordScan(outletId: string): void {
  after(async () => {
    try {
      await recordEvents(getDb(), {
        outletId,
        sessionId: null,
        events: [{ type: "scan", payload: {} }],
      });
    } catch (err) {
      console.error("scan event failed", err);
    }
  });
}
