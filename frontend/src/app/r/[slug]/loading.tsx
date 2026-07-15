export default function FlowLoading() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center px-3 pt-4 sm:justify-center" aria-busy="true" aria-label="Loading">
      <div className="v2-sheet border border-line w-full max-w-md p-8 flex flex-col gap-4">
        <div className="ui-skeleton h-5 w-1/2" />
        <div className="ui-skeleton h-9 w-3/4" />
        <div className="ui-skeleton h-24 w-full" />
        <div className="ui-skeleton h-12 w-full" />
      </div>
    </div>
  );
}
