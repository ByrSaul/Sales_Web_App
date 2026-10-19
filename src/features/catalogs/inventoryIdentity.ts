import type { InventoryItem } from './types';

/** Identity of the backend's inventory aggregate, independent of quantities and list order. */
export const inventoryIdentity = (item: InventoryItem): string =>
  JSON.stringify([
    item.companyId,
    item.itemId,
    item.displayProductNumber,
    item.siteId,
    item.warehouseId,
    item.configId,
    item.colorId,
    item.sizeId,
    item.styleId,
    item.versionId,
  ]);
