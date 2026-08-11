import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Abstração de armazenamento de imagens (pôster, backdrop, thumbnail).
 *
 * A implementação local grava em /public/uploads e serve para desenvolver sem
 * depender de credenciais. Trocar para Bunny Storage / S3 / R2 é implementar
 * esta interface e mudar STORAGE_DRIVER — nenhuma tela do admin muda.
 */
export interface StorageProvider {
  readonly driver: string;
  upload(file: File, folder: string): Promise<{ url: string }>;
}

/** Extensão derivada do MIME, nunca do nome enviado pelo usuário. */
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export class UploadValidationError extends Error {}

export function assertValidImage(file: File) {
  if (!(file.type in ALLOWED_MIME)) {
    throw new UploadValidationError(
      "Formato não suportado. Use JPG, PNG, WebP ou AVIF.",
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError("A imagem deve ter no máximo 5 MB.");
  }

  if (file.size === 0) {
    throw new UploadValidationError("Arquivo vazio.");
  }
}

const localStorage: StorageProvider = {
  driver: "local",

  async upload(file, folder) {
    assertValidImage(file);

    // Nome gerado por nós. Aceitar file.name permitiria "../../.env" ou
    // "x.png.html" — path traversal e upload de conteúdo executável.
    const extension = ALLOWED_MIME[file.type];
    const filename = `${randomUUID()}.${extension}`;

    // `folder` vem do nosso código, mas é sanitizado do mesmo jeito
    const safeFolder = folder.replace(/[^a-z0-9-]/gi, "");
    const directory = path.join(process.cwd(), "public", "uploads", safeFolder);

    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, filename),
      Buffer.from(await file.arrayBuffer()),
    );

    return { url: `/uploads/${safeFolder}/${filename}` };
  },
};

export function getStorageProvider(): StorageProvider {
  switch (process.env.STORAGE_DRIVER) {
    // case "bunny":
    //   return bunnyStorageProvider;
    default:
      return localStorage;
  }
}
