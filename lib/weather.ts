import "server-only";

import { cached } from "@/lib/cache";

/**
 * Tempo agora, para a barra do topo.
 *
 * Feito no SERVIDOR. O widget antigo chamava `ipapi.co` direto do navegador,
 * o que entrega o IP de cada assinante a um terceiro e some quando há um
 * bloqueador ativo. Aqui a cidade já vem da geolocalização do servidor
 * (lib/geo.ts) e só as coordenadas e a temperatura saem para fora.
 *
 * `open-meteo` é gratuito e não exige chave. Falha para `null` em qualquer
 * erro: sem tempo, o chip mostra só o relógio e a cidade.
 */

export type Weather = {
  temperatureC: number;
  /** Código WMO devolvido pelo open-meteo. */
  code: number;
};

const TTL_SECONDS = 60 * 30;

export async function getWeather(
  city: string | null,
  state: string,
): Promise<Weather | null> {
  const place = city ?? state;
  if (!place) return null;

  return cached(`weather:${place.toLowerCase()}`, TTL_SECONDS, async () => {
    try {
      const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
      geoUrl.searchParams.set("name", place);
      geoUrl.searchParams.set("count", "1");
      geoUrl.searchParams.set("country", "BR");
      geoUrl.searchParams.set("language", "pt");

      const geoResponse = await fetch(geoUrl, { signal: AbortSignal.timeout(3000) });
      if (!geoResponse.ok) return null;

      const geo = (await geoResponse.json()) as {
        results?: Array<{ latitude: number; longitude: number }>;
      };
      const point = geo.results?.[0];
      if (!point) return null;

      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(point.latitude));
      url.searchParams.set("longitude", String(point.longitude));
      url.searchParams.set("current_weather", "true");

      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) return null;

      const data = (await response.json()) as {
        current_weather?: { temperature: number; weathercode: number };
      };
      if (!data.current_weather) return null;

      return {
        temperatureC: Math.round(data.current_weather.temperature),
        code: data.current_weather.weathercode,
      };
    } catch {
      return null;
    }
  });
}
