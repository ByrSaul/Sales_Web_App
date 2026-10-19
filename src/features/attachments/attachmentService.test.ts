import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../core/api/apiClient';
import type { OrderAttachment } from './attachmentTypes';
import { attachmentService, fileToBase64, openAttachment, safeDownloadName } from './attachmentService';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Simulates browser read failures and malformed results; normal encoding is also tested with
// the real jsdom FileReader in attachments.test.ts.
const simulateRead = (result: string | ArrayBuffer | null, fail = false) => {
  vi.stubGlobal('FileReader', class {
    readonly result = result;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL() {
      if (fail) this.onerror?.();
      else this.onload?.();
    }
  });
};

describe('file encoding failures', () => {
  it('rejects a FileReader error instead of submitting an empty attachment', async () => {
    simulateRead(null, true);
    const post = vi.fn();
    await expect(attachmentService({ post } as unknown as ApiClient).upload(
      'CO', 'OV', new File(['data'], 'a.pdf'), 'receipt',
    )).rejects.toThrow('No se pudo leer el archivo.');
    expect(post).not.toHaveBeenCalled();
  });

  it.each([null, new ArrayBuffer(2)])('rejects a non-string FileReader result (%s)', async (result) => {
    simulateRead(result);
    await expect(fileToBase64(new File(['data'], 'a.pdf'))).rejects.toThrow('El resultado del archivo no es válido.');
  });

  it('rejects a result without the Data URL separator', async () => {
    simulateRead('not-a-data-url');
    await expect(fileToBase64(new File(['data'], 'a.pdf'))).rejects.toThrow('El formato del archivo no es válido.');
  });
});

describe('attachment HTTP contracts', () => {
  it('passes the cancellation signal and maps an OData query response', async () => {
    const post = vi.fn().mockResolvedValue({ '@odata': [{ DocumentId: 'D', FileName: 'receipt' }] });
    const { signal } = new AbortController();
    const result = await attachmentService({ post } as unknown as ApiClient).list('CO', 'OV', signal);
    expect(post).toHaveBeenCalledExactlyOnceWith(
      '/d365/sales_header_documents_atachments/query',
      { filters: { dataAreaId: 'CO', SalesOrderNumber: 'OV' }, cross_company: true, page: 1, perpage: 20 },
      { signal },
    );
    expect(result).toEqual([{
      companyId: '', salesOrderNumber: '', documentId: 'D', fileName: 'receipt',
      fileType: '', description: '', attachmentType: '', contentBase64: '',
    }]);
  });

  it.each([
    ['photo.JPG', 'jpg', 'Imagen', 'photo'],
    ['photo.jpeg', 'jpeg', 'Imagen', 'photo'],
    ['photo.PNG', 'png', 'Imagen', 'photo'],
    ['receipt.PDF', 'pdf', 'Archivo', 'receipt'],
    ['receipt.pdf.pdf', 'pdf', 'Archivo', 'receipt.pdf'],
    ['no-extension', '', 'Archivo', 'no-extension'],
  ])('serializes %s without changing the original file', async (name, extension, kind, baseName) => {
    const post = vi.fn().mockResolvedValue([{ DocumentId: 'D', FileName: baseName }]);
    const file = new File(['data'], name);
    const result = await attachmentService({ post } as unknown as ApiClient).upload('CO', 'OV', file, ' receipt ');
    expect(post).toHaveBeenCalledExactlyOnceWith(
      '/d365/sales_header_documents_atachments',
      {
        dataAreaId: 'CO', SalesOrderNumber: 'OV', FileName: baseName, FileType: extension,
        DocumentAttachmentTypeCode: kind, AttachmentDescription: 'receipt', Attachment: 'ZGF0YQ==',
      },
      { timeoutMs: 120_000 },
    );
    expect(file.name).toBe(name);
    expect(result.documentId).toBe('D');
  });

  it('handles an empty upload response array without inventing a document identifier', async () => {
    const post = vi.fn().mockResolvedValue([]);
    const result = await attachmentService({ post } as unknown as ApiClient).upload('CO', 'OV', new File(['x'], 'a.pdf'), 'A');
    expect(result.documentId).toBe('');
  });

  it('propagates an upload failure without retrying', async () => {
    const error = new Error('upload unavailable');
    const post = vi.fn().mockRejectedValue(error);
    await expect(attachmentService({ post } as unknown as ApiClient).upload(
      'CO', 'OV', new File(['x'], 'a.pdf'), 'A',
    )).rejects.toBe(error);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe('safe download names', () => {
  it.each([
    ['C:\\folder\\receipt.PDF', '.PDF', 'receipt.PDF'],
    ['../../receipt', '..p?d*f', 'receipt.pdf'],
    [' <re:ceipt>|?*\u0000\u007f ', 'PDF', 'receipt.pdf'],
    ['../', 'png', 'archivo.png'],
    ['receipt.pdf', 'pdf', 'receipt.pdf'],
    ['receipt', '***', 'receipt'],
    ['receipt', '', 'receipt'],
  ])('sanitizes %s and extension %s', (name, extension, expected) => {
    expect(safeDownloadName(name, extension)).toBe(expected);
  });
});

describe('attachment opening and object URL lifecycle', () => {
  const attachment = (extension: string): OrderAttachment => ({
    companyId: 'CO', salesOrderNumber: 'OV', documentId: 'D', fileName: '../../receipt',
    fileType: extension, description: '', attachmentType: 'Archivo', contentBase64: 'YQ==',
  });

  const mockUrls = () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:attachment');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    return { create, revoke };
  };

  it.each([
    ['PDF', 'application/pdf'], ['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'],
  ])('opens %s with its MIME type and releases its URL after 60 seconds', (extension, mime) => {
    const { create, revoke } = mockUrls();
    const open = vi.fn(() => null);
    expect(openAttachment(attachment(extension), open)).toBe('receipt.' + extension.toLowerCase());
    expect(open).toHaveBeenCalledExactlyOnceWith('blob:attachment');
    const blob = create.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob).toMatchObject({ type: mime, size: 1 });
    vi.advanceTimersByTime(59_999);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:attachment');
  });

  it('uses the default browser opener with noopener', () => {
    const { revoke } = mockUrls();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    openAttachment(attachment('pdf'));
    expect(open).toHaveBeenCalledExactlyOnceWith('blob:attachment', '_blank', 'noopener');
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:attachment');
  });

  it('downloads an unknown type with a sanitized filename and releases the URL', () => {
    const { create, revoke } = mockUrls();
    const open = vi.fn(() => null);
    const anchors: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      anchors.push(this);
    });
    expect(openAttachment(attachment('ZIP'), open)).toBe('receipt.zip');
    expect(open).not.toHaveBeenCalled();
    expect(anchors).toHaveLength(1);
    expect(anchors[0].href).toBe('blob:attachment');
    expect(anchors[0].download).toBe('receipt.zip');
    expect(create.mock.calls[0][0]).toMatchObject({ type: 'application/octet-stream' });
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:attachment');
  });

  it('rejects invalid Base64 before allocating an object URL', () => {
    const { create } = mockUrls();
    expect(() => openAttachment({ ...attachment('pdf'), contentBase64: '%%%invalid' })).toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it.each(['pdf', 'zip'])('releases the temporary URL even when opening %s throws', (extension) => {
    const { revoke } = mockUrls();
    const failure = new Error('browser failure');
    const open = vi.fn(() => { throw failure; });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw failure; });
    expect(() => openAttachment(attachment(extension), open)).toThrow(failure);
    vi.advanceTimersByTime(60_000);
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:attachment');
  });
});
