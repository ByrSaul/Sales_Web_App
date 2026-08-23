import { useMutation } from '@tanstack/react-query';
import { useSession } from '../../app/providers/SessionProvider';
import { supportService } from './supportService';
export const useSendSupport = () => {
  const { api } = useSession();
  return useMutation({
    mutationFn: (v: { email: string; body: string; files: File[] }) =>
      supportService(api).send(v.email, v.body, v.files),
    retry: false,
  });
};
