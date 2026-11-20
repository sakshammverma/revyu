import { SalesDemo } from "@/components/sales/SalesDemo";

// The in-shop sales demo: a focused full-screen tool, so no marketing header or footer.
// PIN-gated on the client; every data call is checked again by the server.
export default function SalesDemoPage() {
  return <SalesDemo />;
}
