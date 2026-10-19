import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ApiClient } from "../../core/api/apiClient";
import type { Product, ProductVariant } from "../catalogs/types";
import { catalogKeys } from "../catalogs/queryKeys";
import { catalogService } from "../catalogs/catalogService";
import type { ExistingOrder } from "./orderTypes";

/** Owns price lookup and the lifetime of a manual override, preserving local edit values. */
export const useExistingOrderLinePrice = (
  api: ApiClient,
  order: ExistingOrder | undefined,
  product: Product | null,
  variant: ProductVariant | null,
  editingPendingId: string | null,
) => {
  const [priceOverride, setPriceOverride] = useState("");
  const price = useQuery({
    queryKey: catalogKeys.price(
      order?.companyId ?? "",
      order?.customerAccount ?? "",
      order?.currencyCode ?? "",
      product?.itemId ?? "",
      variant,
    ),
    queryFn: ({ signal }) =>
      catalogService(api).getPrice({
        company: order!.companyId,
        currency: order!.currencyCode,
        customerAccount: order!.customerAccount,
        itemId: product!.itemId,
        configId: variant?.configId,
        colorId: variant?.colorId,
        sizeId: variant?.sizeId,
        styleId: variant?.styleId,
        versionId: variant?.versionId,
        signal,
      }),
    enabled: Boolean(order && product && (!product.requiresVariant || variant)),
  });
  // A new product/variant/customer/currency invalidates any manual price override and the previous DebugMessage.
  useEffect(() => {
    if (!editingPendingId) setPriceOverride("");
  }, [
    editingPendingId,
    product?.itemId,
    variant?.displayProductNumber,
    order?.customerAccount,
    order?.currencyCode,
  ]);

  const effectivePrice = price.data
    ? {
        ...price.data,
        price:
          priceOverride !== "" ? Number(priceOverride) || 0 : price.data.price,
      }
    : null;

  const displayedPrice = () => {
    if (priceOverride !== "") {
      return priceOverride;
    }
    if (price.data) {
      return String(price.data.price);
    }
    return "";
  };

  return {
    price,
    priceOverride,
    setPriceOverride,
    effectivePrice,
    displayedPrice,
  };
};
