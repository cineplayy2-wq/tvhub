import bcrypt from "bcryptjs";

/**
 * 12 rounds: ~250ms por hash em hardware de servidor comum.
 * Alto o bastante para inviabilizar força bruta offline, baixo o bastante
 * para não travar o login.
 */
const SALT_ROUNDS = 12;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/**
 * Hash descartável, com o mesmo custo de um hash real.
 *
 * Sem isso, um e-mail inexistente responde na hora e um e-mail cadastrado
 * demora ~250ms — a diferença de tempo entrega quais e-mails existem na base.
 * Comparar contra este hash iguala os dois caminhos.
 */
/// Gerado em runtime, não escrito à mão: com um hash de formato inválido o
/// bcrypt.compare retorna false imediatamente, sem gastar tempo — e o disfarce
/// deixaria de disfarçar exatamente aquilo que existe para esconder.
let dummyHash: Promise<string> | null = null;

export async function fakeVerify() {
  dummyHash ??= bcrypt.hash("tvhub::dummy::password", SALT_ROUNDS);
  await bcrypt.compare("senha-que-nunca-confere", await dummyHash);
}
