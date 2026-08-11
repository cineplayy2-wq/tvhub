"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Bot, Send, X, Play, Tv, Film, Trophy, Heart, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Recommendation {
  id: string;
  name: string;
  reason: string;
  logoUrl?: string | null;
  category?: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  recommendations?: Recommendation[];
}

export function CineAiWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "Olá! Sou o CineAI, seu assistente inteligente de TV! O que você gostaria de assistir hoje? Me conte seu perfil ou escolha uma sugestão abaixo! 🍿✨",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (customText?: string) => {
    const textToSend = customText || inputPrompt.trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!customText) setInputPrompt("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: textToSend }),
      });

      const data = await res.json();

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: data.message || "Aqui estão minhas indicações para você:",
        recommendations: data.recommendations || [],
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: "Tive um imprevisto técnico ao consultar seu catálogo, mas posso te ajudar a pesquisar filmes ou jogos!",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const SUGGESTIONS = [
    { label: "⚽ Jogos de Futebol ao Vivo", prompt: "Quais os melhores jogos e canais de futebol passando ao vivo agora?" },
    { label: "🎈 Desenhos para Crianças", prompt: "Me indique desenhos animados e filmes infantis divertidos para crianças." },
    { label: "🍿 Filmes Lançamentos 2026", prompt: "Quais os principais filmes lançamentos recentes de ação e suspense na plataforma?" },
    { label: "📺 Série Maratona Globoplay/Netflix", prompt: "Me recomende uma série excelente com várias temporadas para maratonar hoje." },
  ];

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-20 md:bottom-6 right-4 z-50 flex items-center gap-2 rounded-full px-4 py-3 text-xs font-black text-slate-950 shadow-2xl transition-all hover:scale-105 active:scale-95",
          "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 shadow-amber-400/30 border-2 border-white/40"
        )}
        aria-label="Abrir Assistente CineAI"
      >
        <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-amber-400">
          <Sparkles className="h-4 w-4 animate-spin-slow" />
        </div>
        <span className="hidden sm:inline tracking-tight font-black uppercase">CineAI Assistente</span>
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
      </button>

      {/* Floating Modal Window */}
      {isOpen && (
        <div className="fixed bottom-28 md:bottom-20 right-4 z-50 w-[92vw] sm:w-[420px] max-h-[80vh] h-[540px] rounded-3xl border border-white/20 bg-slate-950/95 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wide">
                  CineAI <span className="text-[10px] rounded bg-amber-400/20 px-1.5 py-0.5 text-amber-300 font-bold">DEEPSEEK</span>
                </h3>
                <p className="text-[11px] text-white/60 font-medium">Guia Inteligente de Canais & Filmes</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[88%] text-xs font-medium leading-relaxed rounded-2xl p-3.5 shadow-md",
                  msg.sender === "user"
                    ? "ml-auto bg-amber-400 text-slate-950 rounded-br-none font-bold"
                    : "mr-auto bg-slate-900/90 text-white/90 border border-white/10 rounded-bl-none"
                )}
              >
                <p>{msg.text}</p>

                {/* AI Recommendation Cards */}
                {msg.recommendations && msg.recommendations.length > 0 && (
                  <div className="mt-3 space-y-2 pt-2 border-t border-white/10">
                    <p className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
                      Opções Prontas no Seu Catálogo:
                    </p>
                    {msg.recommendations.map((rec) => (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-black/40 border border-white/10 p-2.5 hover:border-amber-400/50 transition-all"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          {rec.logoUrl ? (
                            <img src={rec.logoUrl} alt={rec.name} className="h-8 w-8 object-contain rounded-md shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-md bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                              <Tv className="h-4 w-4" />
                            </div>
                          )}
                          <div className="truncate">
                            <p className="font-bold text-white text-xs truncate">{rec.name}</p>
                            <p className="text-[10px] text-white/60 truncate">{rec.reason}</p>
                          </div>
                        </div>

                        <Link
                          href={`/tv/assistir/${rec.id}`}
                          onClick={() => setIsOpen(false)}
                          className="shrink-0 flex items-center gap-1 rounded-lg bg-amber-400 hover:bg-amber-300 px-3 py-1.5 text-[11px] font-black text-slate-950 transition-transform active:scale-95 shadow-md"
                        >
                          <Play className="h-3 w-3 fill-current" /> Ver
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="mr-auto flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-bold text-amber-300 border border-white/10">
                <Sparkles className="h-4 w-4 animate-spin" /> Analisando o catálogo para você...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Pills */}
          <div className="px-3 py-2 border-t border-white/10 bg-black/40 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s.prompt)}
                disabled={isLoading}
                className="shrink-0 rounded-full bg-white/10 hover:bg-amber-400 hover:text-slate-950 px-3 py-1 text-[10px] font-extrabold text-white/80 transition-colors border border-white/10"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t border-white/10 bg-slate-900 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Digite o que deseja assistir…"
              className="flex-1 rounded-full border border-white/20 bg-black/60 px-4 py-2.5 text-xs text-white placeholder:text-white/40 focus:border-amber-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !inputPrompt.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-slate-950 disabled:opacity-50 transition-transform active:scale-95 shadow-md font-bold"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
