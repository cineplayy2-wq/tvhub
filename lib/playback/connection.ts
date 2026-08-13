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

  /**
   * Com `4g`, para por aqui — sem consultar `downlink`.
   *
   * `downlink` NÃO é a capacidade do link: é a média móvel do que já trafegou,
   * arredondada e limitada a 10 Mbps. No instante em que a página abre quase
   * nada trafegou, então uma fibra de 300 Mbps costuma reportar 1,5 ou 3 —
   * valores que caíam direto em "poor" e "fair" aqui embaixo.
   *
   * O efeito era o assinante de conexão ótima receber SD e achar, com razão,
   * que a qualidade piorou. Como o provedor não manda stream adaptativo, essa
   * escolha é definitiva: não existe subir de faixa depois.
   *
   * `effectiveType` responde outra pergunta, e é a pergunta certa aqui: em que
   * categoria de rede este aparelho está. O navegador a calcula com histórico
   * de latência e vazão, não com o tráfego dos últimos milissegundos.
   */
  if (effective === "4g") return "good";

  /**
   * Sem `effectiveType` (navegador que expõe só `downlink`), o valor volta a
   * ser o único sinal — mas com limiar baixo, para ele acusar apenas o que é
   * inequivocamente ruim, em vez de rebaixar quem só acabou de abrir a página.
   */
  const downlink = info.downlink;
  if (typeof downlink === "number" && downlink < 1) return "poor";

  return "good";
}

export type BufferPlan = {
  /** Bytes acumulados antes de entregar o primeiro quadro. */
  stashInitialSize: number;
  /**
   * Segundos de vídeo mantidos à frente como folga contra oscilação da rede.
   * É este colchão que decide se uma engasgada vira travada na tela ou passa
   * despercebida.
   */
  colchaoSegundos: number;
  /**
   * Atraso máximo tolerado antes de o player pular para frente — e, quando
   * pula, ele para em `colchaoSegundos`, nunca no zero.
   *
   * O par (máximo 3s, sobra 0,5s) que estava no player era a origem das
   * travadinhas: bastava a folga passar de 3 segundos para ele saltar e deixar
   * meio segundo de reserva. Meio segundo não sobrevive a nenhuma variação de
   * rede, então travava, recarregava e repetia. Com uma faixa larga, o salto
   * só acontece quando o atraso é realmente grande, e sempre sobra colchão.
   */
  latenciaMaximaSegundos: number;
  /** Segundos de vídeo mantidos à frente no VOD. */
  vodBufferSeconds: number;
  label: string;
};

/**
 * Quanto acumular antes de começar e quanta folga manter durante a exibição.
 *
 * Os valores crescem a cada travada (ver `escalate`): a primeira tentativa é
 * otimista, e cada falha compra mais folga em troca de atraso. É o oposto de
 * insistir no mesmo buffer e travar em loop.
 *
 * O `stashInitialSize` é deliberadamente contido, porque ele é pago em tempo
 * de abertura: a uns 4 Mbps, 384 KB levam menos de um segundo para encher e
 * 4 MB levariam oito. Quem protege da engasgada é o colchão, que se forma
 * enquanto assiste e não custa espera nenhuma no início.
 */
/**
 * Perfil para dimensionar BUFFER — não para escolher qualidade.
 *
 * As duas decisões vinham do mesmo `detectConnectionProfile()`, e elas têm
 * custos opostos quando erram:
 *
 *   - errar a QUALIDADE para baixo é definitivo: o provedor não manda stream
 *     adaptativo, então o assinante fica em SD a sessão inteira. Por isso essa
 *     decisão é otimista e ignora `downlink`, que subestima no instante em que
 *     a página abre.
 *   - errar o BUFFER para baixo é travamento. E errar para cima custa só um
 *     pouco mais de espera no início.
 *
 * Ou seja: na dúvida, qualidade alta e buffer generoso. Tratar as duas com o
 * mesmo número fazia uma pagar o preço da outra — foi o que encolheu o buffer
 * no celular quando a detecção de qualidade ficou otimista.
 *
 * `saveData` e rede celular puxam para o conservador porque ali a variação é
 * real: mesmo um 4G rápido oscila de um jeito que fibra não oscila.
 */
export function detectBufferProfile(): ConnectionProfile {
  const info = networkInfo();
  if (!info) return "fair";

  if (info.saveData) return "poor";

  const effective = info.effectiveType ?? "";
  if (effective === "slow-2g" || effective === "2g") return "poor";
  if (effective === "3g") return "poor";

  const downlink = info.downlink;
  if (typeof downlink === "number" && downlink < 5) return "fair";

  // Celular: mesmo rápido, oscila mais que rede fixa. Colchão maior.
  const tipo = (info as { type?: string }).type;
  if (tipo === "cellular") return "fair";

  return "good";
}

export function bufferPlanFor(profile: ConnectionProfile): BufferPlan {
  switch (profile) {
    case "poor":
      return {
        stashInitialSize: 1536 * 1024,
        colchaoSegundos: 10,
        latenciaMaximaSegundos: 20,
        vodBufferSeconds: 60,
        label: "Conexão lenta — acumulando mais vídeo para não travar",
      };
    case "fair":
      return {
        stashInitialSize: 768 * 1024,
        colchaoSegundos: 8,
        latenciaMaximaSegundos: 16,
        vodBufferSeconds: 30,
        label: "Ajustando à sua conexão",
      };
    default:
      return {
        // 384 KB é o padrão da própria mpegts.js, calibrado pelo autor da
        // biblioteca. O player usava 16 KB, vinte e quatro vezes menos.
        stashInitialSize: 384 * 1024,
        colchaoSegundos: 6,
        latenciaMaximaSegundos: 12,
        vodBufferSeconds: 20,
        label: "Carregando",
      };
  }
}

/** Rebaixa o perfil um degrau — chamado a cada travada. */
export function escalate(profile: ConnectionProfile): ConnectionProfile {
  return profile === "good" ? "fair" : "poor";
}
