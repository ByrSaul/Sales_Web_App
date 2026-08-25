import type { ApiClient } from '../../core/api/apiClient';
import { mapCompany, mapPermission, mapUser, mapVendor } from '../../core/session/mappers';
import type {
  Company,
  CompanyDto,
  MenuPermission,
  MenuPermissionDto,
  OperationalUser,
  UserDataDto,
  Vendor,
  VendorDto,
} from '../../core/session/types';

/**
 * Servicio de acceso a los datos que conforman la sesión operativa.
 *
 * Endpoints utilizados:
 * - `POST /company/companies`
 * - `POST /company/salesGroupByUser`
 * - `POST /user/data`
 * - `POST /company/accessMenuByUser`
 *
 * @param api Cliente HTTP autenticado.
 * @returns Operaciones para consultar compañías, vendedores, usuario y permisos.
 */
export const sessionService = (api: ApiClient) => ({
  async getCompanies(): Promise<Company[]> {
    return (await api.post<CompanyDto[]>('/company/companies')).map(mapCompany);
  },
  async getVendors(company: string): Promise<Vendor[]> {
    return (await api.post<VendorDto[]>('/company/salesGroupByUser', { company })).map(mapVendor);
  },
  async getUser(): Promise<OperationalUser> {
    const users = await api.post<UserDataDto[]>('/user/data');
    const user = users[0];
    if (!user) throw new Error('No se encontró información del usuario operativo.');
    return mapUser(user);
  },
  async getPermissions(company: string): Promise<MenuPermission[]> {
    return (
      await api.post<MenuPermissionDto[]>('/company/accessMenuByUser', {
        company: company.toUpperCase(),
      })
    ).map(mapPermission);
  },
});
