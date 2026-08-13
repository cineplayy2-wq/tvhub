import { ReelsFeed } from "@/components/iptv/reels-feed";
import { requireUser } from "@/lib/auth/session";
import { getDailyReelsFeed } from "@/lib/queries/reels";
import { getViewablePlaylist } from "@/lib/queries/iptv";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dicas & Cortes — Hubflix" };

export default async function DicasPage() {
  const user = await requireUser();
  const playlist = await getViewablePlaylist(user.id);

  const feed = await getDailyReelsFeed(playlist?.id, 1, 15);

  return (
    <div className="fixed inset-0 top-[calc(env(safe-area-inset-top)+54px)] bottom-[calc(env(safe-area-inset-bottom)+60px)] md:bottom-0 md:left-[72px] overflow-hidden bg-black">
      <ReelsFeed initialItems={feed.items} initialHasMore={feed.hasMore} />
    </div>
  );
}
