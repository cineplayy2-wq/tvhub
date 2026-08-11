"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  CloudLightning,
  CloudRain,
  MapPin,
  Snowflake,
  Sun,
  type LucideIcon,
} from "lucide-react";

/**
 * Relógio, cidade e temperatura na barra do topo.
 *
 * O relógio precisa ser cliente (tem que andar), mas cidade e temperatura
 * chegam prontas do servidor. Só o horário é calculado aqui, e depois da
 * montagem — renderizar hora no servidor causaria divergência de hidratação,
 * porque o relógio do servidor não é o do assinante.
 */

/** Códigos WMO agrupados no ícone correspondente. */
function iconFor(code: number): LucideIcon {
  if (code >= 95) return CloudLightning;
  if (code >= 71 && code <= 77) return Snowflake;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  if (code >= 2) return Cloud;
  return Sun;
}

export function StatusChip({
  place,
  temperatureC,
  weatherCode,
}: {
  place: string | null;
  temperatureC?: number | null;
  weatherCode?: number | null;
}) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );

    tick();
    // 20s é suficiente para o minuto virar sem erro perceptível, e é 20x
    // menos trabalho que um timer de 1s numa aba aberta o dia inteiro.
    const timer = setInterval(tick, 20_000);
    return () => clearInterval(timer);
  }, []);

  if (!place && !time) return null;

  const WeatherIcon = typeof weatherCode === "number" ? iconFor(weatherCode) : null;

  return (
    <div className="hidden items-center gap-2.5 rounded-full border border-white/[0.08] bg-surface/60 px-3 py-1.5 text-xs font-medium text-muted-foreground lg:flex">
      {time && <span className="tabular-nums text-foreground">{time}</span>}

      {place && (
        <span className="flex items-center gap-1.5 border-l border-white/[0.08] pl-2.5">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {place}
        </span>
      )}

      {WeatherIcon && typeof temperatureC === "number" && (
        <span className="flex items-center gap-1.5 border-l border-white/[0.08] pl-2.5">
          <WeatherIcon className="h-3.5 w-3.5 text-primary" />
          <span className="tabular-nums text-foreground">{temperatureC}°</span>
        </span>
      )}
    </div>
  );
}
