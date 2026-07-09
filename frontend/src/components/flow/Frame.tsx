// Reduced chrome for the customer flow: pale desk, one white sheet, no art.
// Top-aligned on phones so every action sits well above the fold at 360×640;
// centred on larger screens.
export function FlowFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f2f7f7] flex flex-col justify-start sm:justify-center items-center px-3 pt-4 pb-8 sm:px-6 sm:py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
