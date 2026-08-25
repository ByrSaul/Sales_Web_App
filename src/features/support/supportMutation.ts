import { useMutation } from '@tanstack/react-query';
import { useSession } from '../../app/providers/SessionProvider';
import { supportService } from './supportService';
/**
 * Mutación encargada de validar, codificar y enviar una solicitud de soporte.
 *
 * Endpoint:
 * - `POST /support/send_email`
 *
 * @returns Estado y operación de envío gestionados por TanStack Query.
 */
export const useSendSupport = () => {
  const { api } = useSession();
  return useMutation({
    mutationFn: (v: { email: string; body: string; files: File[] }) =>
      supportService(api).send(v.email, v.body, v.files),
    retry: false,
  });
};
