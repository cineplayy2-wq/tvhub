/**
 * Observa mudança de tamanho de um elemento, com reserva.
 *
 * `ResizeObserver` não existe em Tizen antigo, webOS 3, Opera TV e WebView do
 * Android 4/5 — e chamar `new ResizeObserver(...)` nesses aparelhos lança
 * ReferenceError dentro do efeito, o que derruba a árvore do React e deixa a
 * tela quebrada. Aqui a API é detectada; sem ela, cai no evento `resize` da
 * janela, que existe em qualquer navegador.
 *
 * Devolve sempre uma função de limpeza, para o chamador não precisar saber
 * qual dos dois caminhos foi usado.
 */
export function observeResize(element: Element | null, onChange: () => void): () => void {
  if (!element || typeof window === "undefined") return () => undefined;

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(onChange);
    observer.observe(element);
    return () => observer.disconnect();
  }

  // Reserva: menos preciso (só reage à janela), mas funciona em tudo
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}
