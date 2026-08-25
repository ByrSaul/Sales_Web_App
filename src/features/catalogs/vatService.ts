import type { ApiClient } from '../../core/api/apiClient';
import type { DocumentTypes, PageResult, VatNumber } from './types';

type Json = Record<string, unknown>;
const text = (value: unknown) => String(value ?? '');
const pagination = (value: unknown, count: number) => {
  const p = (value ?? {}) as Json;
  return { currentPage: Number(p.CurrentPage ?? 1), perPage: Number(p.PerPage ?? 25), fromRecord: Number(p.FromRecord ?? 0), toRecord: Number(p.ToRecord ?? count), totalRecords: Number(p.TotalRecords ?? count), totalPages: Number(p.TotalPages ?? 1) };
};
/** Datos requeridos para registrar un identificador fiscal en D365. */
export type CreateVatInput = {
  company: string; countryId: string; vatNumber: string; name: string; documentType: string;
  taxpayerType: string; personType: string;
};
/**
 * Servicio de consulta y creación de identificadores NIF/VAT.
 *
 * Endpoints utilizados:
 * - `POST /d365/vat_num/query`
 * - `POST /d365/vat_num/document_type/query`
 * - `POST /d365/vat_num`
 *
 * @param api Cliente HTTP autenticado.
 * @returns Operaciones de búsqueda, catálogos documentales y creación de NIF/VAT.
 */
export const vatService = (api: ApiClient) => ({
  async query(company: string, countryId: string, search: string, page: number, signal?: AbortSignal): Promise<PageResult<VatNumber>> {
    const response = await api.post<Json>('/d365/vat_num/query', { filters: { Name: search, dataAreaId: company, CountryRegionId: countryId }, sort: { fields: [{ name: 'VATNum', order: 'desc' }] }, page, perpage: 25 }, { signal });
    const raw = Array.isArray(response['@odata']) ? response['@odata'] as Json[] : [];
    return { items: raw.map((j) => ({ companyId: text(j.dataAreaId), vatNumber: text(j.VATNum), countryId: text(j.CountryRegionId), name: text(j.Name), documentType: text(j.DocumentTypeIdentificationId), taxVatAddress: text(j.CSFATaxVatAddress), taxpayerTypePanama: text(j.CS_FEL_TaxpayerType_PA), rucCheckerPanama: text(j.CS_FEL_RUCChecker_PA), personTypeElSalvador: text(j.CS_FEL_PersonType_SV) })), pagination: pagination(response.pagination, raw.length) };
  },
  async documentTypes(company: string, countryId: string, signal?: AbortSignal): Promise<DocumentTypes> {
    const response = await api.post<Json>('/d365/vat_num/document_type/query', { filters: { dataAreaId: company, CountryRegionId: countryId } }, { signal });
    const odata = (response['@odata'] ?? {}) as Json;
    const values = (key: string, field: string) => (Array.isArray(odata[key]) ? odata[key] as Json[] : []).map((j) => text(j[field])).filter(Boolean);
    return { documentTypes: values('DocType', 'DocumentTypeIdentificationId'), felPanama: values('FelPA', 'CS_FEL_RUCChecker_PA'), felElSalvador: values('FelSV', 'CS_FEL_PersonType_SV') };
  },
  async create(input: CreateVatInput): Promise<VatNumber> {
    const response = await api.post<unknown>('/d365/vat_num', { dataAreaId: input.company, CountryRegionId: input.countryId, VATNum: input.vatNumber, Name: input.name, DocumentTypeIdentificationId: input.documentType, CS_FEL_TaxpayerType_PA: input.taxpayerType, CS_FEL_PersonType_SV: input.personType });
    const envelope = response as Json;
    const raw = (Array.isArray(response) ? response[0] : Array.isArray(envelope['@odata']) ? envelope['@odata'][0] : response) as Json | undefined;
    return { companyId: text(raw?.dataAreaId ?? input.company), vatNumber: text(raw?.VATNum ?? input.vatNumber), countryId: text(raw?.CountryRegionId ?? input.countryId), name: text(raw?.Name ?? input.name), documentType: text(raw?.DocumentTypeIdentificationId ?? input.documentType), taxVatAddress: text(raw?.CSFATaxVatAddress), taxpayerTypePanama: text(raw?.CS_FEL_TaxpayerType_PA ?? input.taxpayerType), rucCheckerPanama: text(raw?.CS_FEL_RUCChecker_PA), personTypeElSalvador: text(raw?.CS_FEL_PersonType_SV ?? input.personType) };
  },
});
