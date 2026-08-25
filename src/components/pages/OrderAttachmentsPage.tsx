import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { userErrorMessage } from '../../core/api/errors';
import { openAttachment } from '../../features/attachments/attachmentService';
import {
  useAttachmentUploader,
  useOrderAttachments,
} from '../../features/attachments/attachmentQueries';
import type { PendingAttachment } from '../../features/attachments/attachmentTypes';
import { extensionOf, validateAttachment } from '../../features/attachments/attachmentValidation';
import { Button, Card, EmptyState, Input } from '../ui';

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const OrderAttachmentsPage = () => {
  const { salesOrderNumber = '' } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const existing = useOrderAttachments(salesOrderNumber);
  const uploader = useAttachmentUploader(salesOrderNumber);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const locks = useRef(new Set<string>());
  const uploading = pending.some(
    (item) =>
      item.status === 'encoding' ||
      item.status === 'uploading' ||
      item.status === 'verifying',
  );
  useEffect(() => {
    if (!uploading) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [uploading]);
  const patchItem = (id: string, change: Partial<PendingAttachment>) =>
    setPending((current) =>
      current.map((item) => (item.localId === id ? { ...item, ...change } : item)),
    );
  const select = (file: File) =>
    setPending((current) => [
      ...current,
      {
        localId: newId(),
        file,
        fileName: file.name,
        extension: extensionOf(file.name),
        description: '',
        status: 'pending',
        error: '',
        attempts: 0,
      },
    ]);
  const send = async (id: string) => {
    if (locks.current.has(id)) return;
    const item = pending.find((value) => value.localId === id);
    if (!item || item.status === 'success') return;
    const validation = validateAttachment(item.file, item.description);
    if (validation) {
      patchItem(id, { status: 'failed', error: validation });
      return;
    }
    locks.current.add(id);
    patchItem(id, { status: 'encoding', error: '', attempts: item.attempts + 1 });
    try {
      patchItem(id, { status: 'uploading' });
      await uploader.upload(item.file, item.description);
      await uploader.refresh();
      const confirmation = await existing.refetch();
      const baseName = item.fileName.slice(0, -(item.extension.length + 1));
      const persisted = confirmation.data?.some(
        (attachment) =>
          [attachment.fileName, `${attachment.fileName}.${attachment.fileType}`].some(
            (name) =>
              name.toLowerCase() === item.fileName.toLowerCase() ||
              name.toLowerCase() === baseName.toLowerCase(),
          ) && attachment.description.trim() === item.description.trim(),
      );
      if (persisted) setPending((current) => current.filter((value) => value.localId !== id));
      else
        patchItem(id, {
          status: 'ambiguous',
          error: 'El upload respondió correctamente, pero el documento todavía no aparece en la consulta. No se reenviará automáticamente.',
        });
    } catch (error) {
      patchItem(id, { status: 'verifying', error: userErrorMessage(error) });
      const verification = await existing.refetch();
      const expectedBaseName = item.fileName.slice(0, -(item.extension.length + 1));
      const persisted = verification.data?.some(
        (attachment) =>
          [attachment.fileName, `${attachment.fileName}.${attachment.fileType}`].some(
            (name) =>
              name.toLowerCase() === item.fileName.toLowerCase() ||
              name.toLowerCase() === expectedBaseName.toLowerCase(),
          ) && attachment.description.trim() === item.description.trim(),
      );
      if (persisted) setPending((current) => current.filter((value) => value.localId !== id));
      else
        patchItem(id, {
              status: 'ambiguous',
              error: `${userErrorMessage(error)} Se consultó nuevamente Dynamics, pero todavía no puede confirmarse el resultado. No se reenviará automáticamente.`,
            });
    } finally {
      locks.current.delete(id);
    }
  };
  const sendPending = async () => {
    for (const item of pending)
      if (item.status === 'pending') await send(item.localId);
  };
  const back = `/pedidos/${encodeURIComponent(salesOrderNumber)}${search.toString() ? `?${search}` : ''}`;
  return (
    <div className="space-y-4">
      <button className="text-sm text-primary" onClick={() => navigate(back)}>
        ← Volver al pedido
      </button>
      <div>
        <h1 className="text-xl font-bold">Adjuntos · {salesOrderNumber}</h1>
        <p className="text-xs text-on-surface-variant">
          Los archivos locales pendientes se muestran separados de los documentos almacenados en
          Dynamics.
        </p>
      </div>
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap justify-between gap-2">
          <div>
            <h2 className="font-bold">Archivos pendientes</h2>
            <p className="text-xs">PDF, JPG, JPEG o PNG · máximo 5 MB · descripción obligatoria.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
            Agregar archivo
            <input
              aria-label="Seleccionar archivo"
              className="sr-only"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) select(file);
                event.target.value = '';
              }}
            />
          </label>
        </div>
        {!pending.length && <EmptyState title="No hay archivos seleccionados" />}
        {pending.map((item) => (
          <div key={item.localId} className="grid gap-2 border-t pt-3 md:grid-cols-[1fr_2fr_auto]">
            <div>
              <strong className="text-sm">{item.fileName}</strong>
              <small className="block">
                {(item.file.size / 1024).toFixed(1)} KB · Intentos: {item.attempts}
              </small>
            </div>
            <Input
              aria-label={`Descripción ${item.fileName}`}
              maxLength={100}
              value={item.description}
              disabled={
                item.status === 'encoding' ||
                item.status === 'uploading' ||
                item.status === 'verifying' ||
                item.status === 'ambiguous' ||
                item.status === 'success'
              }
              onChange={(event) =>
                patchItem(item.localId, {
                  description: event.target.value,
                  status: item.status === 'failed' ? 'pending' : item.status,
                  error: '',
                })
              }
              placeholder="Descripción"
            />
            <div className="flex items-center gap-2">
              <span role="status" className="text-xs">
                {
                  {
                    pending: 'Pendiente',
                    encoding: 'Preparando archivo',
                    uploading: 'Enviando',
                    verifying: 'Verificando resultado',
                    ambiguous: 'Resultado ambiguo',
                    success: 'Confirmado',
                    failed: 'Falló',
                  }[item.status]
                }
              </span>
              {item.status === 'failed' && (
                <Button size="sm" onClick={() => send(item.localId)}>
                  Reintentar
                </Button>
              )}
              {item.status === 'ambiguous' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    patchItem(item.localId, { status: 'verifying' });
                    const verification = await existing.refetch();
                    const baseName = item.fileName.slice(0, -(item.extension.length + 1));
                    const persisted = verification.data?.some(
                      (attachment) =>
                        [attachment.fileName, `${attachment.fileName}.${attachment.fileType}`].some(
                          (name) =>
                            name.toLowerCase() === item.fileName.toLowerCase() ||
                            name.toLowerCase() === baseName.toLowerCase(),
                        ) && attachment.description.trim() === item.description.trim(),
                    );
                    if (persisted)
                      setPending((current) =>
                        current.filter((value) => value.localId !== item.localId),
                      );
                    else
                      patchItem(item.localId, {
                            status: 'ambiguous',
                            error: 'Dynamics todavía no permite confirmar si el archivo fue persistido. No se reenviará automáticamente.',
                          });
                  }}
                >
                  Verificar nuevamente
                </Button>
              )}
              {item.status === 'pending' && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    setPending((current) =>
                      current.filter((value) => value.localId !== item.localId),
                    )
                  }
                >
                  Eliminar
                </Button>
              )}
            </div>
            {item.error && <p className="text-xs text-error md:col-span-3">{item.error}</p>}
          </div>
        ))}
        {!!pending.length && (
          <Button
            disabled={uploading || !pending.some((item) => item.status === 'pending')}
            onClick={sendPending}
          >
            Subir pendientes
          </Button>
        )}
      </Card>
      <Card className="p-4 space-y-3">
        <h2 className="font-bold">Adjuntos existentes</h2>
        {existing.isLoading && (
          <p className="text-xs text-on-surface-variant">Consultando adjuntos...</p>
        )}
        {existing.isError && (
          <p className="text-sm text-error">
            No fue posible consultar los adjuntos.{' '}
            <button className="underline" onClick={() => void existing.refetch()}>
              Reintentar consulta
            </button>
          </p>
        )}
        {existing.data?.length === 0 && <EmptyState title="Este pedido no tiene adjuntos" />}
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {existing.data?.map((item) => (
            <div
              key={item.documentId || `${item.fileName}-${item.description}`}
              className="flex justify-between border-t pt-3"
            >
              <div>
                <strong>
                  {item.fileName}.{item.fileType}
                </strong>
                <small className="block">{item.description || 'Sin descripción'}</small>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!item.contentBase64}
                onClick={() => openAttachment(item)}
              >
                Abrir o descargar
              </Button>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-3 bg-amber-50">
        <strong>RIESGO — upload sin idempotency key</strong>
        <p className="text-xs">
          El endpoint no acepta hash, correlación ni clave externa. No hay reintento automático;
          tras timeout debe verificarse el listado antes de reenviar.
        </p>
      </Card>
    </div>
  );
};
export default OrderAttachmentsPage;
