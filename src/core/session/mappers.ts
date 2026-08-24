import type {
  Company,
  CompanyDto,
  MenuPermission,
  MenuPermissionDto,
  OperationalUser,
  UserDataDto,
  Vendor,
  VendorDto,
} from './types';

export const mapCompany = (dto: CompanyDto): Company => {
  if (!dto.legalentityid || !dto.name) throw new Error('Invalid company response');
  const currencies = [dto.currencycode, dto.accountingcurrency, dto.reportingcurrency].filter(
    (value): value is string => Boolean(value),
  );
  return {
    id: dto.legalentityid,
    name: dto.name,
    defaultCurrency: dto.currencycode ?? '',
    availableCurrencies: [...new Set(currencies)],
  };
};
export const mapVendor = (dto: VendorDto): Vendor => {
  if (!dto.company || !dto.groupid || !dto.name) throw new Error('Invalid vendor response');
  return { companyId: dto.company, id: dto.groupid, name: dto.name };
};
export const mapUser = (dto: UserDataDto): OperationalUser => ({
  id: dto.id ?? '',
  name: dto.name ?? '',
  language: dto.language ?? '',
  personnelnumber: dto.personnelnumber ?? '',
});
export const mapPermission = (dto: MenuPermissionDto): MenuPermission => ({
  menu: dto.menu ?? '',
  company: dto.company ?? '',
  permissionLevel: dto.permmisionlevel ?? '',
  children: (dto.children ?? []).map(mapPermission),
});
