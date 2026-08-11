/**
 * Modo leve para aparelho fraco.
 *
 * O alvo declarado é: se tem navegador e internet, tem que rodar bem — TV de
 * 2015, Android antigo, celular de entrada. Nesses aparelhos o gargalo não é
 * rede, é DECODIFICAR IMAGEM e COMPOR CAMADA. Uma trilha com 18 pôsteres são
 * 18 decodificações de JPEG em uma CPU sem aceleração; é isso que trava a
 * rolagem, não o HTML.
 *
 * No modo leve o card vira tipografia pura: nada de imagem, nada de desfoque,
 * nada de transição. Perde-se a capa e ganha-se um app que responde — que é o
 * que importa para quem só tem esse aparelho.
 */

export type DeviceTier = "full" | "lite";

const STORAGE_KEY = "hubflix:tier";

/** Marcas de TV e navegadores embarcados que sabidamente sofrem. */
const LEGACY_UA = [
  "smart-tv",
  "smarttv",
  "tizen",
  "web0s",
  "webos",
  "netcast",
  "viera",
  "bravia",
  "aquos",
  "hbbtv",
  "opera tv",
  "googletv",
  "crkey", // Chromecast
  "playstation",
  "xbox",
  "nintendo",
];

/**
 * Decide o nível do aparelho.
 *
 * A escolha manual do usuário sempre vence — quem sabe que a TV é ruim não
 * precisa que um teste automático concorde.
 */
export function detectTier(): DeviceTier {
  if (typeof window === "undefined") return "full";

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "lite" || saved === "full") return saved;
  } catch {
    // localStorage bloqueado (modo privado em WebView antigo)
  }

  const ua = navigator.userAgent.toLowerCase();
  if (LEGACY_UA.some((needle) => ua.includes(needle))) return "lite";

  // `deviceMemory` em GB; 2 GB ou menos é aparelho de entrada
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof memory === "number" && memory <= 2) return "lite";

  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores > 0 && cores <= 2) return "lite";

  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  ).connection;
  if (connection?.saveData) return "lite";
  if (connection?.effectiveType === "2g" || connection?.effectiveType === "slow-2g") {
    return "lite";
  }

  // Ausência de APIs modernas denuncia navegador antigo
  if (typeof window.IntersectionObserver === "undefined") return "lite";

  return "full";
}

export function saveTier(tier: DeviceTier) {
  try {
    window.localStorage.setItem(STORAGE_KEY, tier);
  } catch {
    /* sem persistência, vale só nesta sessão */
  }
}
