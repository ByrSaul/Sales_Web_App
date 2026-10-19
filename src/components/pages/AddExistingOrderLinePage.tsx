import { useExistingOrderLinePrice } from "../../features/orders/useExistingOrderLinePrice";
import { inventoryIdentity } from "../../features/catalogs/inventoryIdentity";
import { OrderProductSearchResults } from "../orders/OrderProductSearchResults";
import { PendingOrderLines } from "../orders/PendingOrderLines";
import {
  usePendingOrderLines,
  type PendingOrderLine as PendingLine,
} from "../../features/orders/usePendingOrderLines";
import { runUiAction } from "../../core/async/uiAction";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useSafeNavigate as useNavigate } from "../../core/hooks/useSafeNavigate";
import { useDebouncedValue } from "../../core/hooks/useDebouncedValue";
import { useSession } from "../../app/providers/SessionProvider";
import {
  useInventory,
  useInfiniteProducts,
  useReferenceCatalogs,
  useVariants,
} from "../../features/catalogs/hooks";
import type {
  InventoryItem,
  Product,
  ProductVariant,
} from "../../features/catalogs/types";
import {
  buildDraftLines,
  removeDraftLine,
} from "../../features/orderDraft/domain";
import { validateLineSelection } from "../../features/orderDraft/selectionValidation";
import type { NewLineSelection } from "../../features/orderDraft/types";
import { newIdempotencyKey } from "../../features/orders/idempotency";
import { useOrderDetail } from "../../features/orders/orderQueries";
import {
  canAddOrderLine,
  canEditPrice,
} from "../../features/orders/orderRules";
import { statusLabel } from "../../features/orders/orderMappers";
import { Button, Card, Input, Select, Toggle } from "../ui";
import { ErrorState, LoadingState } from "../ui/PageState";
import { useOrderAttachments } from "../../features/attachments/attachmentQueries";
import {
  hasValidPaymentAttachment,
  requiresPaymentAttachment,
} from "../../features/attachments/attachmentValidation";

/**
 * Pantalla para agregar o editar líneas de un pedido ya persistido.
 *
 * Flujo:
 * - Consulta el pedido y sus líneas oficiales.
 * - Resuelve producto, variante y ubicación seleccionados.
 * - Aplica las reglas de actualización para líneas persistidas.
 *
 * Dependencias:
 * - React Router.
 * - Queries y mutaciones de pedidos.
 * - Catálogos de inventario.
 */
