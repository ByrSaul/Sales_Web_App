/** Compañía devuelta por el backend antes de normalizar sus nombres de campos. */
export type CompanyDto = {
  legalentityid: string;
  name: string;
  currencycode?: string;
  accountingcurrency?: string;
  reportingcurrency?: string;
};

/** Compañía seleccionable dentro del contexto operativo Web. */
export type Company = {
  id: string;
  name: string;
  defaultCurrency: string;
  availableCurrencies: string[];
};

/** Grupo de ventas devuelto por el backend. */
export type VendorDto = { company: string; groupid: string; name: string };
/** Vendedor normalizado y asociado a una compañía. */
export type Vendor = { companyId: string; id: string; name: string };
/** Identidad operativa devuelta por `POST /user/data`. */
export type UserDataDto = {
  id?: string;
  name?: string;
  enable?: number;
  defaultcompany?: string;
  networkalias?: string;
  language?: string;
  personnelnumber?: string;
};
/** Usuario autenticado conservado en el contexto operativo. */
export type OperationalUser = {
  id: string;
  name: string;
  networkAlias: string;
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

/** Estado persistible de usuario, compañía, vendedor y permisos activos. */
export type OperationalContext = {
  accountId: string;
  company: Company | null;
  vendor: Vendor | null;
  user: OperationalUser | null;
  permissions: MenuPermission[];
  warning: string | null;
};
