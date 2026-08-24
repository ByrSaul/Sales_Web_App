export type CompanyDto = {
  legalentityid: string;
  name: string;
  currencycode?: string;
  accountingcurrency?: string;
  reportingcurrency?: string;
};

export type Company = {
  id: string;
  name: string;
  defaultCurrency: string;
  availableCurrencies: string[];
};

export type VendorDto = { company: string; groupid: string; name: string };
export type Vendor = { companyId: string; id: string; name: string };
export type UserDataDto = {
  id?: string;
  name?: string;
  enable?: number;
  defaultcompany?: string;
  networkalias?: string;
  language?: string;
  personnelnumber?: string;
};
export type OperationalUser = {
  id: string;
  name: string;
  language: string;
  personnelnumber: string;
};
export type MenuPermissionDto = {
  menu?: string;
  company?: string;
  permmisionlevel?: string;
  children?: MenuPermissionDto[];
};
export type MenuPermission = {
  menu: string;
  company: string;
  permissionLevel: string;
  children: MenuPermission[];
};

export type OperationalContext = {
  accountId: string;
  company: Company | null;
  vendor: Vendor | null;
  user: OperationalUser | null;
  permissions: MenuPermission[];
  warning: string | null;
};
