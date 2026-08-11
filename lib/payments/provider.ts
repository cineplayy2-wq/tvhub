import "server-only";

import type { PaymentGateway, PaymentStatus } from "@prisma/client";

/**
 * Contrato que qualquer plataforma de cobrança precisa cumprir.
 *
 * O resto do sistema (checkout, webhooks, renovação, painel admin) fala só com
 * esta interface. Trocar de provedor PIX vira implementar um arquivo novo e
 * mudar a variável PAYMENT_GATEWAY — nenhuma regra de negócio se move.
 */

export type CreateChargeInput = {
  userId: string;
  planSlug: string;
  amountCents: number;
  description: string;
  /** Dados do pagador — a maioria dos provedores PIX exige CPF. */
  payer: {
    name: string;
    email: string;
    taxId?: string;
  };
};

export type Charge = {
  /** ID da cobrança no provedor. */
  externalId: string;
  status: PaymentStatus;
  amountCents: number;
  /** Imagem do QR Code (URL ou data URI). */
  qrCodeUrl?: string;
  /** Código "copia e cola" do PIX. */
  copyPaste?: string;
  expiresAt?: Date;
  /** txid / endToEndId, para conciliação bancária. */
  pixTxId?: string;
};

export type WebhookResult = {
  /** ID da cobrança no provedor, para casar com Payment.externalId. */
  externalId: string;
  status: PaymentStatus;
  /** Evento do provedor, guardado em WebhookEvent para idempotência. */
  eventId: string;
  eventType: string;
  paidAt?: Date;
  raw: unknown;
};

export interface PaymentProvider {
  readonly gateway: PaymentGateway;

  createCharge(input: CreateChargeInput): Promise<Charge>;

  getCharge(externalId: string): Promise<Charge>;

  /**
   * Valida a assinatura do webhook e normaliza o payload.
   * DEVE lançar se a assinatura não conferir — sem isso qualquer um
   * consegue marcar uma assinatura como paga com um POST.
   */
  parseWebhook(rawBody: string, signature: string | null): Promise<WebhookResult>;
}

export class PaymentProviderNotConfiguredError extends Error {
  constructor() {
    super(
      "Nenhum provedor de pagamento configurado. Defina PAYMENT_GATEWAY e implemente o provider correspondente em lib/payments/.",
    );
    this.name = "PaymentProviderNotConfiguredError";
  }
}

/**
 * Placeholder até a plataforma PIX ser escolhida.
 * Falha alto e claro em vez de fingir sucesso — uma assinatura marcada como
 * paga sem cobrança real é pior do que um erro visível.
 */
const notConfiguredProvider: PaymentProvider = {
  gateway: "PIX_PROVIDER",
  async createCharge() {
    throw new PaymentProviderNotConfiguredError();
  },
  async getCharge() {
    throw new PaymentProviderNotConfiguredError();
  },
  async parseWebhook() {
    throw new PaymentProviderNotConfiguredError();
  },
};

export function getPaymentProvider(): PaymentProvider {
  switch (process.env.PAYMENT_GATEWAY) {
    // case "MERCADO_PAGO":
    //   return mercadoPagoProvider;
    // case "ASAAS":
    //   return asaasProvider;
    default:
      return notConfiguredProvider;
  }
}

export function isPaymentConfigured() {
  return getPaymentProvider() !== notConfiguredProvider;
}
