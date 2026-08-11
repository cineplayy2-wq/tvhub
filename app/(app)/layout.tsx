import { TabBar } from "@/components/iptv/tab-bar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main>
      {children}
      <TabBar />
    </main>
  );
}
