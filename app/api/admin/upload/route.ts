import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  UploadValidationError,
  getStorageProvider,
} from "@/lib/storage/provider";

const ALLOWED_FOLDERS = ["posters", "backdrops", "logos", "thumbnails"];

export async function POST(request: Request) {
  // Route handler não passa pelo middleware desta rota (/api é excluído do
  // matcher), então a autorização precisa acontecer aqui.
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = String(formData.get("folder") ?? "posters");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  }

  // Allowlist: impede que o client escolha um diretório arbitrário
  if (!ALLOWED_FOLDERS.includes(folder)) {
    return NextResponse.json({ error: "Destino inválido." }, { status: 400 });
  }

  try {
    const { url } = await getStorageProvider().upload(file, folder);
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[upload] falha:", error);
    return NextResponse.json(
      { error: "Não foi possível enviar a imagem." },
      { status: 500 },
    );
  }
}
