import { Accordion, type AccordionItem } from "@/components/ui/accordion";

/**
 * FAQ de conversão: cada pergunta é uma objeção real de quem está com o dedo
 * no botão. Ordem = ordem em que a dúvida aparece na cabeça do visitante,
 * não ordem de importância para nós.
 */
const ITEMS: AccordionItem[] = [
  {
    question: "Tem anúncio em algum plano?",
    answer:
      "Nenhum. Não existe versão mais barata com propaganda, não existe comercial antes do filme e não existe corte no meio. Em qualquer plano, você aperta play e o filme começa.",
  },
  {
    question: "Quantas pessoas podem assistir ao mesmo tempo?",
    answer:
      "Duas, incluídas no preço base — não é upgrade nem cobrança extra. Você pode criar até 4 perfis com históricos separados, mas apenas 2 reproduzem vídeo ao mesmo tempo. Se um terceiro aparelho tentar dar play, ele é bloqueado, e você pode encerrar a sessão do outro aparelho direto pela tela de bloqueio.",
  },
  {
    question: "Preciso cadastrar cartão de crédito?",
    answer:
      "Não. O pagamento é por PIX e nada é debitado automaticamente da sua conta. Avisamos por e-mail antes de cada renovação e você aprova a cobrança — se ignorar, simplesmente não é cobrado.",
  },
  {
    question: "Tem fidelidade ou multa para cancelar?",
    answer:
      "Não existe contrato de permanência. O botão de cancelar fica na sua conta, a um clique, sem falar com ninguém e sem ligação de retenção. O acesso continua até o fim do período que você já pagou e nenhuma cobrança nova é gerada.",
  },
  {
    question: "Vale a pena o plano anual?",
    answer:
      "O anual sai por R$ 197,00 uma única vez, o equivalente a R$ 16,42 por mês — contra R$ 358,80 se você pagar 12 meses avulsos. A economia é de R$ 161,80 no ano e o preço fica travado por 12 meses, imune a reajuste.",
  },
  {
    question: "Funciona na TV?",
    answer:
      "Sim. A plataforma roda no navegador de qualquer aparelho, incluindo o da smart TV, além de celular, tablet e computador. Não é preciso instalar aplicativo.",
  },
  {
    question: "E se eu ficar sem internet no meio do filme?",
    answer:
      "O ponto exato onde você parou fica salvo. Ao voltar, o filme retoma de onde estava — no mesmo aparelho ou em outro.",
  },
];

export function Faq() {
  return (
    <section id="perguntas" className="scroll-mt-20 px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="flex items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
          <span className="h-px w-8 bg-primary" aria-hidden />
          Dúvidas
        </p>
        <h2 className="mb-12 mt-6 text-balance text-center font-display text-display-sm uppercase leading-[0.95] tracking-tightest text-foreground">
          Antes que você pergunte
        </h2>
        <Accordion items={ITEMS} />
      </div>
    </section>
  );
}
