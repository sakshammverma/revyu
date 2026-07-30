import { notFound } from "next/navigation";

import { FlowFrame } from "@/components/flow/Frame";
import { ModuleShell, NeutralNotice } from "@/components/hub/ModuleShell";
import { MenuView } from "@/components/menu/MenuView";
import { fetchMenu } from "@/lib/hub/api";

export default async function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await fetchMenu(slug);
  if (data === null) notFound();
  return (
    <FlowFrame>
      {data.collecting ? (
        <ModuleShell slug={slug} outlet={data.outlet} title={data.label ?? "Services"}>
          <MenuView data={data} />
        </ModuleShell>
      ) : (
        <NeutralNotice name={data.outlet.name} />
      )}
    </FlowFrame>
  );
}
