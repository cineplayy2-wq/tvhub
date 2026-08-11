"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  deleteEpisodeAction,
  upsertEpisodeAction,
  type AdminFormState,
} from "@/app/actions/admin";
import { VideoStatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration } from "@/lib/utils";

const INITIAL: AdminFormState = {};

type Episode = {
  id: string;
  season: number;
  number: number;
  name: string;
  synopsis: string | null;
  thumbnailUrl: string | null;
  videoProviderId: string | null;
  videoUrl: string | null;
  videoStatus: string;
  durationSeconds: number | null;
};

export function EpisodesManager({
  titleId,
  episodes,
}: {
  titleId: string;
  episodes: Episode[];
}) {
  const [editing, setEditing] = useState<Episode | null>(null);
  const [isOpen, setOpen] = useState(false);
  const [state, formAction] = useFormState(upsertEpisodeAction, INITIAL);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  // Próximo episódio da última temporada — o caso comum é cadastrar em sequência
  const lastEpisode = episodes[episodes.length - 1];
  const nextSeason = lastEpisode?.season ?? 1;
  const nextNumber = (lastEpisode?.number ?? 0) + 1;

  const bySeason = episodes.reduce<Record<number, Episode[]>>((acc, episode) => {
    (acc[episode.season] ??= []).push(episode);
    return acc;
  }, {});

  return (
    <section className="rounded-lg border border-border bg-surface/40 p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Episódios ({episodes.length})
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Adicionar
        </Button>
      </div>

      {episodes.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum episódio cadastrado.
        </p>
      ) : (
        <div className="space-y-6">
          {Object.entries(bySeason).map(([season, list]) => (
            <div key={season}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Temporada {season}
              </h3>
              <ul className="divide-y divide-border rounded-md border border-border">
                {list.map((episode) => (
                  <li
                    key={episode.id}
                    className="flex items-center gap-4 px-4 py-3"
                  >
                    <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
                      T{episode.season}E{episode.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {episode.name}
                    </span>
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {episode.durationSeconds
                        ? formatDuration(episode.durationSeconds)
                        : "—"}
                    </span>
                    <VideoStatusPill status={episode.videoStatus} />

                    <button
                      type="button"
                      onClick={() => {
                        setEditing(episode);
                        setOpen(true);
                      }}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={`Editar ${episode.name}`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Excluir "${episode.name}"?`)) {
                          void deleteEpisodeAction(episode.id, titleId);
                        }
                      }}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:text-danger"
                      aria-label={`Excluir ${episode.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={isOpen}
        onClose={() => setOpen(false)}
        title={editing ? "Editar episódio" : "Novo episódio"}
        className="max-w-lg"
      >
        {/* key remonta o form ao trocar de episódio: sem isso os defaultValue
            ficam presos nos valores do episódio anterior */}
        <form
          key={editing?.id ?? "new"}
          action={formAction}
          className="space-y-5"
        >
          <FormError message={state.error} />
          <input type="hidden" name="titleId" value={titleId} />
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="season"
              type="number"
              label="Temporada"
              defaultValue={editing?.season ?? nextSeason}
              min={1}
              error={state.fieldErrors?.season}
            />
            <Input
              name="number"
              type="number"
              label="Episódio"
              defaultValue={editing?.number ?? nextNumber}
              min={1}
              error={state.fieldErrors?.number}
            />
          </div>

          <Input
            name="name"
            label="Nome"
            defaultValue={editing?.name}
            error={state.fieldErrors?.name}
          />

          <Textarea
            name="synopsis"
            label="Sinopse"
            rows={3}
            defaultValue={editing?.synopsis ?? ""}
          />

          <Input
            name="durationSeconds"
            type="number"
            label="Duração (segundos)"
            defaultValue={editing?.durationSeconds ?? ""}
          />

          <Input
            name="thumbnailUrl"
            label="Thumbnail (URL)"
            defaultValue={editing?.thumbnailUrl ?? ""}
          />

          <Input
            name="videoProviderId"
            label="ID do vídeo no provedor"
            defaultValue={editing?.videoProviderId ?? ""}
          />

          <Input
            name="videoUrl"
            label="URL HLS (.m3u8)"
            defaultValue={editing?.videoUrl ?? ""}
          />

          <Select
            name="videoStatus"
            label="Status do vídeo"
            defaultValue={editing?.videoStatus ?? "PENDING"}
          >
            <option value="PENDING">Sem vídeo</option>
            <option value="PROCESSING">Processando</option>
            <option value="READY">Pronto</option>
            <option value="ERROR">Erro</option>
          </Select>

          <SubmitButton fullWidth>
            {editing ? "Salvar" : "Adicionar episódio"}
          </SubmitButton>
        </form>
      </Modal>
    </section>
  );
}
