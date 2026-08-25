import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { useSession } from '../../app/providers/SessionProvider';
import { userErrorMessage } from '../../core/api/errors';
import { useSendSupport } from '../../features/support/supportMutation';
import { validateSupport } from '../../features/support/supportService';
import { Button, Card } from '../ui';
const SupportPage = () => {
  const auth = useAuth(),
    { context } = useSession(),
    nav = useNavigate(),
    mutation = useSendSupport();
  const supportUserEmail =
    auth.account?.username?.trim() || context.user?.networkAlias.trim() || '';
  const [body, setBody] = useState(''),
    [files, setFiles] = useState<File[]>([]),
    [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle'),
    [message, setMessage] = useState('');
  const lock = useRef(false);
  const dirty = Boolean(body.trim() || files.length);
  useEffect(() => {
    if (!dirty) return;
    const fn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', fn);
    return () => removeEventListener('beforeunload', fn);
  }, [dirty]);
  const leave = () => {
    if (!dirty || window.confirm('Hay contenido sin enviar. ¿Desea salir y descartarlo?'))
      nav('/home');
  };
  const send = async () => {
    if (lock.current) return;
    const error = validateSupport(body, files);
    if (error) {
      setStatus('error');
      setMessage(error);
      return;
    }
    if (!window.confirm('¿Desea enviar este mensaje al soporte técnico?')) return;
    lock.current = true;
    setStatus('sending');
    setMessage('');
    try {
      const r = await mutation.mutateAsync({ email: supportUserEmail, body, files });
      if (!r.success) throw new Error(r.errorMessage || 'Dynamics no confirmó el envío.');
      setBody('');
      setFiles([]);
      setStatus('success');
      setMessage(r.message || 'Mensaje enviado exitosamente al soporte técnico.');
    } catch (e) {
      setStatus('error');
      setMessage(
        `${userErrorMessage(e)}${String(e).toLowerCase().includes('timeout') ? ' No fue posible verificar si el mensaje fue enviado. Evita reenviarlo inmediatamente.' : ''}`,
      );
    } finally {
      lock.current = false;
    }
  };
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-bold">Soporte técnico</h1>
      <Card className="p-4 text-sm">
        <p>
          Destinatario: <strong>soporte@foragro.com</strong>
        </p>
        <p>
          Asunto: <strong>Sales4App</strong>
        </p>
        <p>
          Usuario: <strong>{supportUserEmail || 'No disponible'}</strong>
        </p>
      </Card>
      <Card className="p-4 space-y-4">
        <label className="block text-sm">
          Mensaje
          <textarea
            aria-label="Mensaje"
            rows={8}
            value={body}
            disabled={status === 'sending'}
            onChange={(e) => {
              setBody(e.target.value);
              setStatus('idle');
            }}
            className="mt-1 w-full border rounded-lg p-3"
            placeholder="Describe tu problema o consulta..."
          />
        </label>
        <label className="inline-flex cursor-pointer rounded-lg border px-4 py-2 text-sm">
          Adjuntar imágenes
          <input
            aria-label="Adjuntar imágenes"
            hidden
            type="file"
            accept="image/*"
            multiple
            disabled={status === 'sending'}
            onChange={(e) =>
              setFiles((current) => [...current, ...Array.from(e.target.files ?? [])])
            }
          />
        </label>
        {files.map((f, i) => (
          <div key={`${f.name}-${i}`} className="flex justify-between text-sm border-t pt-2">
            <span>
              {f.name} · {(f.size / 1024).toFixed(1)} KB
            </span>
            <Button
              size="sm"
              variant="danger"
              disabled={status === 'sending'}
              onClick={() => setFiles((x) => x.filter((_, n) => n !== i))}
            >
              Eliminar
            </Button>
          </div>
        ))}
        {message && (
          <p role="status" className={status === 'success' ? 'text-primary' : 'text-error'}>
            {message}
          </p>
        )}
        <div className="flex gap-2">
          <Button loading={status === 'sending'} onClick={send}>
            Enviar al soporte técnico
          </Button>
          <Button variant="outline" disabled={status === 'sending'} onClick={leave}>
            Cancelar
          </Button>
        </div>
      </Card>
    </div>
  );
};
export default SupportPage;
