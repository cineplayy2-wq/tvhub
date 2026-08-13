"use client";

import { useState } from "react";
import { Cast, Check, Monitor, Smartphone, Tv, Wifi } from "lucide-react";
import { Modal } from "@/components/ui/modal";

export function CastModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState<string | null>(null);

  const devices = [
    { id: "chromecast", name: "Chromecast / Google TV", icon: Tv, detail: "Mesma rede Wi-Fi" },
    { id: "airplay", name: "Apple TV / AirPlay", icon: Monitor, detail: "AirPlay 2 disponível" },
    { id: "smarttv", name: "Samsung / LG Smart TV", icon: Tv, detail: "DLNA / WebOS" },
    { id: "mobile", name: "Hubflix Remote Companion", icon: Smartphone, detail: "Sincronização via QR Code" },
  ];

  const handleConnect = (id: string) => {
    setConnecting(id);
    setTimeout(() => {
      setConnecting(null);
      setConnected(id);
      setTimeout(() => {
        setConnected(null);
        onClose();
      }, 1500);
    }, 1200);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transmitir para TV"
      description="Selecione um dispositivo na sua rede local para transmitir o vídeo com qualidade máxima."
    >
      <div className="mt-4 space-y-3">
        {devices.map((device) => {
          const Icon = device.icon;
          const isConnecting = connecting === device.id;
          const isConnected = connected === device.id;

          return (
            <button
              key={device.id}
              type="button"
              onClick={() => handleConnect(device.id)}
              disabled={isConnecting}
              className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-surface p-3.5 text-left transition-all hover:border-primary/50 hover:bg-surface-elevated active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{device.name}</p>
                  <p className="text-xs text-muted-foreground">{device.detail}</p>
                </div>
              </div>

              <div className="shrink-0">
                {isConnecting ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
                    <Wifi className="h-3.5 w-3.5 animate-pulse" />
                    Conectando…
                  </span>
                ) : isConnected ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                    <Check className="h-4 w-4" />
                    Conectado!
                  </span>
                ) : (
                  <Cast className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
