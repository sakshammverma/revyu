import type { TagConfig } from "@/lib/flow/api";

interface Props {
  tags: TagConfig[];
  selected: Set<string>;
  onToggle: (tagId: string) => void;
}

// FR-4: zero or more tags selectable. FR-5: outlet-configured set.
export function TagChips({ tags, selected, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Select what stood out">
      {tags.map((tag) => {
        const active = selected.has(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(tag.id)}
            className={`min-h-[44px] px-4 py-2 text-sm font-medium rounded-full border transition-colors duration-150 cursor-pointer flex items-center gap-1.5 active:scale-95 [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
              active
                ? "bg-accent-50 text-ink border-accent ring-1 ring-accent font-semibold"
                : "bg-white text-ink border-line-strong hover:border-accent/60 hover:bg-[#f7fafa]"
            }`}
          >
            {active && (
              <svg className="w-4 h-4 text-accent stroke-[3] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span>{tag.label}</span>
          </button>
        );
      })}
    </div>
  );
}
