import {
  CheckCircle2,
  Database,
  Globe,
  Key,
  Mail,
  Radio,
  Server,
  Settings,
  ShieldCheck,
  Smartphone,
  Tv,
} from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminConfiguracoesPage() {
  const [userCount, playlistCount, titleCount] = await Promise.all([
    prisma.user.count(),
    prisma.m3uPlaylist.count(),
    prisma.title.count(),
  ]);

  const smtpUser = process.env.SMTP_USER || "cineplayy7@gmail.com";
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  // Sem valor padrão: a chave ficava aqui em texto puro, num arquivo
  // versionado. Ela vem só do ambiente (/opt/tvhub/.env na VPS).
  const tmdbKey = process.env.TMDB_API_KEY ?? "";
  // Mostra as pontas, nunca o miolo — o suficiente para conferir se a chave
  // certa está no ar sem expor o valor na tela de quem tem acesso ao admin.
  const tmdbKeyMascarada = tmdbKey
    ? `${tmdbKey.slice(0, 8)}...${tmdbKey.slice(-4)}`
    : "não configurada";

  return (
    <div className="px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Configurações da Plataforma
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão completa de todos os serviços, integrações SMTP, TMDB e regras do app.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Bloco 1: E-mail / SMTP */}
        <div className="rounded-2xl border border-white/10 bg-surface/60 p-6 shadow-lg backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4 border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Servidor de E-mail (SMTP 2FA)</h2>
                <p className="text-[11px] text-muted-foreground">Envio de código de login por e-mail</p>
              </div>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Ativo
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-muted-foreground">Provedor SMTP:</span>
              <span className="font-semibold text-foreground">Gmail App Password</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-muted-foreground">Host / Porta:</span>
              <span className="font-mono text-foreground">{smtpHost}:465 (SSL)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-muted-foreground">E-mail Remetente:</span>
              <span className="font-mono text-foreground">{smtpUser}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-muted-foreground">Validade do Código 2FA:</span>
              <span className="font-semibold text-foreground">10 Minutos</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Status do Serviço:</span>
              <span className="text-emerald-400 font-semibold">Integrado & Verificado</span>
            </div>
          </div>
        </div>

        {/* Bloco 2: TMDB & Metadados */}
        <div className="rounded-2xl border border-white/10 bg-surface/60 p-6 shadow-lg backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4 border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Integração TMDB & Sinopses</h2>
                <p className="text-[11px] text-muted-foreground">Catálogo automático de filmes e séries</p>
              </div>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Conectado
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-muted-foreground">API Key TMDB:</span>
              <span className="font-mono text-foreground">{tmdbKeyMascarada}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-muted-foreground">Busca de Capas e Banners:</span>
              <span className="font-semibold text-emerald-400">Automática (v4)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-muted-foreground">Total de Títulos Cadastrados:</span>
              <span className="font-semibold text-foreground">{titleCount} títulos</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Importação Inteligente:</span>
              <span className="text-foreground font-semibold">Habiltada</span>
            </div>
          </div>
        </div>

        {/* Bloco 3: IPTV / M3U & Transmissão */}
        <div className="rounded-2xl border border-white/10 bg-surface/60 p-6 shadow-lg backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4 border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Motor IPTV & Listas M3U</h2>
                <p className="text-[11px] text-muted-foreground">Sincronização de canais ao vivo</p>
              </div>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-purple-300">
              {playlistCount} Listas Ativas
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-muted-foreground">Frequência de Auto-Sync:</span>
              <span className="font-semibold text-foreground">A cada 6 horas</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-muted-foreground">Proxy de Reprodução HLS/TS:</span>
              <span className="font-semibold text-emerald-400">Ativo (`/api/iptv/stream`)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-muted-foreground">Suporte a Formatos:</span>
              <span className="font-mono text-foreground">HLS (.m3u8), MPEG-TS (.ts)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Resoluções:</span>
              <span className="text-foreground font-semibold">FHD, HD e SD Automático</span>
            </div>
          </div>
        </div>

        {/* Bloco 4: Segurança & Regras da Plataforma */}
        <div className="rounded-2xl border border-white/10 bg-surface/60 p-6 shadow-lg backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4 border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                <Tv className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Limites & Trava de Telas</h2>
                <p className="text-[11px] text-muted-foreground">Sessões simultâneas de streaming</p>
              </div>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-blue-400">
              Redis Lock Ativo
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-muted-foreground">Limite Padrão por Conta:</span>
              <span className="font-bold text-foreground">2 Telas Simultâneas</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-muted-foreground">Limite Máximo de Perfis:</span>
              <span className="font-bold text-foreground">4 Perfis por Conta</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
              <span className="text-muted-foreground">Sessões Totais de Clientes:</span>
              <span className="font-semibold text-foreground">{userCount} usuários ativos</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Rate Limit de Login:</span>
              <span className="text-emerald-400 font-semibold">8 tentativas por 15 min</span>
            </div>
          </div>
        </div>
      </div>

      {/* VPS & Servidor Status */}
      <div className="rounded-2xl border border-white/10 bg-surface/40 p-6 shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <Server className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">Servidor VPS Produção</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Rodando em <strong>170.238.45.225</strong> em Docker Swarm com suporte a PostgreSQL, Redis e Next.js Standalone. Todas as alterações e builds são validadas e implantadas sem downtime.
        </p>
      </div>
    </div>
  );
}
