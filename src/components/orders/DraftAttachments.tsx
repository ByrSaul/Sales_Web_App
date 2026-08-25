import { useEffect } from 'react';
import { useOrderDraft } from '../../features/orderDraft/OrderDraftProvider';
import { extensionOf, isPaymentImage, requiresPaymentAttachment, validateAttachment } from '../../features/attachments/attachmentValidation';
import { Button, Card, Input } from '../ui';

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export const DraftAttachments = ({ readOnly = false }: { readOnly?: boolean }) => {
  const { draft, attachments, setAttachments } = useOrderDraft();
  useEffect(() => {
    if (!attachments.length) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [attachments.length]);

  if (readOnly)
    return (
      <Card className="space-y-2 p-4">
        <h2 className="font-bold">Adjuntos preparados ({attachments.length})</h2>
        {!attachments.length && <p className="text-xs text-on-surface-variant">Sin adjuntos.</p>}
        {attachments.map((item) => <p key={item.localId} className="text-sm">{item.fileName} · {item.description}</p>)}
      </Card>
    );

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-bold">Adjuntos (opcional)</h2><p className="text-xs">Se subirán después de crear el encabezado. No sobreviven un refresh.</p></div>
        <label className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
          Agregar archivo
          <input className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            const extension = extensionOf(file.name);
            const description = requiresPaymentAttachment(draft.customer?.account) && isPaymentImage('pago', extension) ? 'pago' : '';
            const validation = validateAttachment(file, description);
            setAttachments((current) => [...current, { localId: newId(), file, fileName: file.name, extension, description, status: validation ? 'failed' : 'pending', error: validation ?? '', attempts: 0 }]);
          }} />
        </label>
      </div>
      {attachments.map((item) => (
        <div key={item.localId} className="grid gap-2 border-t pt-3 sm:grid-cols-[1fr_2fr_auto]">
          <p className="min-w-0 truncate text-sm font-semibold">{item.fileName}</p>
          <Input maxLength={100} aria-label={`Descripción ${item.fileName}`} placeholder="Descripción" value={item.description} onChange={(event) => setAttachments((current) => current.map((value) => value.localId === item.localId ? { ...value, description: event.target.value, status: validateAttachment(value.file, event.target.value) ? 'failed' : 'pending', error: validateAttachment(value.file, event.target.value) ?? '' } : value))} />
          <Button size="sm" variant="danger" onClick={() => setAttachments((current) => current.filter((value) => value.localId !== item.localId))}>Eliminar</Button>
          {item.error && <p className="text-xs text-error sm:col-span-3">{item.error}</p>}
        </div>
      ))}
    </Card>
  );
};
