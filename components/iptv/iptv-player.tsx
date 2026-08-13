"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Gauge,
  ListVideo,
  Lock,
  Maximize,
  Minimize,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Unlock,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { telaAnterior } from "./nav-history";
import { cleanMediaTitle, cn } from "@/lib/utils";

/**
 * Player de IPTV.
 *
 * O defeito que esta versão conserta: o player abandonava uma fonte BOA.
 *
 * A versão anterior tratava o evento `waiting` como sentença de morte —
 * quinze segundos engasgado e ela pulava para a próxima fonte da lista.
 * Só que `waiting` no começo de um canal ao vivo é o comportamento NORMAL:
 * o navegador está enchendo o buffer. Num 4G de celular esse enchimento passa
 * de quinze segundos com frequência. O que acontecia então era isto: a fonte
 * certa era descartada no meio do carregamento, o player percorria toda a
 * lista de reservas (que costuma ser pior), dava duas voltas e terminava em
 * "não consegui abrir". No computador, com fibra, o buffer enchia antes do
 * prazo e o mesmo canal abria — daí "funciona no PC e no celular não".
 *
 * A regra agora é outra: o que decide se uma fonte está morta não é o relógio,
 * é o PROGRESSO. Um vigia mede o fim do buffer a cada segundo; enquanto ele
 * cresce, a fonte está viva e ninguém a interrompe, demore o que demorar.
 * Só quando nada avança por vários segundos seguidos é que se troca de fonte.
 *
 * As outras três regras desta versão:
 *
 * - O motor nasce de UMA fonte e só é recriado quando a fonte muda de verdade.
 *   Estado de tela e controles passam por refs e nunca tocam no motor.
 * - Começa sempre MUDO. Navegador de celular recusa autoplay com som, e a
 *   recusa vem como exceção — o vídeo simplesmente não começava. Mudo ele
 *   sempre começa, e o som volta no primeiro toque.
 * - Nada toca fora da proxy. O site é https e a lista do provedor é http:
 *   apontar o `<video>` para a URL crua é conteúdo misto, que o navegador de
 *   celular bloqueia sem avisar ninguém.
 */

type TipoDeFonte = "progressivo" | "hls" | "ts" | "flv";
type Fonte = { url: string; tipo: TipoDeFonte; ehBackup: boolean };
type Estado = "carregando" | "tocando" | "pausado" | "engasgado" | "erro";

/** Passagens completas pela lista de fontes antes de desistir de vez. */
const MAX_PASSAGENS_FONTES = 2;

/**
 * Silêncio tolerado antes de considerar a fonte morta (ms).
 *
 * "Silêncio" aqui é literal: nem o buffer cresceu, nem o relógio do vídeo
 * andou. Enquanto qualquer um dos dois se mexe, o prazo é zerado — é por isso
 * que ele pode ser generoso sem travar a experiência. Uma fonte que responde
 * 404 nem chega aqui: a biblioteca dispara erro fatal em menos de um segundo.
 *
 * O prazo antes do primeiro quadro é maior porque é onde mora a espera real:
 * conexão, manifesto, primeiros segmentos e a montagem do buffer inicial.
 */
const SILENCIO_ANTES_DO_PRIMEIRO_QUADRO_MS = 22_000;
const SILENCIO_DEPOIS_DE_TOCAR_MS = 18_000;

/**
 * Buffer do canal ao vivo, em segundos.
 *
 * O pedido era "no mínimo 10, pode ir a 20, o importante é não travar". É a
 * troca certa para IPTV: atrasar a imagem alguns segundos custa pouco em canal
 * (ninguém compara com o relógio) e é o que absorve a oscilação do 4G. Sem essa
 * folga, cada engasgo da rede vira congelamento na tela.
 */
const BUFFER_LIVE_ALVO = 14;
const BUFFER_LIVE_MAX = 22;

/**
 * Contêineres que o navegador toca sozinho, direto no `<video>`.
 *
 * MKV e AVI NÃO estão aqui, e não é esquecimento: nenhum navegador de mesa ou
 * celular decodifica Matroska ou AVI. Mesmo quando o vídeo dentro deles é
 * H.264 — que o navegador sabe decodificar —, o contêiner não é reconhecido e
 * o arquivo não abre. Não existe configuração que resolva isso no cliente;
 * resolver exigiria reempacotar no servidor, que é trabalho de CPU que esta
 * VPS não tem sobrando.
 *
 * O que dá para fazer, e é o que `adicionar` faz abaixo, é tentar o irmão
 * `.mp4` do mesmo título antes de aceitar a derrota — a maioria dos provedores
 * publica os dois.
 */
const CONTAINER_NATIVO = /\.(mp4|m4v|webm|mov)(\?|$)/i;
const CONTAINER_SEM_SUPORTE = /\.(mkv|avi|wmv|flv|mpg|mpeg|divx)(\?|$)/i;

