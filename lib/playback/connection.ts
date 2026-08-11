/**
 * Perfil de conexão do aparelho.
 *
 * O acervo é servido em bitrate único e alto (canais ao vivo passam de
 * 15 Mbps). Não existe troca de faixa: ou o buffer acompanha, ou trava. Como
 * não dá para baixar a qualidade, o que resta é ajustar QUANTO se acumula
 * antes de começar — e aceitar mais atraso em troca de imagem contínua, que é
 * o certo para quem está numa conexão ruim.
 */

export type ConnectionProfile = "poor" | "fair" | "good";

type NetworkInformation = {
  downlink?: number;
  effectiveType?: string;
  saveData?: boolean;
};

function networkInfo(): NetworkInformation | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (
    (navigator as Navigator & { connection?: NetworkInformation }).connection ??
    undefined
  );
}

export function detectConnectionProfile(): ConnectionProfile {
  const info = networkInfo();
  if (!info) return "fair"; // Sem informação, assume o meio-termo

  if (info.saveData) return "poor";

  const effective = info.effectiveType ?? "";
  if (effective === "slow-2g" || effective === "2g") return "poor";
  if (effective === "3g") return "fair";

  const downlink = info.downlink;
  if (typeof downlink === "number") {
    if (downlink < 2) return "poor";
    if (downlink < 6) return "fair";
  }

  return "good";
}

export type BufferPlan = {
  /** Bytes acumulados antes de entregar o primeiro quadro. */
  stashInitialSize: number;
  /** Persegue a borda da transmissão (menos atraso, mais risco de travar). */
  chaseLatency: boolean;
  /** Segundos de vídeo mantidos à frente no VOD. */
  vodBufferSeconds: number;
  label: string;
};

/**
 * Quanto acumular antes de começar.
 *
 * Os valores crescem a cada travada (ver `escalate`): a primeira tentativa é
 * otimista, e cada falha compra mais folga em troca de atraso. É o oposto de
 * insistir no mesmo buffer e travar em loop.
 */
export function bufferPlanFor(profile: ConnectionProfile): BufferPlan {
  switch (profile) {
    case "poor":
      return {
        stashInitialSize: 4 * 1024 * 1024,
        chaseLatency: false,
        vodBufferSeconds: 60,
        label: "Conexão lenta — acumulando mais vídeo para não travar",
      };
    case "fair":
      return {
        stashInitialSize: 1024 * 1024,
        chaseLatency: false,
        vodBufferSeconds: 30,
        label: "Ajustando à sua conexão",
      };
    default:
      return {
        stashInitialSize: 256 * 1024,
        chaseLatency: true,
        vodBufferSeconds: 20,
        label: "Carregando",
      };
  }
}

/** Rebaixa o perfil um degrau — chamado a cada travada. */
export function escalate(profile: ConnectionProfile): ConnectionProfile {
  return profile === "good" ? "fair" : "poor";
}
