"use client";

import dynamic from "next/dynamic";

// A server page can't code-split a client component by itself (see the Next docs on
// lazy loading), so the split happens here: visitors of a direct-mode QR, the
// default, never download the hub UI.
export const HubViewLazy = dynamic(() => import("@/components/hub/HubView").then((m) => m.HubView));
