/**
 * Reproduz o congelamento do filme.
 *
 * Servidor falso = provedor de IPTV. Ele manda bytes enquanto o cliente lê.
 * O cliente para de ler por um tempo (é o navegador com o buffer cheio) e
 * depois volta — exatamente a contrapressão de um filme longo.
 *
 * O prazo é 1,5s em vez de 15s só para o teste caber em segundos.
 */
import http from "node:http";

const PRAZO = 1500;
const PAUSA_DO_CLIENTE = 3000; // maior que o prazo: é o que dispara o bug

function servidorFalso() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "video/mp4" });
      const pedaco = Buffer.alloc(64 * 1024, 0x42);
      // Escreve enquanto o cliente aceitar. Quando a contrapressão bate,
      // `write` devolve false e ele espera o "drain" — igual ao provedor real.
      const bombear = () => {
        while (res.write(pedaco)) {
          /* escoando */
        }
      };
      res.on("drain", bombear);
      bombear();
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

function baixar({ desarmarAposResposta }) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port: porta, path: "/filme.mp4", timeout: PRAZO },
      (res) => {
        if (desarmarAposResposta) {
          req.setTimeout(0);
          res.socket?.setTimeout(0);
        }

        let bytes = 0;
        let morreu = null;

        res.on("data", (d) => {
          bytes += d.length;
        });
        res.on("error", (e) => {
          morreu = e.code || e.message;
        });
        res.on("aborted", () => {
          morreu = morreu || "ABORTADO";
        });

        // O "navegador" enche o buffer e para de ler.
        setTimeout(() => res.pause(), 250);
        // Depois volta a ler, como faria ao consumir o buffer.
        setTimeout(() => res.resume(), 250 + PAUSA_DO_CLIENTE);

        setTimeout(() => {
          resolve({ bytes, morreu });
          try {
            req.destroy();
          } catch {}
        }, 250 + PAUSA_DO_CLIENTE + 800);
      },
    );

    req.on("error", (e) => resolve({ bytes: 0, morreu: e.code || e.message }));
    req.on("timeout", () => {
      // Este é o handler do código antigo: mata a conexão.
      if (!desarmarAposResposta) req.destroy();
    });
  });
}

let porta;

(async () => {
  const srv = await servidorFalso();
  porta = srv.address().port;

  console.log(
    `\nCliente para de ler por ${PAUSA_DO_CLIENTE}ms com prazo de ociosidade de ${PRAZO}ms.\n` +
      `É o navegador com o buffer cheio no meio de um filme.\n`,
  );

  const antes = await baixar({ desarmarAposResposta: false });
  console.log("CÓDIGO ANTIGO (cronômetro segue armado durante o fluxo)");
  console.log(`   bytes recebidos: ${antes.bytes}`);
  console.log(`   conexão morreu:  ${antes.morreu ?? "não"}`);

  const depois = await baixar({ desarmarAposResposta: true });
  console.log("\nCÓDIGO NOVO (cronômetro desarmado quando a resposta chega)");
  console.log(`   bytes recebidos: ${depois.bytes}`);
  console.log(`   conexão morreu:  ${depois.morreu ?? "não"}`);

  srv.close();

  const provado = antes.morreu && !depois.morreu && depois.bytes > antes.bytes;
  console.log(
    provado
      ? "\nCONFIRMADO: o antigo derruba a conexão na ociosidade; o novo sobrevive e segue recebendo.\n"
      : "\nINCONCLUSIVO — revisar.\n",
  );
  process.exit(provado ? 0 : 1);
})();
