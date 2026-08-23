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

export const sessionService = (api: ApiClient) => ({
  async getCompanies(): Promise<Company[]> {
    return (await api.post<CompanyDto[]>('/company/companies')).map(mapCompany);
  },
  async getVendors(company: string): Promise<Vendor[]> {
    return (await api.post<VendorDto[]>('/company/salesGroupByUser', { company })).map(mapVendor);
  },
  async getUser(): Promise<OperationalUser> {
    return mapUser(await api.post<UserDataDto>('/user/data'));
  },
  async getPermissions(company: string): Promise<MenuPermission[]> {
    return (
      await api.post<MenuPermissionDto[]>('/company/accessMenuByUser', {
        company: company.toUpperCase(),
      })
    ).map(mapPermission);
  },
});
