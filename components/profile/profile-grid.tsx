"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Lock, Pencil, Plus } from "lucide-react";

import { selectProfileAction } from "@/app/actions/profiles";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { ProfileFormModal } from "@/components/profile/profile-form-modal";
import { PinDialog } from "@/components/profile/pin-dialog";
import { PROFILE } from "@/lib/constants";
import type { ProfileSummary } from "@/types";
import { cn } from "@/lib/utils";

export function ProfileGrid({
  profiles,
  initialUnlockId,
}: {
  profiles: ProfileSummary[];
  /** Perfil que a URL pediu para desbloquear (?desbloquear=). */
  initialUnlockId?: string;
}) {
  const [isManaging, setIsManaging] = useState(false);
  const [editing, setEditing] = useState<ProfileSummary | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [unlocking, setUnlocking] = useState<ProfileSummary | null>(
    profiles.find((p) => p.id === initialUnlockId) ?? null,
  );
  const [isPending, startTransition] = useTransition();

  const canAdd = profiles.length < PROFILE.MAX_PER_ACCOUNT;

  function handleClick(profile: ProfileSummary) {
    if (isManaging) {
      setEditing(profile);
      setFormOpen(true);
      return;
    }

    if (profile.hasPin && !profile.isKids) {
      setUnlocking(profile);
      return;
    }

    startTransition(() => {
      void selectProfileAction(profile.id);
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-8">
        {profiles.map((profile, index) => (
          <motion.button
            key={profile.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: index * 0.06,
              ease: [0.32, 0.72, 0, 1],
            }}
            onClick={() => handleClick(profile)}
            disabled={isPending}
            className="group flex w-24 flex-col items-center gap-3 disabled:opacity-60 sm:w-28"
          >
            <span className="relative">
              <ProfileAvatar
                id={profile.id}
                name={profile.name}
                isKids={profile.isKids}
                size="lg"
                className={cn(
                  "ring-2 ring-transparent transition-all duration-300 ease-smooth",
                  "group-hover:ring-primary group-focus-visible:ring-primary",
                )}
              />

              {isManaging && (
                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/70">
                  <Pencil className="h-6 w-6 text-foreground" aria-hidden />
                </span>
              )}

              {profile.hasPin && !isManaging && (
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface">
                  <Lock className="h-3 w-3 text-muted" aria-hidden />
                </span>
              )}
            </span>

            <span className="truncate text-sm text-muted transition-colors group-hover:text-foreground">
              {profile.name}
            </span>
          </motion.button>
        ))}

        {canAdd && (
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="group flex w-24 flex-col items-center gap-3 sm:w-28"
          >
            <span className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-border-strong transition-colors duration-300 group-hover:border-primary">
              <Plus
                className="h-8 w-8 text-muted-foreground transition-colors group-hover:text-primary"
                strokeWidth={1.5}
                aria-hidden
              />
            </span>
            <span className="text-sm text-muted-foreground transition-colors group-hover:text-foreground">
              Adicionar
            </span>
          </button>
        )}
      </div>

      <div className="mt-14 flex justify-center">
        <Button
          variant="outline"
          size="md"
          onClick={() => setIsManaging((v) => !v)}
        >
          {isManaging ? "Concluir" : "Gerenciar perfis"}
        </Button>
      </div>

      <ProfileFormModal
        open={isFormOpen}
        profile={editing}
        canDelete={profiles.length > 1}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <PinDialog profile={unlocking} onClose={() => setUnlocking(null)} />
    </>
  );
}
