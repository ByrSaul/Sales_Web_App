import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../app/providers/SessionProvider';
import { attachmentService } from './attachmentService';
export const attachmentKeys = { order: (companyId: string, salesOrderNumber: string) => ['order-attachments', companyId, salesOrderNumber] as const };
export const useOrderAttachments = (salesOrderNumber: string) => { const { api, context } = useSession(); const companyId = context.company?.id ?? ''; return useQuery({ queryKey: attachmentKeys.order(companyId, salesOrderNumber), queryFn: () => attachmentService(api).list(companyId, salesOrderNumber), enabled: Boolean(companyId && salesOrderNumber), retry: false }); };
export const useAttachmentUploader = (salesOrderNumber: string) => { const { api, context } = useSession(); const client = useQueryClient(); const companyId = context.company?.id ?? ''; return { upload: (file: File, description: string) => attachmentService(api).upload(companyId, salesOrderNumber, file, description), refresh: () => client.invalidateQueries({ queryKey: attachmentKeys.order(companyId, salesOrderNumber) }) }; };
