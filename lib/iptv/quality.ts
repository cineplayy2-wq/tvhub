/**
 * Variantes de qualidade do mesmo canal.
 *
 * O provedor não manda um stream adaptativo: manda o mesmo canal repetido, uma
 * linha por qualidade, distinguidas só pelo sufixo do nome — "GLOBO SP SD",
 * "GLOBO SP HD", "GLOBO SP FHD²", "GLOBO SP UHD". São sete linhas para a Globo
 * de São Paulo. Como não existe troca de faixa dentro do stream, escolher a
 * qualidade certa para a conexão é a única forma de adaptação possível aqui.
 *
 * O expoente (², ³) é o provedor numerando servidores diferentes para a mesma
 * qualidade, não uma qualidade nova.
 */

import type { ConnectionProfile } from "@/lib/playback/connection";

export type NivelQualidade = "SD" | "HD" | "FHD" | "4K";

export type VarianteQualidade = {
  id: string;
  name: string;
  streamUrl: string;
  nivel: NivelQualidade;
};

/**
 * Sufixo de qualidade no fim do nome, possivelmente repetido
 * ("CANAL HD²", "CANAL FHD", "CANAL H265").
 */
const SUFIXO_QUALIDADE = /(?:[\s\-|]*(?:FHD|UHD|4K|HD|SD|H\.?265|HEVC)[¹²³\d]?)+\s*$/i;

/** Nome sem o marcador de qualidade — é o que agrupa as variantes. */
export function nomeBaseDoCanal(nome: string): string {
  const semSufixo = nome.replace(SUFIXO_QUALIDADE, "").trimEnd();
  return semSufixo || nome.trim();
}

/** Compara nomes ignorando caixa e espaço repetido (o acervo tem "GLOBO  SP"). */
export function mesmaBase(a: string, b: string): boolean {
  const normalizar = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  return normalizar(a) === normalizar(b);
}

const ORDEM: Record<NivelQualidade, number> = { SD: 1, HD: 2, FHD: 3, "4K": 4 };

export function ordemDe(nivel: NivelQualidade): number {
  return ORDEM[nivel];
}

/**
 * Nível a partir do campo `quality` do banco, com o nome como reserva.
 *
 * H265 e HEVC são codec, não resolução, mas na prática o provedor só usa esse
 * sufixo nas linhas de alta definição — por isso entram como FHD.
 */
export function nivelDe(quality: string | null, nome: string): NivelQualidade {
  const alvo = `${quality ?? ""} ${nome}`.toUpperCase();
  if (/\b(4K|UHD)\b/.test(alvo)) return "4K";
  if (/\bFHD\b/.test(alvo) || /H\.?265|HEVC/.test(alvo)) return "FHD";
  if (/\bSD\b/.test(alvo)) return "SD";
  return "HD";
}

/**
 * Melhor qualidade que a conexão aguenta.
 *
 * O teto é FHD mesmo em conexão boa: 4K de canal ao vivo passa de 20 Mbps e
 * não cabe na maioria das casas, então fica só na escolha manual de quem
 * quiser. Não havendo o nível ideal, cai para o mais alto abaixo dele, e só
 * então sobe — é melhor entregar imagem menor do que entregar travando.
 */
export function qualidadeIdealPara(
  profile: ConnectionProfile,
  variantes: VarianteQualidade[],
): number {
  if (variantes.length === 0) return -1;

  const teto: NivelQualidade =
    profile === "poor" ? "SD" : profile === "fair" ? "HD" : "FHD";

  const abaixoOuIgual = variantes
    .filter((v) => ordemDe(v.nivel) <= ordemDe(teto))
    .sort((a, b) => ordemDe(b.nivel) - ordemDe(a.nivel));

  if (abaixoOuIgual.length > 0) {
    return variantes.indexOf(abaixoOuIgual[0]);
  }

  const maisLeve = [...variantes].sort((a, b) => ordemDe(a.nivel) - ordemDe(b.nivel))[0];
  return variantes.indexOf(maisLeve);
}

/**
 * Uma linha por nível, da mais leve para a mais pesada.
 *
 * Quando o mesmo nível aparece várias vezes (HD, HD², HD³), fica a primeira:
 * são servidores alternativos do provedor, e a lista já vem na ordem de
 * preferência dele. As demais continuam servindo de reserva no failover.
 */
export function umaPorNivel(variantes: VarianteQualidade[]): VarianteQualidade[] {
  const porNivel = new Map<NivelQualidade, VarianteQualidade>();
  for (const v of variantes) {
    if (!porNivel.has(v.nivel)) porNivel.set(v.nivel, v);
  }
  return [...porNivel.values()].sort((a, b) => ordemDe(a.nivel) - ordemDe(b.nivel));
}
