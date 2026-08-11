import { GUTTER } from "@/components/iptv/section";
import { RailSkeleton } from "@/components/iptv/skeletons";

/**
 * Estado de transição entre páginas.
 *
 * Sem isto o navegador fica parado na tela anterior enquanto o servidor
 * renderiza a próxima — e a navegação "parece travada" mesmo quando leva
 * menos de um segundo. Com o esqueleto, a resposta é imediata: o usuário vê
 * que o clique funcionou e para onde está indo.
 */
export default function TvLoading() {
  return (
    <div className="min-h-screen pt-16">
      <div className={`${GUTTER} py-8`}>
        <div className="h-3 w-24 rounded bg-white/[0.07]" />
        <div className="mt-3 h-9 w-64 rounded bg-white/10" />
        <div className="mt-3 h-3 w-40 rounded bg-white/[0.05]" />
      </div>

      <div className="space-y-12">
        <RailSkeleton />
        <RailSkeleton variant="tile" />
        <RailSkeleton />
      </div>
    </div>
  );
}
