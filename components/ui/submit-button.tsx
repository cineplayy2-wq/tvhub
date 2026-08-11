"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Botão de submit ciente do estado do formulário.
 * useFormStatus só funciona em um filho do <form> — por isso é um componente
 * separado, e não um estado no próprio formulário.
 */
export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" isLoading={pending} {...props}>
      {children}
    </Button>
  );
}
