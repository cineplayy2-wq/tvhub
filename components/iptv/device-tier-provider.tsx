"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { detectTier, saveTier, type DeviceTier } from "@/lib/playback/device";

/**
 * Nível do aparelho, disponível para toda a árvore.
 *
 * A detecção roda DEPOIS da montagem, nunca no servidor: o HTML entregue é
 * sempre o mesmo, senão o servidor e o cliente discordariam e a hidratação
 * quebraria. O primeiro quadro sai como "full"; se o aparelho for fraco, a
 * troca acontece no efeito seguinte — e no modo leve o que sai da tela é
 * imagem, o que só melhora.
 *
 * A classe `tier-lite` no <html> permite que o CSS reaja sem passar por
 * JavaScript em cada componente.
 */

const TierContext = createContext<{
  tier: DeviceTier;
  setTier: (tier: DeviceTier) => void;
}>({ tier: "full", setTier: () => undefined });

export function useDeviceTier() {
  return useContext(TierContext);
}

export function DeviceTierProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTierState] = useState<DeviceTier>("full");

  useEffect(() => {
    const detected = detectTier();
    setTierState(detected);
    document.documentElement.classList.toggle("tier-lite", detected === "lite");
  }, []);

  const setTier = (next: DeviceTier) => {
    setTierState(next);
    saveTier(next);
    document.documentElement.classList.toggle("tier-lite", next === "lite");
  };

  return (
    <TierContext.Provider value={{ tier, setTier }}>{children}</TierContext.Provider>
  );
}
