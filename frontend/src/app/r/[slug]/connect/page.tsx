import { notFound } from "next/navigation";

import { ConnectView } from "@/components/connect/ConnectView";
import { FlowFrame } from "@/components/flow/Frame";
import { ModuleShell, NeutralNotice } from "@/components/hub/ModuleShell";
import { loadConnect } from "@/server/pageData";

export default async function ConnectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadConnect(slug);
  if (data === null) notFound();
  return (
    <FlowFrame>
      {data.collecting ? (
        <ModuleShell slug={slug} outlet={data.outlet} title="Connect with us">
          <ConnectView data={data} />
        </ModuleShell>
      ) : (
        <NeutralNotice name={data.outlet.name} />
      )}
    </FlowFrame>
  );
}
