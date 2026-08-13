"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { Trash2 } from "lucide-react";

import {
  deleteTitleAction,
  upsertTitleAction,
  type AdminFormState,
} from "@/app/actions/admin";
import { ImageUpload } from "@/components/admin/image-upload";
import {
  TmdbImport,
  type TmdbImportPayload,
} from "@/components/admin/tmdb-import";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/utils";

const INITIAL: AdminFormState = {};

type Genre = { slug: string; name: string };

type TitleData = {
  id: string;
  name: string;
  slug: string;
  synopsis: string;
  type: string;
  status: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  logoUrl: string | null;
  trailerUrl: string | null;
  videoProvider: string;
  videoProviderId: string | null;
  videoUrl: string | null;
  videoStatus: string;
  releaseYear: number | null;
  durationSeconds: number | null;
  ageRating: string;
  director: string | null;
  country: string | null;
  cast: string[];
  isFeatured: boolean;
  popularity: number;
  genres: Genre[];
  tmdbId: number | null;
  tmdbRating: number | null;
  originalName: string | null;
};

export function TitleForm({
  title,
  allGenres,
}: {
  title: TitleData | null;
  allGenres: Genre[];
}) {
  const [state, formAction] = useFormState(upsertTitleAction, INITIAL);
  const [name, setName] = useState(title?.name ?? "");
  const [slug, setSlug] = useState(title?.slug ?? "");
  const [type, setType] = useState(title?.type ?? "MOVIE");
  const [slugTouched, setSlugTouched] = useState(Boolean(title));

  /**
   * Dados vindos do TMDB. Os campos do formulário são não-controlados
   * (defaultValue), então preencher exige remontar a árvore — daí o `key`
   * derivado daqui. Converter cada campo em estado controlado só para isso
   * seria muito mais código e re-render a cada tecla digitada.
   */
  const [seed, setSeed] = useState<TmdbImportPayload | null>(null);

  function applyTmdb(data: TmdbImportPayload) {
    setName(data.name);
    setSlug(data.slug);
    setSlugTouched(true);
    setType(data.type);
    setSeed(data);
  }

  /** Casa os gêneros do TMDB com os nossos, ignorando acento e caixa. */
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();

  const seededGenreSlugs = seed
    ? allGenres
        .filter((genre) =>
          seed.tmdbGenres.some((g) => normalize(g) === normalize(genre.name)),
        )
        .map((genre) => genre.slug)
    : null;

  const value = {
    synopsis: seed?.synopsis ?? title?.synopsis ?? "",
    status: title?.status ?? "DRAFT",
    ageRating: seed?.ageRating ?? title?.ageRating ?? "L",
    releaseYear: seed?.releaseYear ?? title?.releaseYear ?? "",
    durationSeconds: seed?.durationSeconds ?? title?.durationSeconds ?? "",
    country: seed?.country ?? title?.country ?? "",
    director: seed?.director ?? title?.director ?? "",
    cast: (seed?.cast ?? title?.cast ?? []).join(", "),
    posterUrl: seed?.posterUrl ?? title?.posterUrl ?? null,
    backdropUrl: seed?.backdropUrl ?? title?.backdropUrl ?? null,
    tmdbId: seed?.tmdbId ?? title?.tmdbId ?? "",
    tmdbRating: seed?.tmdbRating ?? title?.tmdbRating ?? "",
    originalName: seed?.originalName ?? title?.originalName ?? "",
  };

  // Slug acompanha o nome só até o admin editá-lo à mão. Depois disso,
  // sobrescrever seria destruir uma escolha deliberada — e o slug de um
  // título já publicado é a URL pública, que não pode mudar sozinha.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const isSeries = type === "SERIES";

  return (
    // key: remonta os campos não-controlados quando a importação do TMDB chega
    <form action={formAction} className="space-y-8" key={seed?.tmdbId ?? "base"}>
      <FormError message={state.error} />
      {title && <input type="hidden" name="id" value={title.id} />}

      {/* Metadados do TMDB não são editáveis à mão: são chave de integração,
          não conteúdo editorial. Digitar um id errado quebraria as recomendações. */}
      <input type="hidden" name="tmdbId" value={value.tmdbId} />
      <input type="hidden" name="tmdbRating" value={value.tmdbRating} />
      <input type="hidden" name="originalName" value={value.originalName} />

      {/* ---------- Identificação ---------- */}
      <section className="space-y-5 rounded-lg border border-border bg-surface/40 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Identificação
          </h2>
          <TmdbImport onImport={applyTmdb} />
        </div>

        {value.tmdbId && (
          <p className="rounded-md border border-border bg-surface px-3.5 py-2.5 text-xs text-muted">
            Vinculado ao TMDB #{value.tmdbId}
            {value.originalName ? ` · ${value.originalName}` : ""} — é esse
            vínculo que alimenta a trilha &ldquo;porque você assistiu&rdquo;.
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            name="name"
            label="Título"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={state.fieldErrors?.name}
            maxLength={160}
          />
          <Input
            name="slug"
            label="Slug (URL)"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            error={state.fieldErrors?.slug}
            hint="Apenas minúsculas, números e hífens."
          />
        </div>

        <Textarea
          name="synopsis"
          label="Sinopse"
          rows={4}
          defaultValue={value.synopsis}
          error={state.fieldErrors?.synopsis}
          maxLength={4000}
        />

        <div className="grid gap-5 sm:grid-cols-3">
          <Select
            name="type"
            label="Tipo"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="MOVIE">Filme</option>
            <option value="SERIES">Série</option>
          </Select>

          <Select name="status" label="Status" defaultValue={value.status}>
            <option value="DRAFT">Rascunho</option>
            <option value="PUBLISHED">Publicado</option>
            <option value="ARCHIVED">Arquivado</option>
          </Select>

          <Select
            name="ageRating"
            label="Classificação"
            defaultValue={value.ageRating}
          >
            <option value="L">Livre</option>
            <option value="TEN">10 anos</option>
            <option value="TWELVE">12 anos</option>
            <option value="FOURTEEN">14 anos</option>
            <option value="SIXTEEN">16 anos</option>
            <option value="EIGHTEEN">18 anos</option>
          </Select>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <Input
            name="releaseYear"
            type="number"
            label="Ano"
            defaultValue={value.releaseYear}
            error={state.fieldErrors?.releaseYear}
          />
          <Input
            name="durationSeconds"
            type="number"
            label="Duração (segundos)"
            defaultValue={value.durationSeconds}
            hint={isSeries ? "Séries usam a duração de cada episódio." : "Ex: 7200 = 2h"}
            disabled={isSeries}
          />
          <Input name="country" label="País" defaultValue={value.country} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            name="director"
            label="Direção"
            defaultValue={value.director}
          />
          <Input
            name="cast"
            label="Elenco"
            defaultValue={value.cast}
            hint="Separe os nomes por vírgula."
          />
        </div>

        <fieldset>
          <legend className="mb-3 text-[13px] font-medium text-muted">
            Gêneros
          </legend>
          <div className="flex flex-wrap gap-2">
            {allGenres.map((genre) => {
              const isChecked = title?.genres.some((g) => g.slug === genre.slug);
              return (
                <label
                  key={genre.slug}
                  className="cursor-pointer select-none rounded-full border border-border px-3.5 py-1.5 text-xs text-muted transition-colors hover:border-border-strong has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary"
                >
                  <input
                    type="checkbox"
                    name="genres"
                    value={genre.slug}
                    defaultChecked={isChecked}
                    className="sr-only"
                  />
                  {genre.name}
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      {/* ---------- Arte ---------- */}
      <section className="space-y-6 rounded-lg border border-border bg-surface/40 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Arte
        </h2>

        <ImageUpload
          name="posterUrl"
          label="Pôster (2:3)"
          folder="posters"
          defaultValue={title?.posterUrl}
          aspect="2/3"
          hint="Usado nos carrosséis do catálogo."
        />

        <ImageUpload
          name="backdropUrl"
          label="Backdrop (16:9)"
          folder="backdrops"
          defaultValue={title?.backdropUrl}
          aspect="16/9"
          hint="Fundo da Hero Section. Pôster 2:3 não serve aqui."
        />

        <ImageUpload
          name="logoUrl"
          label="Logo do título (PNG transparente)"
          folder="logos"
          defaultValue={title?.logoUrl}
          aspect="16/9"
          hint="Opcional. Sobreposto ao backdrop na Hero."
        />

        <Input
          name="trailerUrl"
          label="URL do trailer"
          defaultValue={title?.trailerUrl ?? ""}
          placeholder="https://..."
        />
      </section>

      {/* ---------- Vídeo ---------- */}
      <section className="space-y-5 rounded-lg border border-border bg-surface/40 p-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Vídeo
          </h2>
          {isSeries && (
            <p className="mt-2 text-xs text-muted-foreground">
              Séries têm vídeo por episódio. Cadastre os episódios após salvar.
            </p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            name="videoProvider"
            label="Provedor"
            defaultValue={title?.videoProvider ?? "BUNNY"}
            disabled={isSeries}
          >
            <option value="BUNNY">Bunny Stream</option>
            <option value="MUX">Mux</option>
            <option value="EXTERNAL">Externo</option>
          </Select>

          <Select
            name="videoStatus"
            label="Status do vídeo"
            defaultValue={title?.videoStatus ?? "PENDING"}
            disabled={isSeries}
          >
            <option value="PENDING">Sem vídeo</option>
            <option value="PROCESSING">Processando</option>
            <option value="READY">Pronto</option>
            <option value="ERROR">Erro</option>
          </Select>
        </div>

        <Input
          name="videoProviderId"
          label="ID do vídeo no provedor"
          defaultValue={title?.videoProviderId ?? ""}
          placeholder="GUID do Bunny / playbackId do Mux"
          disabled={isSeries}
        />

        <Input
          name="videoUrl"
          label="URL HLS (.m3u8)"
          defaultValue={title?.videoUrl ?? ""}
          placeholder="https://vz-xxxx.b-cdn.net/.../playlist.m3u8"
          hint="Opcional se o ID do provedor estiver preenchido."
          disabled={isSeries}
        />
      </section>

      {/* ---------- Curadoria ---------- */}
      <section className="space-y-5 rounded-lg border border-border bg-surface/40 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Curadoria
        </h2>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={title?.isFeatured}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">
              Candidato à Hero Section
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Precisa ter backdrop 16:9 para aparecer bem.
            </span>
          </span>
        </label>

        <Input
          name="popularity"
          type="number"
          label="Score de popularidade"
          defaultValue={title?.popularity ?? 0}
          hint='Ordena a trilha "Em alta". Maior aparece primeiro.'
          min={0}
          max={10000}
        />
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton size="md">
          {title ? "Salvar alterações" : "Criar título"}
        </SubmitButton>

        {state.success && (
          <span className="text-sm text-success">Alterações salvas.</span>
        )}

        {title && (
          <Button
            type="button"
            variant="ghost"
            size="md"
            className="ml-auto text-danger hover:bg-danger/10 hover:text-danger"
            onClick={() => {
              if (
                confirm(
                  `Excluir "${title.name}"? Episódios, progresso e listas dos assinantes vinculados também serão apagados.`,
                )
              ) {
                void deleteTitleAction(title.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Excluir
          </Button>
        )}
      </div>
    </form>
  );
}
