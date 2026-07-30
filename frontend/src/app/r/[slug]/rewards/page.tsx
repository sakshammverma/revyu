import { notFound } from "next/navigation";

import { FlowFrame } from "@/components/flow/Frame";
import { ModuleShell, NeutralNotice } from "@/components/hub/ModuleShell";
import { RewardsView } from "@/components/rewards/RewardsView";
import { fetchRewardsInfo } from "@/lib/hub/api";

// Nothing on this route mentions anything from the customer-flow side (CR-6.2).
export default async function RewardsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const info = await fetchRewardsInfo(slug);
  if (info === null) notFound();
  return (
    <FlowFrame>
      {info.collecting ? (
        <ModuleShell slug={slug} outlet={info.outlet} title="Rewards">
          <RewardsView slug={slug} info={info} />
        </ModuleShell>
      ) : (
        <NeutralNotice name={info.outlet.name} />
      )}
    </FlowFrame>
  );
}
