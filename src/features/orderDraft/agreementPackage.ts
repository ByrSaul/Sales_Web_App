import type { AgreementLine } from "../catalogs/types";
import type { NewLineSelection, OrderDraft, OrderDraftLine } from "./types";
import { validateDraftLine } from "./validation";

/** Only fields actually returned by parcial_lines define the commercial selection. */
const packageLine = (line: AgreementLine, localId: string): OrderDraftLine => ({
  localId,
  parentLineId: null,
  source: "agreement",
  itemId: line.itemId,
  itemName: line.name,
  productType: "Item",
  presentationCode: line.displayProductNumber || null,
  presentationName: line.name,
  dimensions: {
    configId: line.configId,
    colorId: line.colorId,
    sizeId: line.sizeId,
    styleId: line.styleId,
    versionId: line.versionId,
  },
  quantity: line.lineQuantity,
  currency: line.currency,
  price: line.price,
  priceUnit: 0,
  lineDiscount: 0,
  linePercent: 0,
  markup: 0,
  discountPct1: 0,
  discountPct2: 0,
  siteId: line.siteId,
  warehouseId: line.warehouseId,
  availablePhysical: 0,
  isBonification: false,
  promotion: null,
  matchingAgreementLine: line.matchingLine,
  agreementRemainingQuantity: line.lineQuantity,
});

const contextError = (
  draft: OrderDraft,
  line: AgreementLine,
): string | null => {
  if (
    line.companyId?.toLowerCase() &&
    line.companyId.toLocaleLowerCase() !== draft.dataAreaId.toLowerCase()
  )
    return "La línea del paquete pertenece a otra empresa.";
  if (
    line.customerAccount?.toLowerCase() &&
    line.customerAccount.toLowerCase() !== draft.customer?.account.toLowerCase()
  )
    return "La línea del paquete pertenece a otro cliente.";
  if (
    line.agreementNumber?.toLowerCase &&
    line.agreementNumber.toLowerCase() !== draft.agreement?.number.toLowerCase()
  )
    return "La línea pertenece a otro paquete.";
  if (line.currency !== draft.currencyCode)
    return "La moneda del paquete no coincide con la del pedido.";
  return null;
};

export const agreementPackageError = (
  draft: OrderDraft,
  lines: AgreementLine[],
): string | null => {
  if (!draft.customer || !draft.agreement)
    return "Seleccione cliente y paquete.";
  if (
    draft.agreement.currency &&
    draft.agreement.currency !== draft.currencyCode
  )
    return "Seleccione la moneda del paquete para continuar.";
  if (!lines.length) return "El paquete no tiene líneas disponibles.";
  const seen = new Set<number>();
  for (const line of lines) {
    const mismatch = contextError(draft, line);
    if (mismatch) return mismatch;
    if (
      !line.itemId ||
      !Number.isSafeInteger(line.matchingLine) ||
      line.matchingLine <= 0
    )
      return "El paquete contiene una línea sin referencia válida.";
    if (seen.has(line.matchingLine))
      return "El paquete devuelve referencias de línea duplicadas.";
    seen.add(line.matchingLine);
    const invalid = validateDraftLine(packageLine(line, ""))[0];
    if (invalid)
      return `${line.itemId}: ${invalid.message} ${line.debugMessage ?? ""}`.trim();
  }
  return null;
};

/** Creates local identities only when the user accepts the complete package, never during render. */
export const buildAgreementPackageLines = (
  draft: OrderDraft,
  lines: AgreementLine[],
): OrderDraftLine[] => {
  const error = agreementPackageError(draft, lines);
  if (error) throw new Error(error);
  return lines.map((line) => packageLine(line, crypto.randomUUID()));
};

/** Manual agreement selection uses the same authoritative fields as a full package. */
export const agreementLineSelection = (
  line: AgreementLine,
  quantity: number,
): NewLineSelection => ({
  product: {
    itemId: line.itemId,
    name: line.name,
    productType: "Item",
    dimensionGroup: "",
    requiresVariant: false,
  },
  variant: {
    itemId: line.itemId,
    displayProductNumber: line.displayProductNumber,
    name: line.name,
    dimensionGroup: "",
    configId: line.configId,
    colorId: line.colorId,
    sizeId: line.sizeId,
    styleId: line.styleId,
    versionId: line.versionId,
  },
  quantity,
  siteId: line.siteId,
  warehouseId: line.warehouseId,
  availablePhysical: 0,
  price: {
    success: true,
    errorMessage: "",
    debugMessage: line.debugMessage ?? "",
    currency: line.currency,
    exchangeRate: 0,
    price: line.price,
    priceUnit: 0,
    lineDiscount: 0,
    linePercent: 0,
    markup: 0,
    discountPct1: 0,
    discountPct2: 0,
  },
  independentBonification: false,
  promotion: null,
  matchingAgreementLine: line.matchingLine,
  agreementRemainingQuantity: line.lineQuantity,
});

export const validateAgreementSelection = (
  draft: OrderDraft,
  line?: AgreementLine,
): { key: string; message: string }[] => {
  if (!line) return [];
  const invalid = agreementPackageError(draft, [line]);
  if (invalid) return [{ key: "agreement-invalid", message: invalid }];
  if (
    draft.lines.some(
      (existing) => existing.matchingAgreementLine === line.matchingLine,
    )
  )
    return [
      {
        key: "agreement-duplicate",
        message: "La línea del paquete ya está en el borrador.",
      },
    ];
  return [];
};