const AddExistingOrderLinePage = () => {
  const { salesOrderNumber = "" } = useParams();
  const navigate = useNavigate();
  const { api, context } = useSession();
  const data = useOrderDetail(salesOrderNumber);
  const order = data.header.data;
  const paymentRequired = requiresPaymentAttachment(order?.customerAccount);
  const attachments = useOrderAttachments(salesOrderNumber, paymentRequired);
  const hasPayment = hasValidPaymentAttachment(attachments.data ?? []);

  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [variant, setVariant] = useState<ProductVariant | null>(null);
  const [stock, setStock] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [promotionId, setPromotionId] = useState("");
  const [independent, setIndependent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [forceRegisterVariant, setForceRegisterVariant] = useState(false);
  const [editingPendingId, setEditingPendingId] = useState<string | null>(null);
  const deliveryCountryRegionId = order?.deliveryCountryRegionId ?? "";

  const debouncedSearch = useDebouncedValue(search, 1000);
  const products = useInfiniteProducts(debouncedSearch);
  const variants = useVariants(product, {
    forceRegistry: forceRegisterVariant,
    regionId: forceRegisterVariant ? deliveryCountryRegionId : undefined,
  });
  const inventory = useInventory(
    product,
    variant?.displayProductNumber ?? "",
    1,
  );
  const refs = useReferenceCatalogs("", "", {
    delivery: false,
    origins: false,
    agreements: false,
    documents: false,
  });
  const { price, setPriceOverride, effectivePrice, displayedPrice } =
    useExistingOrderLinePrice(api, order, product, variant, editingPendingId);
  useEffect(() => {
    if (!forceRegisterVariant) return;
    setVariant(null);
    setStock(null);
    setPriceOverride("");
  }, [deliveryCountryRegionId, forceRegisterVariant]);
  const pricePermission = canEditPrice(context.permissions);
  const promotion =
    refs.promotions.data?.find((x) => x.groupId === promotionId) ?? null;

  const selection: NewLineSelection | null = useMemo(
    () =>
      product && stock
        ? {
            product,
            variant,
            quantity: Number(quantity),
            siteId: stock.siteId,
            warehouseId: stock.warehouseId,
            availablePhysical: stock.availablePhysical,
            price: independent ? null : effectivePrice,
            independentBonification: independent,
            promotion: independent ? null : promotion,
            matchingAgreementLine: null,
            agreementRemainingQuantity: null,
          }
        : null,
    [product, stock, variant, quantity, independent, effectivePrice, promotion],
  );
  // shellDraft feeds the existing pure Fase 3 line-building/validation logic (buildDraftLines,
  // validateDraftLine); it is never persisted and never goes through OrderDraftProvider.
  const shellDraft = useMemo(
    () =>
      order
        ? {
            id: "",
            accountId: context.accountId,
            dataAreaId: order.companyId,
            vendorId: context.vendor?.id ?? "",
            languageId: context.user?.language ?? "",
            personnelnumber: context.user?.personnelnumber ?? "",
            customer: null,
            currencyCode: order.currencyCode,
            deliveryMode: null,
            deliveryAddress: null,
            requestedShippingDate: "",
            customerReference: "",
            observations: "",
            salesOrigin: null,
            agreement: null,
            taxExemptNumber: null,
            lines: [],
            updatedAt: "",
          }
        : null,
    [order, context.accountId, context.vendor, context.user],
  );
  const {
    pendingLines,
    setPendingLines,
    submitting,
    submitPending,
    verifyPendingLines,
  } = usePendingOrderLines({
    api,
    accountId: context.accountId,
    companyId: order?.companyId ?? "",
    salesOrderNumber,
    draft: shellDraft,
    paymentRequired,
    verifyPayment: async () =>
      hasValidPaymentAttachment((await attachments.refetch()).data ?? []),
    onMessage: setMessage,
    onCompleted: () =>
      navigate(`/pedidos/${encodeURIComponent(salesOrderNumber)}`),
  });
  const generatedLines =
    shellDraft && selection ? buildDraftLines(shellDraft, selection) : [];
  const errors = generatedLines.length
    ? validateLineSelection(generatedLines)
    : [
        {
          key: "selection-required",
          message: "Seleccione producto e inventario.",
        },
      ];

  const reset = () => {
    setProduct(null);
    setVariant(null);
    setStock(null);
    setSearch("");
    setQuantity("1");
    setPromotionId("");
    setIndependent(false);
    setPriceOverride("");
  };

  const addToPending = () => {
    if (!generatedLines.length || errors.length) return;
    const nextLines = generatedLines.map((line) => ({
      ...line,
      submissionStatus: "pending" as const,
      submissionError: null,
      idempotencyKey: newIdempotencyKey(),
    }));
    setPendingLines((current) => [
      ...(editingPendingId
        ? (removeDraftLine(current, editingPendingId) as PendingLine[])
        : current),
      ...nextLines,
    ]);
    setMessage(
      editingPendingId
        ? "Línea pendiente actualizada localmente."
        : "Línea agregada a pendientes. Todavía no se envió al Backend.",
    );
    setEditingPendingId(null);
    reset();
  };

  const beginPendingEdit = (line: PendingLine) => {
    const linkedBonus = line.parentLineId
      ? pendingLines.find(
          (item) =>
            item.parentLineId === line.parentLineId && item.isBonification,
        )
      : undefined;
    setEditingPendingId(line.localId);
    setProduct({
      itemId: line.itemId,
      name: line.itemName,
      productType: line.productType,
      dimensionGroup: "",
      requiresVariant: Boolean(line.presentationCode),
    });
    setVariant(
      line.presentationCode
        ? {
            itemId: line.itemId,
            displayProductNumber: line.presentationCode,
            name: line.presentationName ?? line.itemName,
            dimensionGroup: "",
            configId: line.dimensions.configId,
            colorId: line.dimensions.colorId,
            sizeId: line.dimensions.sizeId,
            styleId: line.dimensions.styleId,
            versionId: line.dimensions.versionId,
          }
        : null,
    );
    setStock({
      companyId: order?.companyId ?? "",
      itemId: line.itemId,
      displayProductNumber: line.presentationCode ?? "",
      productName: line.itemName,
      itemGroupId: "",
      activeIngredientId: "",
      siteId: line.siteId,
      warehouseId: line.warehouseId,
      physical: 0,
      availablePhysical: line.availablePhysical,
      onOrder: 0,
      reservedOrdered: 0,
      ordered: 0,
      availableOrdered: 0,
      totalAvailable: line.availablePhysical,
      ...line.dimensions,
    });
    setSearch(`${line.itemId} · ${line.itemName}`);
    setQuantity(String(line.quantity));
    setPriceOverride(String(line.price));
    setIndependent(line.isBonification && !line.promotion);
    setPromotionId(
      linkedBonus?.promotion?.groupId ?? line.promotion?.groupId ?? "",
    );
  };
  const returnToDetail = () => {
    if (
      pendingLines.length &&
      !window.confirm(
        "Tienes líneas pendientes que todavía no se han enviado. ¿Salir del flujo?",
      )
    )
      return;
    navigate(`/pedidos/${encodeURIComponent(salesOrderNumber)}`);
  };

  if (data.header.isLoading)
    return <LoadingState message="Cargando pedido..." />;
  if (data.header.isError)
    return (
      <ErrorState
        message="No se pudo cargar el encabezado."
        onRetry={() => runUiAction(() => data.header.refetch())}
      />
    );
  if (!order)
    return (
      <Card className="p-4">
        <strong>Pedido no encontrado</strong>
      </Card>
    );
  if (!canAddOrderLine(order))
    return (
      <div className="space-y-4">
        <button
          className="text-sm text-primary"
          onClick={() =>
            navigate(`/pedidos/${encodeURIComponent(salesOrderNumber)}`)
          }
        >
          ← Volver al pedido
        </button>
        <Card className="p-4">
          <strong>No es posible agregar líneas</strong>
          <p className="text-sm mt-1">
            El pedido {salesOrderNumber} está en estado "
            {statusLabel(order.status)}" y no admite nuevas líneas.
          </p>
        </Card>
      </div>
    );
  if (paymentRequired && !hasPayment)
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() =>
            navigate(`/pedidos/${encodeURIComponent(salesOrderNumber)}`)
          }
        >
          Volver al pedido
        </Button>
        <Card className="border-amber-300 bg-amber-50 p-4">
          <strong>Comprobante de pago requerido</strong>
          <p className="mt-1 text-sm">
            Para agregar líneas debe cargar primero una imagen JPG, JPEG o PNG
            con descripción “pago”.
          </p>
          <Button
            className="mt-3"
            onClick={() =>
              navigate(
                `/pedidos/${encodeURIComponent(salesOrderNumber)}/adjuntos`,
              )
            }
          >
            Agregar comprobante
          </Button>
        </Card>
      </div>
    );

  return (
    <div className="space-y-4 pb-12">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">
            Agregar línea · {salesOrderNumber}
          </h1>
          <p className="text-xs">
            {order.customerAccount} · {order.currencyCode}
          </p>
        </div>
        <Button variant="outline" onClick={returnToDetail}>
          Volver al detalle
        </Button>
      </div>
      {message && (
        <output
          aria-live="polite"
          aria-atomic="true"
          className="block p-3 bg-amber-50 border rounded text-sm"
        >
          {message}
        </output>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <h2 className="font-bold">Producto y precio</h2>
          <Input
            label="Buscar producto"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setProduct(null);
              setVariant(null);
              setStock(null);
              setPriceOverride("");
            }}
            icon="search"
          />
          {!product && (
            <OrderProductSearchResults
              products={products}
              search={search}
              debouncedSearch={debouncedSearch}
              onSelect={(selected) => {
                setProduct(selected);
                setVariant(null);
                setStock(null);
                setPriceOverride("");
                setSearch(`${selected.itemId} · ${selected.name}`);
              }}
            />
          )}
          {product?.requiresVariant && (
            <div className="space-y-3">
              <Toggle
                label="Forzar registro"
                checked={forceRegisterVariant}
                disabled={!deliveryCountryRegionId}
                onChange={(value) => {
                  setForceRegisterVariant(value);
                  setVariant(null);
                  setStock(null);
                  setPriceOverride("");
                }}
              />
              {!deliveryCountryRegionId && (
                <p className="text-xs text-amber-700">
                  El encabezado del pedido no contiene el CountryRegionId de la
                  dirección.
                </p>
              )}
              <Select
                label="Variante obligatoria"
                value={variant?.displayProductNumber ?? ""}
                disabled={forceRegisterVariant && !deliveryCountryRegionId}
                onChange={(e) => {
                  setVariant(
                    variants.data?.items.find(
                      (v) => v.displayProductNumber === e.target.value,
                    ) ?? null,
                  );
                  setStock(null);
                  setPriceOverride("");
                }}
                options={[
                  {
                    value: "",
                    label: variants.isLoading ? "Cargando..." : "Seleccione...",
                  },
                  ...(variants.data?.items ?? []).map((v) => ({
                    value: v.displayProductNumber,
                    label: `${v.displayProductNumber} · ${v.name}`,
                  })),
                ]}
              />
              {variants.isFetching && (
                <p className="text-xs text-on-surface-variant">
                  Buscando variantes...
                </p>
              )}
            </div>
          )}
          <Input
            label="Cantidad"
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Toggle
            label="Bonificación independiente"
            checked={independent}
            onChange={(v) => {
              setIndependent(v);
              if (v) setPromotionId("");
            }}
          />
          {!independent && (
            <Select
              label="Promoción vinculada (opcional)"
              value={promotionId}
              onChange={(e) => setPromotionId(e.target.value)}
              options={[
                { value: "", label: "Sin promoción" },
                ...(refs.promotions.data ?? []).map((p) => ({
                  value: p.groupId,
                  label: `${p.groupId} · ${p.name} (${p.forecastDiscount}%)`,
                })),
              ]}
            />
          )}
          {independent ? (
            <div className="p-3 bg-surface-container rounded text-sm">
              Precio: 0 (bonificación independiente)
            </div>
          ) : (
            <div className="space-y-1">
              {price.isLoading && (
                <p className="text-xs">Calculando precio...</p>
              )}
              {price.isError && (
                <p className="text-xs text-error">
                  Error al consultar precio.{" "}
                  <button
                    className="underline"
                    onClick={() => runUiAction(() => price.refetch())}
                  >
                    Reintentar
                  </button>
                </p>
              )}
              {price.data &&
                price.data.price === 0 &&
                price.data.debugMessage.trim() && (
                  <p className="text-xs text-amber-700">
                    {price.data.debugMessage}
                  </p>
                )}
              <Input
                label={`Precio${price.data ? ` (${price.data.currency})` : ""}`}
                type="number"
                step="any"
                value={displayedPrice()}
                disabled={!pricePermission || !price.data}
                onChange={(e) => setPriceOverride(e.target.value)}
              />
              {!pricePermission && (
                <p className="text-xs text-on-surface-variant">
                  Sin permiso Create Sales Orders → Price Sales Line → Editar.
                </p>
              )}
              {price.data && (
                <p className="text-xs text-on-surface-variant">
                  PriceUnit {price.data.priceUnit}
                </p>
              )}
            </div>
          )}
        </Card>
        <Card className="p-4 space-y-3">
          <h2 className="font-bold">Inventario, sitio y almacén</h2>
          {inventory.isLoading && (
            <LoadingState message="Consultando inventario..." />
          )}
          {inventory.isError && (
            <ErrorState
              message="No se pudo consultar inventario."
              onRetry={() => runUiAction(() => inventory.refetch())}
            />
          )}
          {inventory.data && !inventory.data.items.length && (
            <p className="text-sm">Sin inventario para la selección.</p>
          )}
          <div className="max-h-96 w-full max-w-full space-y-2 overflow-x-hidden overflow-y-auto">
            {inventory.data?.items.map((item) => (
              <button
                key={inventoryIdentity(item)}
                onClick={() => setStock(item)}
                className={`w-full min-w-0 max-w-full break-words text-left border rounded-lg p-3 ${stock === item ? "border-primary bg-primary/5" : ""}`}
              >
                <strong>
                  {item.siteId} · {item.warehouseId}
                </strong>
                <p className="text-xs">
                  Físico: {item.physical} · Disponible físico:{" "}
                  {item.availablePhysical} · Total: {item.totalAvailable}
                </p>
              </button>
            ))}
          </div>
          {stock && (
            <p className="text-xs text-amber-700">
              Disponibilidad informativa; Dynamics es la fuente final.
            </p>
          )}
          {errors.length > 0 && (
            <ul role="alert" className="text-sm text-error list-disc pl-5">
              {errors.map((e) => (
                <li key={e.key}>{e.message}</li>
              ))}
            </ul>
          )}
          <Button
            fullWidth
            disabled={
              !generatedLines.length ||
              errors.length > 0 ||
              price.isLoading ||
              submitting
            }
            onClick={addToPending}
          >
            {editingPendingId
              ? "Guardar cambios locales"
              : "Agregar a pendientes"}
          </Button>
        </Card>
      </div>
      <PendingOrderLines
        pendingLines={pendingLines}
        editingPendingId={editingPendingId}
        submitting={submitting}
        submitPending={submitPending}
        verifyPendingLines={verifyPendingLines}
        beginPendingEdit={beginPendingEdit}
        onRemove={(localId) =>
          setPendingLines(
            (current) => removeDraftLine(current, localId) as PendingLine[],
          )
        }
        onCancelEdit={() => {
          setEditingPendingId(null);
          reset();
        }}
      />
    </div>
  );
};
export default AddExistingOrderLinePage;
