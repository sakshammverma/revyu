import { FlowFrame } from "@/components/flow/Frame";
import { ReviewEntry } from "@/components/flow/ReviewEntry";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
}

// /r/{slug}/review — the review flow, unchanged (SRS-20.4). Deep links resolve
// in every state. Arriving from the hub does not fire a second scan.
export default async function ReviewPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { from } = await searchParams;
  const fromHub = from === "hub";
  return (
    <FlowFrame>
      <ReviewEntry slug={slug} fireScan={!fromHub} backToHub={fromHub} />
    </FlowFrame>
  );
}
