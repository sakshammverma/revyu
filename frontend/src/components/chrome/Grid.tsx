import React from "react";

// 12-column architectural grid
export function Grid({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-12 gap-x-8 gap-y-6 ${className}`}>{children}</div>;
}

// Centered architectural section container
export function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`relative w-full max-w-6xl mx-auto px-6 sm:px-8 ${className}`}>
      {children}
    </section>
  );
}
