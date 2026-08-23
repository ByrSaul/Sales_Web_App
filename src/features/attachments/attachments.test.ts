import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../core/api/apiClient';
import { attachmentKeys } from './attachmentQueries';
import {
  attachmentService,
  fileToBase64,
  openAttachment,
  safeDownloadName,
} from './attachmentService';
import {
  isPaymentDescription,
  MAX_ATTACHMENT_BYTES,
  validateAttachment,
} from './attachmentValidation';

describe('attachment contracts', () => {
  it('segregates query keys by company and order', () =>
    expect(attachmentKeys.order('CO', 'OV-1')).toEqual(['order-attachments', 'CO', 'OV-1']));
  it('maps the exact GET-body contract used by Mobile', async () => {
    const get = vi
      .fn()
      .mockResolvedValue([
        {
          dataAreaId: 'CO',
          SalesOrderNumber: 'OV-1',
          FileName: 'pago',
          FileType: 'pdf',
          AttachmentDescription: 'pago',
          Attachment: 'AA==',
        },
      ]);
    const service = attachmentService({ get } as unknown as ApiClient);
    const result = await service.list('CO', 'OV-1');
    expect(get).toHaveBeenCalledWith('/d365/sales_header_documents_atachments', {
      body: {
        filters: { dataAreaId: 'CO', SalesOrderNumber: 'OV-1' },
        cross_company: true,
        page: 1,
        perpage: 20,
      },
    });
    expect(result[0].description).toBe('pago');
  });
  it('encodes pure base64 without the Data URL prefix', async () => {
    const result = await fileToBase64(new File(['hola'], 'a.pdf', { type: 'application/pdf' }));
    expect(result).toBe('aG9sYQ==');
    expect(result).not.toContain('data:');
  });
  it('uploads the exact header payload and strips extension from FileName', async () => {
    const post = vi.fn().mockResolvedValue({ DocumentId: 'D1' });
    const service = attachmentService({ post } as unknown as ApiClient);
    await service.upload('CO', 'OV-1', new File(['%PDF'], 'recibo.pdf'), ' pago ');
    expect(post).toHaveBeenCalledWith(
      '/d365/sales_header_documents_atachments',
      expect.objectContaining({
        dataAreaId: 'CO',
        AttachmentDescription: 'pago',
        SalesOrderNumber: 'OV-1',
        FileType: 'pdf',
        DocumentAttachmentTypeCode: 'Archivo',
        FileName: 'recibo',
        Attachment: 'JVBERg==',
      }),
      { timeoutMs: 120000 },
    );
  });
  it('uses Imagen only for Mobile image extensions', async () => {
    const post = vi.fn().mockResolvedValue({});
    await attachmentService({ post } as unknown as ApiClient).upload(
      'CO',
      'OV',
      new File(['x'], 'foto.JPEG'),
      'foto',
    );
    expect(post.mock.calls[0][1]).toMatchObject({
      FileType: 'jpeg',
      DocumentAttachmentTypeCode: 'Imagen',
    });
  });
});

describe('attachment validation and payment semantics', () => {
  it('enforces backend extensions and 5 MB', () => {
    expect(validateAttachment(new File(['x'], 'a.txt'), 'ok')).toMatch(/PDF/);
    expect(
      validateAttachment(new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], 'a.pdf'), 'ok'),
    ).toMatch(/5 MB/);
  });
  it('requires a trimmed description with Mobile length', () => {
    expect(validateAttachment(new File(['x'], 'a.pdf'), '   ')).toMatch(/obligatoria/);
    expect(validateAttachment(new File(['x'], 'a.pdf'), 'x'.repeat(101))).toMatch(/100/);
  });
  it('recognizes pago using Mobile trim and lowercase semantics', () => {
    expect(isPaymentDescription('pago')).toBe(true);
    expect(isPaymentDescription('Pago')).toBe(true);
    expect(isPaymentDescription(' pago ')).toBe(true);
    expect(isPaymentDescription('comprobante de pago')).toBe(false);
  });
  it('sanitizes only the local download name', () =>
    expect(safeDownloadName('../../recibo', 'pdf')).toBe('recibo.pdf'));
  it('creates and later revokes an object URL', () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const opened = vi.fn(() => null);
    const name = openAttachment(
      {
        companyId: 'CO',
        salesOrderNumber: 'OV',
        documentId: 'D',
        fileName: 'recibo',
        fileType: 'pdf',
        description: '',
        attachmentType: 'Archivo',
        contentBase64: 'JVBERg==',
      },
      opened,
    );
    expect(name).toBe('recibo.pdf');
    expect(create).toHaveBeenCalled();
    expect(opened).toHaveBeenCalledWith('blob:test');
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:test');
    vi.useRealTimers();
  });
});
