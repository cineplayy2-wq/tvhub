/**
 * Catálogo de avatares de perfil.
 *
 * São SVGs próprios, servidos de `/public/avatars`, e não fotos baixadas da
 * internet. Três motivos, nesta ordem:
 *
 * 1. Licença. Imagem de banco só entra em produto pago com direito comprado, e
 *    imagem achada solta na web não tem procedência nenhuma.
 * 2. Peso. Cada arquivo tem ~1,4 KB. Os doze juntos pesam menos que uma única
 *    foto de avatar, e a tela de perfis é a primeira coisa que abre depois do
 *    login — é onde o carregamento mais aparece.
 * 3. Nitidez. O mesmo arquivo serve o círculo de 34px da barra do topo e o de
 *    112px da tela de perfis, e ainda a TV. Com bitmap seriam três tamanhos.
 *
 * O `id` é o que vai para o banco (`Profile.avatarUrl` guarda o caminho), e a
 * lista abaixo é a ÚNICA origem aceita — ver `ehAvatarValido`. Sem essa trava,
 * o formulário aceitaria qualquer URL vinda do cliente e viraria um vetor para
 * apontar a imagem do perfil para um host arbitrário.
 */

export type AvatarDoCatalogo = {
  id: string;
  rotulo: string;
  src: string;
  /** Sugerido para perfil infantil (só ordena a lista, não restringe nada). */
  infantil: boolean;
};

export const AVATARES: AvatarDoCatalogo[] = [
  { id: "raposa", rotulo: "Raposa", src: "/avatars/raposa.svg", infantil: true },
  { id: "gato", rotulo: "Gato", src: "/avatars/gato.svg", infantil: true },
  { id: "panda", rotulo: "Panda", src: "/avatars/panda.svg", infantil: true },
  { id: "coruja", rotulo: "Coruja", src: "/avatars/coruja.svg", infantil: false },
  { id: "astronauta", rotulo: "Astronauta", src: "/avatars/astronauta.svg", infantil: false },
  { id: "robo", rotulo: "Robô", src: "/avatars/robo.svg", infantil: true },
  { id: "urso", rotulo: "Urso", src: "/avatars/urso.svg", infantil: true },
  { id: "pinguim", rotulo: "Pinguim", src: "/avatars/pinguim.svg", infantil: true },
  { id: "leao", rotulo: "Leão", src: "/avatars/leao.svg", infantil: false },
  { id: "sapo", rotulo: "Sapo", src: "/avatars/sapo.svg", infantil: true },
  { id: "dino", rotulo: "Dino", src: "/avatars/dino.svg", infantil: true },
  { id: "alien", rotulo: "Alien", src: "/avatars/alien.svg", infantil: false },
];

const CAMINHOS = new Set(AVATARES.map((a) => a.src));

/** Só passa o que está no catálogo. Nunca confiar no que veio do formulário. */
export function ehAvatarValido(src: string | null | undefined): boolean {
  return typeof src === "string" && CAMINHOS.has(src);
}

/**
 * Avatar de quem foi criado antes desta tela existir.
 *
 * Determinístico pelo id do perfil: o mesmo perfil recebe sempre o mesmo
 * bicho. Sorteio a cada renderização faria a foto trocar sozinha, e a pessoa
 * reconhece o próprio perfil pela imagem antes de ler o nome.
 */
export function avatarPadraoPara(profileId: string, isKids = false): string {
  const pool = isKids ? AVATARES.filter((a) => a.infantil) : AVATARES;
  let soma = 0;
  for (let i = 0; i < profileId.length; i++) soma += profileId.charCodeAt(i);
  return pool[soma % pool.length].src;
}

/** Caminho a exibir: o escolhido, ou o padrão estável do perfil. */
export function avatarDoPerfil(perfil: {
  id: string;
  avatarUrl?: string | null;
  isKids?: boolean;
}): string {
  return ehAvatarValido(perfil.avatarUrl)
    ? (perfil.avatarUrl as string)
    : avatarPadraoPara(perfil.id, perfil.isKids);
}
