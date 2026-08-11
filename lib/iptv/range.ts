/**
 * Conserta o `Content-Range` do upstream.
 *
 * O servidor de VOD desta lista responde a `Range: bytes=0-1023` com
 * `Content-Length: 1024` e `Content-Range: bytes 0-2459810843/2459810844` —
 * ou seja, anuncia ter enviado o arquivo inteiro e envia 1 KB. O Chrome
 * detecta a incoerência e ABORTA a resposta; era por isso que filme nenhum
 * abria, enquanto canal ao vivo (que não usa Range) funcionava.
 *
 * Aqui o cabeçalho é reescrito para descrever o que realmente vai no corpo,
 * preservando o tamanho total do arquivo para o navegador poder buscar.
 */
export function reconcileContentRange(
  upstreamRange: string,
  upstreamLength: string | undefined,
  clientRange: string | null,
): string {
  const parsed = /bytes\s+(\d+)-(\d+)\/(\d+|\*)/i.exec(upstreamRange);
  if (!parsed) return upstreamRange;

  const declaredStart = Number(parsed[1]);
  const declaredEnd = Number(parsed[2]);
  const total = parsed[3];

  const bodyLength = upstreamLength ? Number(upstreamLength) : NaN;
  if (!Number.isFinite(bodyLength) || bodyLength <= 0) return upstreamRange;

  // Coerente: o intervalo anunciado tem o mesmo tamanho do corpo
  if (declaredEnd - declaredStart + 1 === bodyLength) return upstreamRange;

  // Incoerente: o início vale o que o cliente pediu (o upstream costuma
  // acertar o começo e errar o fim), e o fim vem do tamanho real do corpo.
  const requested = clientRange ? /bytes=(\d+)-/i.exec(clientRange) : null;
  const start = requested ? Number(requested[1]) : declaredStart;
  const end = start + bodyLength - 1;

  return `bytes ${start}-${end}/${total}`;
}
