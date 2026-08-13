import { Suspense } from "react";

import { NavHistory } from "@/components/iptv/nav-history";
import { TabBar } from "@/components/iptv/tab-bar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main>
      {/* Registra por onde a pessoa passou, para o Voltar saber para onde ir.
          Dentro de Suspense porque `useSearchParams` obriga — sem isso a
          página inteira vira renderização sob demanda. */}
      <Suspense fallback={null}>
        <NavHistory />
      </Suspense>
      {children}
      <TabBar />
    </main>
  );
}
