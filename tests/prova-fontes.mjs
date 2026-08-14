/**
 * Prova a montagem de fontes e a reescrita de manifesto.
 *
 * As duas são lógica pura e decidem se um formato toca ou não — vale ter
 * verificação em cima delas em vez de confiar na leitura do código.
 */

// --- cópia fiel da lógica de montagem de fontes do player ---
const CONTAINER_NATIVO = /\.(mp4|m4v|webm|mov)(\?|$)/i;
const CONTAINER_SEM_SUPORTE = /\.(mkv|avi|wmv|flv|mpg|mpeg|divx)(\?|$)/i;

function montarFontes(principal, alternativas = []) {
  const fontes = [];
  const adicionar = (bruta, ehBackup) => {
    if (!bruta) return;
    if (/\.flv(\?|$)/i.test(bruta)) {
      fontes.push({ url: bruta, tipo: "flv", ehBackup });
      fontes.push({ url: bruta.replace(/\.flv(\?|$)/i, ".mp4$1"), tipo: "progressivo", ehBackup });
      return;
    }
    if (CONTAINER_SEM_SUPORTE.test(bruta)) {
      fontes.push({ url: bruta.replace(CONTAINER_SEM_SUPORTE, ".mp4$2"), tipo: "progressivo", ehBackup });
      fontes.push({ url: bruta, tipo: "progressivo", ehBackup });
      return;
    }
    if (CONTAINER_NATIVO.test(bruta)) {
      fontes.push({ url: bruta, tipo: "progressivo", ehBackup });
      return;
    }
    if (/\.ts(\?|$)/i.test(bruta)) {
      fontes.push({ url: bruta, tipo: "ts", ehBackup });
      fontes.push({ url: bruta.replace(/\.ts(\?|$)/i, ".m3u8$1"), tipo: "hls", ehBackup });
      return;
    }
    if (/\.m3u8(\?|$)/i.test(bruta)) {
      fontes.push({ url: bruta, tipo: "hls", ehBackup });
      fontes.push({ url: bruta.replace(/\.m3u8(\?|$)/i, ".ts$1"), tipo: "ts", ehBackup });
      return;
    }
    fontes.push({ url: `${bruta}.m3u8`, tipo: "hls", ehBackup });
    fontes.push({ url: `${bruta}.ts`, tipo: "ts", ehBackup });
  };
  adicionar(principal, false);
  for (const alt of alternativas) adicionar(alt, true);
  const vistas = new Set();
  return fontes.filter((f) => {
    const chave = `${f.tipo}:${f.url}`;
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

// --- cópia fiel da reescrita de manifesto da proxy ---
const TAGS_COM_URI =
  /^(#EXT-X-KEY|#EXT-X-MAP|#EXT-X-SESSION-KEY|#EXT-X-PART|#EXT-X-PRELOAD-HINT|#EXT-X-RENDITION-REPORT|#EXT-X-I-FRAME-STREAM-INF|#EXT-X-MEDIA)[:,]/i;

function reescrever(manifesto, base) {
  const baseUrl = new URL(base);
  const porProxy = (bruta) =>
    `/api/iptv/stream?url=${encodeURIComponent(new URL(bruta, baseUrl).toString())}`;
  return manifesto
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith("#")) {
        if (!TAGS_COM_URI.test(t)) return line;
        return line.replace(/URI="([^"]+)"/gi, (inteiro, uri) => {
          try {
            return `URI="${porProxy(uri)}"`;
          } catch {
            return inteiro;
          }
        });
      }
      try {
        return porProxy(t);
      } catch {
        return line;
      }
    })
    .join("\n");
}

let falhas = 0;
const ok = (rotulo, obtido, esperado) => {
  const bom = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? "ok   " : "FALHA"} ${rotulo}`);
  if (!bom) console.log(`         esperado: ${JSON.stringify(esperado)}\n         obtido:   ${JSON.stringify(obtido)}`);
};

console.log("\n--- montagem de fontes por formato ---");

const ts = montarFontes("http://p.tv/live/u/s/101.ts");
ok("canal .ts tenta o formato do provedor PRIMEIRO", ts[0].tipo, "ts");
ok("canal .ts tem HLS como reserva", ts[1].tipo, "hls");

const xtream = montarFontes("http://p.tv/live/u/s/101");
ok("Xtream sem extensao tenta HLS primeiro", xtream[0].tipo, "hls");
ok("Xtream cai para TS", xtream[1].tipo, "ts");

const mkv = montarFontes("http://p.tv/movie/u/s/9.mkv");
ok("MKV tenta o irmao .mp4 primeiro", mkv[0].url, "http://p.tv/movie/u/s/9.mp4");
ok("MKV mantem a original como ultima chance", mkv[1].url, "http://p.tv/movie/u/s/9.mkv");

const mkvQ = montarFontes("http://p.tv/movie/9.mkv?token=abc");
ok("MKV com query preserva o ?", mkvQ[0].url, "http://p.tv/movie/9.mp4?token=abc");

const flv = montarFontes("http://p.tv/live/u/s/7.flv");
ok("FLV ganha motor proprio", flv[0].tipo, "flv");

const mp4 = montarFontes("http://p.tv/movie/u/s/9.mp4");
ok("MP4 e uma fonte so, nativa", mp4.length, 1);
ok("MP4 e progressivo", mp4[0].tipo, "progressivo");

const comBackup = montarFontes("http://a.tv/live/1.ts", ["http://b.tv/live/1.ts"]);
ok("backup entra depois da principal", comBackup.map((f) => f.ehBackup), [false, false, true, true]);

console.log("\n--- reescrita de manifesto ---");

const manifesto = [
  "#EXTM3U",
  "#EXT-X-VERSION:6",
  '#EXT-X-KEY:METHOD=AES-128,URI="http://p.tv/key.bin",IV=0x1234',
  '#EXT-X-MAP:URI="init.mp4"',
  "#EXTINF:6.0,",
  "seg1.ts",
  "#EXT-X-ENDLIST",
].join("\n");

const saida = reescrever(manifesto, "http://p.tv/live/u/s/101.m3u8");
const linhas = saida.split("\n");

ok(
  "chave AES passa pela proxy",
  linhas[2].includes("/api/iptv/stream?url=") && linhas[2].includes("METHOD=AES-128") && linhas[2].includes("IV=0x1234"),
  true,
);
ok("segmento de init do fMP4 passa pela proxy", linhas[3].includes("/api/iptv/stream?url="), true);
ok("EXTINF nao e tocado", linhas[4], "#EXTINF:6.0,");
ok("segmento comum passa pela proxy", linhas[5].startsWith("/api/iptv/stream?url="), true);
ok("URI relativa vira absoluta antes de proxiar", decodeURIComponent(linhas[3]).includes("http://p.tv/live/u/s/init.mp4"), true);
ok("ENDLIST preservado", linhas[6], "#EXT-X-ENDLIST");

console.log(falhas === 0 ? "\nTUDO PASSOU\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