function montarFontes(principal: string, alternativas: string[]): Fonte[] {
  const fontes: Fonte[] = [];

  const adicionar = (bruta: string, ehBackup: boolean) => {
    if (!bruta) return;

    // FLV tem motor próprio: a mpegts.js também desempacota FLV, e é a única
    // forma de tocar esse formato num navegador desde a morte do Flash.
    if (/\.flv(\?|$)/i.test(bruta)) {
      fontes.push({ url: bruta, tipo: "flv", ehBackup });
      fontes.push({
        url: bruta.replace(/\.flv(\?|$)/i, ".mp4$1"),
        tipo: "progressivo",
        ehBackup,
      });
      return;
    }

    if (CONTAINER_SEM_SUPORTE.test(bruta)) {
      // O irmão .mp4 vem PRIMEIRO: é o único com chance real de tocar.
      // `$2` e não `$1`: o grupo 1 é a extensão, o 2 é o "?" ou o fim da URL.
      fontes.push({
        url: bruta.replace(CONTAINER_SEM_SUPORTE, ".mp4$2"),
        tipo: "progressivo",
        ehBackup,
      });
      // A original fica como última tentativa — alguns provedores servem MP4
      // sob nome .mkv, e nesse caso o navegador olha o conteúdo e aceita.
      fontes.push({ url: bruta, tipo: "progressivo", ehBackup });
      return;
    }

    if (CONTAINER_NATIVO.test(bruta)) {
      fontes.push({ url: bruta, tipo: "progressivo", ehBackup });
      return;
    }

    if (/\.ts(\?|$)/i.test(bruta)) {
      // A URL que o provedor deu vem PRIMEIRO.
      //
      // Antes o player pedia `.m3u8` antes do `.ts` que estava no cadastro,
      // apostando em ganhar troca de faixa. Em provedor que não publica HLS
      // isso é um 404 garantido em TODA abertura de canal: round-trip perdido,
      // segundos a mais para o primeiro quadro e uma conexão desperdiçada.
      // Tentar o que o provedor declarou é mais rápido e erra menos.
      fontes.push({ url: bruta, tipo: "ts", ehBackup });
      fontes.push({ url: bruta.replace(/\.ts(\?|$)/i, ".m3u8$1"), tipo: "hls", ehBackup });
      return;
    }

    if (/\.m3u8(\?|$)/i.test(bruta)) {
      fontes.push({ url: bruta, tipo: "hls", ehBackup });
      fontes.push({ url: bruta.replace(/\.m3u8(\?|$)/i, ".ts$1"), tipo: "ts", ehBackup });
      return;
    }

    // Sem extensão (padrão Xtream). Aqui o HLS vem primeiro de propósito: é o
    // formato em que o provedor costuma oferecer mais de uma resolução.
    fontes.push({ url: `${bruta}.m3u8`, tipo: "hls", ehBackup });
    fontes.push({ url: `${bruta}.ts`, tipo: "ts", ehBackup });
  };

  adicionar(principal, false);
  for (const alt of alternativas) adicionar(alt, true);

  const vistas = new Set<string>();
  return fontes.filter((f) => {
    const chave = `${f.tipo}:${f.url}`;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

/**
 * Tudo passa pela proxy — não existe caminho alternativo.
 *
 * A lista do provedor é servida em http e o site roda em https. Um `<video>`
 * apontado direto para lá é bloqueado como conteúdo misto, e o bloqueio é
 * silencioso: sem erro no console do usuário, sem evento, só uma tela preta.
 */
function pelaProxy(url: string) {
  return `/api/iptv/stream?url=${encodeURIComponent(url)}`;
}

function tempo(seg: number) {
  if (!Number.isFinite(seg) || seg < 0) return "0:00";
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = Math.floor(seg % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** Fim do trecho já baixado. É o número que prova que a fonte está viva. */
function fimDoBuffer(video: HTMLVideoElement) {
  const b = video.buffered;
  return b.length > 0 ? b.end(b.length - 1) : 0;
}

type Nivel = { id: number; altura: number; rotulo: string };

export function IptvPlayer({
  streamUrl,
  channelName,
  channelId,
  isLive = true,
  alternativeStreams = [],
  initialPosition = 0,
  episodes = [],
}: {
  streamUrl: string;
  channelName: string;
  channelId?: string;
  isLive?: boolean;
  alternativeStreams?: string[];
  initialPosition?: number;
  episodes?: Array<{
    id: string;
    name: string;
    isCurrent: boolean;
    isWatched?: boolean;
    season?: number;
    episodeNum?: number;
  }>;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);

  const fontes = useMemo(
    () => montarFontes(streamUrl, alternativeStreams.filter(Boolean)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [streamUrl, alternativeStreams.join("|")],
  );

  const [indice, setIndice] = useState(0);
  const [passagem, setPassagem] = useState(1);
  const [geracao, setGeracao] = useState(0);
  const [estado, setEstado] = useState<Estado>("carregando");

  // Nasce mudo. Ver a nota no cabeçalho: é o que garante que o vídeo comece
  // sozinho no celular. O som volta no primeiro toque do usuário.
  const [mudo, setMudo] = useState(true);
  const [pediuSom, setPediuSom] = useState(false);
  const [volume, setVolume] = useState(1);
  const [cheia, setCheia] = useState(false);
  const [travado, setTravado] = useState(false);
  const [mostrarControles, setMostrarControles] = useState(true);
  const [mostrarEpisodios, setMostrarEpisodios] = useState(false);
  const [mostrarQualidade, setMostrarQualidade] = useState(false);
  const [agora, setAgora] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [bufferado, setBufferado] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  const [niveis, setNiveis] = useState<Nivel[]>([]);
  const [nivelAtual, setNivelAtual] = useState(-1);

  const indiceRef = useRef(0);
  indiceRef.current = indice;
  const totalRef = useRef(0);
  totalRef.current = fontes.length;
  const passagemRef = useRef(1);
  passagemRef.current = passagem;
  const posicaoInicialRef = useRef(initialPosition);
  posicaoInicialRef.current = initialPosition;
  const jaRetomouRef = useRef(false);
  /** O usuário já pediu som? O motor consulta isto ao (re)iniciar. */
  const pediuSomRef = useRef(false);
  pediuSomRef.current = pediuSom;
  const timerControles = useRef<ReturnType<typeof setTimeout>>();
  const timerAviso = useRef<ReturnType<typeof setTimeout>>();
  const toqueRef = useRef<{ t: number; x: number }>({ t: 0, x: 0 });

  /** Ponteiro para o motor ativo, para o seletor de qualidade alcançá-lo. */
  const motorRef = useRef<{ trocarNivel: (id: number) => void } | null>(null);

  /**
   * Verdadeiro quando o `<video>` está sozinho — arquivo progressivo ou HLS
   * nativo do Safari antigo. Muda o significado do evento `error`: sem
   * biblioteca para se recuperar, ele é sentença e vale trocar de fonte na
   * hora, em vez de esperar o vigia de progresso estourar o prazo.
   */
  const semBibliotecaRef = useRef(false);

  const fonte = fontes[Math.min(indice, Math.max(0, fontes.length - 1))];

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    if (timerAviso.current) clearTimeout(timerAviso.current);
    timerAviso.current = setTimeout(() => setAviso(null), 1400);
  }, []);

  /** Failover: próxima fonte, próxima passagem, ou erro definitivo. */
  const avancar = useCallback(() => {
    /**
     * Guarda onde o filme estava ANTES de trocar de fonte.
     *
     * `posicaoInicialRef` nasce com a posição salva no banco, que é de quando
     * a página abriu. Se a troca acontecesse no minuto 45, a fonte nova
     * recomeçava de onde a sessão tinha começado — na prática, do zero.
     * Atualizando aqui, o failover é invisível: o filme continua de onde
     * parou, em outro servidor.
     *
     * Só vale para VOD. Em canal ao vivo não existe posição para retomar: a
     * transmissão está onde está.
     */
    const video = videoRef.current;
    if (!isLive && video && video.currentTime > 10) {
      posicaoInicialRef.current = video.currentTime;
      jaRetomouRef.current = false;
    }

    const proximo = indiceRef.current + 1;
    if (proximo < totalRef.current) {
      setEstado("carregando");
      setIndice(proximo);
    } else if (passagemRef.current < MAX_PASSAGENS_FONTES) {
      setPassagem((p) => p + 1);
      setIndice(0);
      setEstado("carregando");
      setGeracao((g) => g + 1);
    } else {
      setEstado("erro");
    }
  }, [isLive]);

  const avancarRef = useRef(avancar);
  avancarRef.current = avancar;

  // ==========================================================
  // MOTOR
  // ==========================================================
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !fonte) return;

    let vivo = true;
    let motor: { destruir: () => void } | null = null;

    const alvo = pelaProxy(fonte.url);
    jaRetomouRef.current = false;

    setNiveis([]);
    setNivelAtual(-1);
    semBibliotecaRef.current = fonte.tipo === "progressivo";

    const desistir = () => {
      if (!vivo) return;
      vivo = false;
      avancarRef.current();
    };

    /**
     * Autoplay que não depende de permissão.
     *
     * O elemento já está mudo desde a montagem; isto só reafirma antes do play
     * porque uma troca de fonte recria o elemento de mídia em alguns
     * navegadores e o estado pode voltar ao padrão.
     */
    const comecar = () => {
      if (!vivo) return;
      // Só força o mudo enquanto o usuário ainda não pediu som. Depois que ele
      // pediu, uma troca de fonte não pode devolver o vídeo mudo — o gesto que
      // liberou o autoplay já aconteceu e vale para o resto da sessão.
      if (!pediuSomRef.current) video.muted = true;
      video.play().catch(() => {
        // Nem mudo tocou: só o toque do usuário resolve. A tela de "pausado"
        // já oferece o botão gigante de play.
        setEstado("pausado");
      });
    };

    if (fonte.tipo === "progressivo") {
      const aoCanPlay = () => {
        video.removeEventListener("canplay", aoCanPlay);
        // Retoma antes de tocar: assim não começa do zero para depois pular.
        const posicao = posicaoInicialRef.current;
        if (posicao > 10 && !jaRetomouRef.current) {
          jaRetomouRef.current = true;
          try {
            video.currentTime = posicao;
          } catch {}
        }
        comecar();
      };

      video.addEventListener("canplay", aoCanPlay);
      video.preload = "auto";
      video.src = alvo;
      video.load();

      motor = {
        destruir: () => video.removeEventListener("canplay", aoCanPlay),
      };
    } else if (fonte.tipo === "hls") {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (!vivo) return;

          if (!Hls.isSupported()) {
            // iPhone antigo: sobra o HLS nativo do próprio Safari. Sem controle
            // de buffer nem troca de faixa, mas toca — e continua pela proxy.
            if (
              video.canPlayType("application/vnd.apple.mpegurl") ||
              video.canPlayType("application/x-mpegURL")
            ) {
              semBibliotecaRef.current = true;
              const aoCanPlay = () => {
                video.removeEventListener("canplay", aoCanPlay);
                comecar();
              };
              video.addEventListener("canplay", aoCanPlay);
              video.src = alvo;
              video.load();
              motor = {
                destruir: () => video.removeEventListener("canplay", aoCanPlay),
              };
              return;
            }
            desistir();
            return;
          }

          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,

            /**
             * iOS 17.1+ expõe ManagedMediaSource. Com esta opção o hls.js
             * assume o comando no iPhone em vez de entregar para o HLS nativo
             * — e aí valem o buffer e a troca de faixa configurados abaixo,
             * que no caminho nativo simplesmente não existem.
             */
            preferManagedMediaSource: true,

            /**
             * Sempre começa na faixa mais baixa.
             *
             * O primeiro quadro é o que a pessoa está esperando; buscá-lo em
             * 1080p numa rede que ainda não foi medida é o jeito mais rápido de
             * transformar "abrir o canal" em dez segundos de tela preta. O ABR
             * sobe sozinho assim que tem medição confiável.
             */
            startLevel: 0,
            abrEwmaDefaultEstimate: 700_000,
            abrBandWidthFactor: 0.9,
            abrBandWidthUpFactor: 0.6,
            capLevelToPlayerSize: true,
            startFragPrefetch: true,

            /**
             * VOD retoma direto na posição certa — sem isto o hls.js baixa
             * desde o começo do arquivo para só então buscar o ponto.
             *
             * Lê a REF, não a propriedade: a propriedade é a posição de quando
             * a página abriu, e o `avancar` atualiza a ref com o ponto atual
             * antes de trocar de fonte. Usando a propriedade, uma troca no
             * minuto 45 recomeçava o filme lá no começo da sessão.
             */
            startPosition:
              !isLive && posicaoInicialRef.current > 10 ? posicaoInicialRef.current : -1,

            // Canal ao vivo: fica atrás da borda de propósito (ver a constante).
            liveSyncDuration: isLive ? BUFFER_LIVE_ALVO : undefined,
            liveMaxLatencyDuration: isLive ? BUFFER_LIVE_MAX + 12 : undefined,

            /**
             * Furo tolerado no buffer, em segundos.
             *
             * Eu tinha colocado 0.8 sem base. O padrão da biblioteca é 0.1, e
             * o projeto tem relato de travamento justamente com valores altos:
             * quanto maior o furo aceito, mais tempo o player espera parado
             * antes de saltar por cima dele. 0.3 é um meio-termo defensável
             * para lista de IPTV, onde emenda de segmento é irregular, sem
             * chegar perto da faixa que causa parada.
             */
            maxBufferHole: 0.3,
            nudgeOffset: 0.15,
            /** Mais empurrões que o padrão (3) antes de dar erro fatal. */
            nudgeMaxRetry: 6,
            highBufferWatchdogPeriod: 2,

            maxBufferLength: isLive ? BUFFER_LIVE_MAX + 10 : 40,
            maxMaxBufferLength: isLive ? 70 : 120,
            backBufferLength: isLive ? 20 : 30,

            manifestLoadingTimeOut: 14_000,
            manifestLoadingMaxRetry: 3,
            levelLoadingTimeOut: 12_000,
            fragLoadingTimeOut: 20_000,
            fragLoadingMaxRetry: 4,
          });

          hls.loadSource(alvo);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, (_e, dados) => {
            const lista: Nivel[] = (dados.levels ?? [])
              .map((nivel, id) => ({
                id,
                altura: nivel.height ?? 0,
                rotulo: nivel.height ? `${nivel.height}p` : `Faixa ${id + 1}`,
              }))
              .filter((n) => n.altura > 0);
            if (lista.length > 1) setNiveis(lista);
            comecar();
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (_e, dados) => {
            setNivelAtual(hls.autoLevelEnabled ? -1 : dados.level);
          });

          hls.on(Hls.Events.ERROR, (_evento, dados) => {
            // Erro não fatal é rotina: fragmento que falhou e vai ser repetido.
            // Desistir aqui era jogar fora fonte boa por um soluço de rede.
            if (!dados.fatal) return;

            if (dados.type === Hls.ErrorTypes.MEDIA_ERROR) {
              try {
                hls.recoverMediaError();
                return;
              } catch {}
            }
            if (dados.type === Hls.ErrorTypes.NETWORK_ERROR) {
              // Já esgotou as tentativas internas; uma última recarga antes de
              // trocar de fonte cobre queda momentânea do servidor.
              try {
                hls.startLoad();
                return;
              } catch {}
            }
            desistir();
          });

          motor = {
            destruir: () => {
              try {
                hls.detachMedia();
                hls.destroy();
              } catch {}
            },
          };

          motorRef.current = {
            trocarNivel: (id: number) => {
              hls.nextLevel = id;
              hls.loadLevel = id;
              setNivelAtual(id);
            },
          };
        })
        .catch(desistir);
    } else {
      import("mpegts.js")
        .then((mod) => {
          if (!vivo) return;
          const mpegts = mod.default ?? mod;

          if (!mpegts.isSupported()) {
            desistir();
            return;
          }

          const player = mpegts.createPlayer(
            { type: fonte.tipo === "flv" ? "flv" : "mpegts", isLive, url: alvo },
            {
              enableWorker: false,
              enableStashBuffer: true,
              stashInitialSize: 384 * 1024,
              lazyLoad: false,

              /**
               * Limpeza automática do buffer de mídia. LIGADA.
               *
               * O padrão da biblioteca é `false`, e é o que fazia canal
               * congelar depois de um tempo longo ligado. Sem limpeza, o
               * SourceBuffer do navegador acumula TUDO o que já passou — uma
               * hora de canal são centenas de megabytes. Quando o navegador
               * bate na cota do SourceBuffer, o `appendBuffer` falha e a
               * imagem para. Não é a rede nem o provedor: é memória, e por
               * isso o congelamento vinha "do nada", sempre depois de um
               * tempo, e sempre pior nos aparelhos mais fracos.
               *
               * A documentação da mpegts.js recomenda ligar exatamente para
               * transmissões de longa duração, que é o caso de canal ao vivo.
               */
              autoCleanupSourceBuffer: true,
              autoCleanupMaxBackwardDuration: 120,
              autoCleanupMinBackwardDuration: 60,

              /** Evita dessincronizar áudio e vídeo em fluxo com furo. */
              fixAudioTimestampGap: true,

              /**
               * Perseguição de latência DESLIGADA — de propósito.
               *
               * Eu tinha ligado isto achando que controlaria o atraso. Foi
               * erro: a perseguição funciona dando SEEK para a frente no
               * fluxo ao vivo, e seek em MPEG-TS sobre MSE é justamente o que
               * provoca engasgo e reinício de decodificação. Pior: ela come o
               * buffer, que é a única defesa contra oscilação de rede. Ou
               * seja, ligá-la trabalha contra o objetivo de não travar.
               *
               * O preço de deixar desligada é o atraso crescer numa sessão
               * muito longa. É um preço barato: ninguém compara canal com
               * relógio, e travar é o que incomoda.
               */
              liveBufferLatencyChasing: false,
            },
          );

          player.attachMediaElement(video);
          player.load();
          comecar();

          player.on(mpegts.Events.ERROR, desistir);

          motor = {
            destruir: () => {
              try {
                player.destroy();
              } catch {}
            },
          };
        })
        .catch(desistir);
    }

    return () => {
      vivo = false;
      motorRef.current = null;
      motor?.destruir();
      video.removeAttribute("src");
      try {
        video.load();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonte?.url, fonte?.tipo, geracao, isLive]);

  // ==========================================================
  // VIGIA DE PROGRESSO — quem decide se a fonte morreu
  // ==========================================================
  useEffect(() => {
    if (estado === "erro") return;

    const video = videoRef.current;
    if (!video) return;

    let ultimoFim = -1;
    let ultimoTempo = -1;
    let ultimaAtividade = Date.now();
    let jaTocou = false;

    const tique = setInterval(() => {
      const fim = fimDoBuffer(video);
      const t = video.currentTime;

      if (t > 0.1) jaTocou = true;

      // Qualquer sinal de vida serve: buffer crescendo OU relógio andando.
      const avancou = fim > ultimoFim + 0.05 || t > ultimoTempo + 0.05;
      if (avancou) {
        ultimoFim = fim;
        ultimoTempo = t;
        ultimaAtividade = Date.now();
        return;
      }

      /**
       * Pausado não é fonte morta — em nenhuma circunstância.
       *
       * A checagem antes exigia também `estado === "pausado"`, e havia uma
       * fresta: quem pausasse DURANTE um engasgo ficava com o estado em
       * "engasgado" e o vigia derrubava a fonte dezoito segundos depois, com o
       * vídeo parado por vontade da pessoa. O que importa é o elemento estar
       * pausado; o rótulo da tela é secundário.
       */
      if (video.paused) {
        ultimaAtividade = Date.now();
        return;
      }

      const limite = jaTocou
        ? SILENCIO_DEPOIS_DE_TOCAR_MS
        : SILENCIO_ANTES_DO_PRIMEIRO_QUADRO_MS;

      if (Date.now() - ultimaAtividade > limite) {
        clearInterval(tique);
        avancarRef.current();
      }
    }, 1000);

    return () => clearInterval(tique);
  }, [estado, fonte?.url, geracao]);

  // ==========================================================
  // EVENTOS DO ELEMENTO DE VÍDEO — só estado de tela
  // ==========================================================
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const aoTocar = () => {
      setEstado("tocando");
      const posicao = posicaoInicialRef.current;
      if (posicao > 10 && !jaRetomouRef.current) {
        jaRetomouRef.current = true;
        try {
          if (Math.abs(video.currentTime - posicao) > 5) video.currentTime = posicao;
        } catch {}
      }
    };

    const aoPausar = () => setEstado((e) => (e === "erro" ? e : "pausado"));

    /**
     * `waiting` agora só pinta a tela.
     *
     * Era daqui que saía o pulo de fonte, e era esse pulo que quebrava o
     * celular: encher buffer demora, demorar não é defeito. Quem decide
     * abandonar a fonte é o vigia de progresso, que olha se algo se mexeu.
     */
    const aoEsperar = () => setEstado((e) => (e === "erro" ? e : "engasgado"));

    const aoErrar = () => {
      // Erro do elemento só é definitivo quando NÃO há biblioteca cuidando do
      // fluxo. Com hls.js ou mpegts.js no comando, eles se recuperam sozinhos
      // e o vigia de progresso cobre o caso de não conseguirem.
      if (semBibliotecaRef.current) avancarRef.current();
    };

    const aoProgredir = () => {
      setAgora(video.currentTime);
      setBufferado(fimDoBuffer(video));
      if (Number.isFinite(video.duration)) setDuracao(video.duration);
    };

    const aoVolume = () => {
      setMudo(video.muted);
      setVolume(video.volume);
    };

    video.addEventListener("playing", aoTocar);
    video.addEventListener("pause", aoPausar);
    video.addEventListener("waiting", aoEsperar);
    video.addEventListener("stalled", aoEsperar);
    video.addEventListener("error", aoErrar);
    video.addEventListener("timeupdate", aoProgredir);
    video.addEventListener("progress", aoProgredir);
    video.addEventListener("volumechange", aoVolume);

    return () => {
      video.removeEventListener("playing", aoTocar);
      video.removeEventListener("pause", aoPausar);
      video.removeEventListener("waiting", aoEsperar);
      video.removeEventListener("stalled", aoEsperar);
      video.removeEventListener("error", aoErrar);
      video.removeEventListener("timeupdate", aoProgredir);
      video.removeEventListener("progress", aoProgredir);
      video.removeEventListener("volumechange", aoVolume);
    };
  }, [fonte?.tipo]);

  /** Salva onde o assinante parou. Só VOD tem posição que faça sentido. */
  useEffect(() => {
    if (isLive) return;
    const t = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.currentTime < 5) return;
      fetch("/api/iptv/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleName: channelName,
          channelId: channelId ?? "",
          positionSeconds: Math.floor(video.currentTime),
          durationSeconds: Math.floor(video.duration || 0),
        }),
      }).catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [channelName, channelId, isLive]);

  useEffect(() => {
    const aoTrocarTela = () => {
      setCheia(
        Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement),
      );
    };
    document.addEventListener("fullscreenchange", aoTrocarTela);
    document.addEventListener("webkitfullscreenchange", aoTrocarTela);
    return () => {
      document.removeEventListener("fullscreenchange", aoTrocarTela);
      document.removeEventListener("webkitfullscreenchange", aoTrocarTela);
    };
  }, []);

  // ==========================================================
  // CONTROLES
  // ==========================================================
  const revelarControles = useCallback(() => {
    setMostrarControles(true);
    if (timerControles.current) clearTimeout(timerControles.current);
    timerControles.current = setTimeout(() => setMostrarControles(false), 3800);
  }, []);

  const alternarPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  /** Devolve o som. É o gesto do usuário que o navegador estava esperando. */
  const ligarSom = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    if (video.volume === 0) video.volume = 1;
    setPediuSom(true);
    void video.play().catch(() => {});
  }, []);

  const alternarMudo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted) setPediuSom(true);
  }, []);

  const pular = useCallback(
    (segundos: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.max(
        0,
        Math.min(video.duration || Number.MAX_SAFE_INTEGER, video.currentTime + segundos),
      );
      mostrarAviso(segundos > 0 ? `+${segundos}s` : `${segundos}s`);
    },
    [mostrarAviso],
  );

  const alternarTelaCheia = useCallback(() => {
    const caixa = caixaRef.current;
    const video = videoRef.current;
    if (!caixa) return;

    const estaCheia =
      document.fullscreenElement || (document as any).webkitFullscreenElement;

    if (!estaCheia) {
      const pedir =
        caixa.requestFullscreen?.bind(caixa) ??
        (caixa as any).webkitRequestFullscreen?.bind(caixa);

      if (pedir) {
        Promise.resolve(pedir())
          .then(() => {
            const orientacao = screen.orientation as unknown as {
              lock?: (o: string) => Promise<void>;
            };
            orientacao?.lock?.("landscape").catch(() => {});
          })
          .catch(() => {});
        return;
      }

      // iPhone só oferece tela cheia do próprio elemento de vídeo.
      (video as unknown as { webkitEnterFullscreen?: () => void })?.webkitEnterFullscreen?.();
      return;
    }

    try {
      (screen.orientation as unknown as { unlock?: () => void })?.unlock?.();
    } catch {}
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else (document as any).webkitExitFullscreen?.();
  }, []);

  const tentarDeNovo = () => {
    setPassagem(1);
    setIndice(0);
    setEstado("carregando");
    setGeracao((g) => g + 1);
  };

  /** Toque na área do vídeo: um toque revela controles, dois pulam 10s. */
  const aoTocarTela = (evento: React.MouseEvent | React.TouchEvent) => {
    if (travado) {
      revelarControles();
      return;
    }

    const agoraMs = Date.now();
    const alvo = caixaRef.current;
    const x =
      "touches" in evento && evento.touches.length > 0
        ? evento.touches[0].clientX
        : (evento as React.MouseEvent).clientX;

    const anterior = toqueRef.current;
    toqueRef.current = { t: agoraMs, x };

    // Duplo toque só faz sentido onde existe linha do tempo.
    if (!isLive && agoraMs - anterior.t < 300 && Math.abs(x - anterior.x) < 60) {
      const largura = alvo?.clientWidth ?? 0;
      const relativo = alvo ? x - alvo.getBoundingClientRect().left : 0;
      pular(relativo < largura / 2 ? -10 : 10);
      toqueRef.current = { t: 0, x: 0 };
      return;
    }

    revelarControles();
  };

  /** Atalhos de teclado — computador e TV com controle. */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && /input|textarea|select/i.test(alvo.tagName)) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          alternarPlay();
          break;
        case "ArrowRight":
          if (!isLive) pular(10);
          break;
        case "ArrowLeft":
          if (!isLive) pular(-10);
          break;
        case "m":
          alternarMudo();
          break;
        case "f":
          alternarTelaCheia();
          break;
        case "Escape":
          if (!document.fullscreenElement) router.back();
          break;
      }
      revelarControles();
    };

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [alternarPlay, alternarMudo, alternarTelaCheia, pular, revelarControles, isLive, router]);

  const voltar = () => {
    if (telaAnterior()) router.back();
    else router.push("/tv");
  };

  const controlesVisiveis = (mostrarControles || estado === "pausado") && !travado;
  const percentual = duracao > 0 ? (agora / duracao) * 100 : 0;
  const percentualBuffer = duracao > 0 ? Math.min(100, (bufferado / duracao) * 100) : 0;

  return (
    <div
      ref={caixaRef}
      className="group/player relative h-full w-full select-none overflow-hidden bg-black"
      onMouseMove={revelarControles}
      onTouchStart={aoTocarTela}
      onClick={aoTocarTela}
    >
      <video
        ref={videoRef}
        className="h-full w-full bg-black object-contain"
        playsInline
        muted
        autoPlay
        controls={false}
        {...{ "webkit-playsinline": "true", "x-webkit-airplay": "allow" }}
      />

      {/* Aviso passageiro do gesto (+10s, -10s) */}
      {aviso && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <span className="rounded-2xl bg-black/70 px-5 py-3 text-lg font-black text-white backdrop-blur-md">
            {aviso}
          </span>
        </div>
      )}

      {/* CARREGANDO */}
      {(estado === "carregando" || estado === "engasgado") && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 p-6 text-center backdrop-blur-[2px]">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-white/15 border-t-accent" />
          <p className="mt-4 text-sm font-bold text-white">
            {estado === "engasgado" ? "Recuperando a transmissão…" : "Abrindo…"}
          </p>
          <p className="mt-1 max-w-xs text-[11px] font-medium text-white/55">
            {fonte?.ehBackup
              ? "Conectado ao sinal de reserva"
              : isLive
                ? `Montando ${BUFFER_LIVE_ALVO}s de folga para não travar`
                : "Começando em qualidade leve e subindo"}
          </p>
        </div>
      )}

      {/* ERRO */}
      {estado === "erro" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center">
          <div className="mb-4 rounded-full border border-rose-500/20 bg-rose-500/10 p-4">
            <RefreshCw className="h-8 w-8 text-rose-400" />
          </div>
          <h3 className="text-lg font-bold text-white">Não consegui abrir este conteúdo</h3>
          <p className="mt-1 max-w-sm text-xs text-white/60">
            Tentei {fontes.length} {fontes.length === 1 ? "fonte" : "fontes"}, incluindo a lista
            de reserva. O servidor do provedor não respondeu.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={tentarDeNovo}
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              <RefreshCw className="h-5 w-5" />
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={voltar}
              className="flex min-h-[44px] items-center rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* SOM DESLIGADO — o preço de garantir o autoplay é avisar disto */}
      {mudo && !pediuSom && estado === "tocando" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            ligarSom();
          }}
          className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-xl transition-transform active:scale-95"
        >
          <VolumeX className="h-4 w-4" />
          Toque para ativar o som
        </button>
      )}

      {/* Cadeado: sai da frente quando a tela está travada */}
      {travado && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setTravado(false);
          }}
          aria-label="Destravar controles"
          className="absolute bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md"
        >
          <Lock className="h-5 w-5" />
        </button>
      )}

      {/* CONTROLES */}
      <div
        className={cn(
          "absolute inset-0 z-10 flex flex-col justify-between p-4 md:p-6",
          "bg-gradient-to-t from-black/85 via-transparent to-black/60 transition-opacity duration-300",
          controlesVisiveis ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topo */}
        <div className="flex items-center gap-3 text-white">
          <button
            type="button"
            onClick={voltar}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-white/10"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>

          <span className="max-w-[220px] truncate text-sm font-extrabold drop-shadow-md sm:max-w-[380px] md:max-w-[560px] md:text-base">
            {cleanMediaTitle(channelName)}
          </span>

          {isLive && (
            <span className="flex items-center gap-1.5 rounded-full bg-rose-600/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Ao vivo
            </span>
          )}

          <button
            type="button"
            onClick={() => setTravado(true)}
            aria-label="Travar controles"
            className="ml-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-white/10"
          >
            <Unlock className="h-5 w-5" />
          </button>
        </div>

        {/* Play central quando pausado */}
        {estado === "pausado" && (
          <button
            type="button"
            onClick={alternarPlay}
            aria-label="Reproduzir"
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/90 text-white shadow-2xl transition-transform hover:scale-110 active:scale-95"
          >
            <Play className="ml-1 h-10 w-10" fill="currentColor" />
          </button>
        )}

        {/* Base */}
        <div className="space-y-3">
          {!isLive && duracao > 0 && (
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs tabular-nums text-white/80">{tempo(agora)}</span>

              {/* Trilha com o trecho já baixado atrás do progresso — é o que
                  mostra que o vídeo está carregando mesmo parado. */}
              <div className="relative flex-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white/25"
                    style={{ width: `${percentualBuffer}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-accent"
                    style={{ width: `${percentual}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={duracao}
                  step={1}
                  value={agora}
                  aria-label="Posição do vídeo"
                  onChange={(e) => {
                    const novo = Number(e.target.value);
                    setAgora(novo);
                    if (videoRef.current) videoRef.current.currentTime = novo;
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>

              <span className="font-mono text-xs tabular-nums text-white/60">
                {tempo(duracao)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1 text-white sm:gap-2">
            <button
              type="button"
              onClick={alternarPlay}
              aria-label="Reproduzir ou pausar"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-white/10"
            >
              {estado === "tocando" ? (
                <Pause className="h-7 w-7" />
              ) : (
                <Play className="h-7 w-7" fill="currentColor" />
              )}
            </button>

            {!isLive && (
              <>
                <button
                  type="button"
                  onClick={() => pular(-10)}
                  aria-label="Voltar 10 segundos"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-white/10"
                >
                  <RotateCcw className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => pular(30)}
                  aria-label="Avançar 30 segundos"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-white/10"
                >
                  <RotateCw className="h-6 w-6" />
                </button>
              </>
            )}

            <div className="group/vol flex items-center">
              <button
                type="button"
                onClick={alternarMudo}
                aria-label={mudo ? "Ativar som" : "Silenciar"}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-white/10"
              >
                {mudo || volume === 0 ? (
                  <VolumeX className="h-6 w-6" />
                ) : (
                  <Volume2 className="h-6 w-6" />
                )}
              </button>
              {/* Só no computador: em celular o volume é do aparelho. */}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={mudo ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const video = videoRef.current;
                  if (!video) return;
                  video.volume = v;
                  video.muted = v === 0;
                  if (v > 0) setPediuSom(true);
                }}
                className="hidden h-1 w-0 cursor-pointer accent-accent transition-all duration-300 md:block md:group-hover/vol:w-20"
              />
            </div>

            {niveis.length > 1 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMostrarQualidade((v) => !v)}
                  aria-label="Qualidade do vídeo"
                  className={cn(
                    "flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors",
                    mostrarQualidade ? "bg-primary text-white" : "hover:bg-white/10",
                  )}
                >
                  <Gauge className="h-5 w-5" />
                  <span className="hidden sm:inline">
                    {nivelAtual < 0
                      ? "Auto"
                      : (niveis.find((n) => n.id === nivelAtual)?.rotulo ?? "Auto")}
                  </span>
                </button>

                {mostrarQualidade && (
                  <div className="absolute bottom-[52px] left-0 min-w-[128px] overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 py-1 shadow-2xl backdrop-blur-xl">
                    <button
                      type="button"
                      onClick={() => {
                        motorRef.current?.trocarNivel(-1);
                        setMostrarQualidade(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs font-semibold",
                        nivelAtual < 0 ? "text-accent" : "text-white/80 hover:bg-white/10",
                      )}
                    >
                      Automática
                      {nivelAtual < 0 && <Check className="h-3.5 w-3.5" />}
                    </button>
                    {[...niveis].reverse().map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          motorRef.current?.trocarNivel(n.id);
                          setMostrarQualidade(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs font-semibold",
                          nivelAtual === n.id ? "text-accent" : "text-white/80 hover:bg-white/10",
                        )}
                      >
                        {n.rotulo}
                        {nivelAtual === n.id && <Check className="h-3.5 w-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {episodes.length > 1 && (
              <button
                type="button"
                onClick={() => setMostrarEpisodios((v) => !v)}
                aria-label="Trocar episódio"
                className={cn(
                  "flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors",
                  mostrarEpisodios ? "bg-primary text-white" : "hover:bg-white/10",
                )}
              >
                <ListVideo className="h-5 w-5" />
                <span className="hidden sm:inline">Episódios</span>
              </button>
            )}

            <button
              type="button"
              onClick={alternarTelaCheia}
              aria-label={cheia ? "Sair da tela cheia" : "Tela cheia"}
              className="ml-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-white/10"
            >
              {cheia ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* EPISÓDIOS */}
      {mostrarEpisodios && episodes.length > 0 && (
        <div
          className="absolute bottom-0 right-0 top-0 z-40 flex w-80 max-w-[85vw] flex-col border-l border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h4 className="flex items-center gap-2 text-base font-bold text-white">
              <ListVideo className="h-5 w-5 text-accent" />
              Episódios ({episodes.length})
            </h4>
            <button
              type="button"
              onClick={() => setMostrarEpisodios(false)}
              aria-label="Fechar"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
            {episodes.map((ep) => (
              <button
                key={ep.id}
                type="button"
                onClick={() => {
                  setMostrarEpisodios(false);
                  router.push(`/tv/assistir/${ep.id}`);
                }}
                className={cn(
                  "flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all",
                  ep.isCurrent
                    ? "border-primary bg-primary/25 text-white shadow-lg"
                    : "border-white/5 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-2">
                    {ep.season && ep.episodeNum ? (
                      <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white/90">
                        T{ep.season} E{ep.episodeNum}
                      </span>
                    ) : null}
                    {ep.isCurrent && (
                      <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Tocando
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs font-semibold text-white/90">
                    {cleanMediaTitle(ep.name)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {ep.isWatched && !ep.isCurrent && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      <Check className="h-3 w-3" />
                      Visto
                    </span>
                  )}
                  {ep.isCurrent && <Play className="h-4 w-4 fill-accent text-accent" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
