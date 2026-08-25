import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useDebouncedValue } from '../../core/hooks/useDebouncedValue';
import { useSession } from '../../app/providers/SessionProvider';
import {
  useInventory,
  useInfiniteProducts,
  useReferenceCatalogs,
  useVariants,
} from '../../features/catalogs/hooks';
import { catalogService } from '../../features/catalogs/catalogService';
import { catalogKeys } from '../../features/catalogs/queryKeys';
import type { InventoryItem, Product, ProductVariant } from '../../features/catalogs/types';
import { buildDraftLines, removeDraftLine } from '../../features/orderDraft/domain';
import { validateDraftLine } from '../../features/orderDraft/validation';
import type { NewLineSelection, OrderDraftLine } from '../../features/orderDraft/types';
import { isAmbiguousError, mutationErrorMessage } from '../../features/orders/mutationOutcome';
import {
  orderKeys,
  useOrderDetail,
} from '../../features/orders/orderQueries';
import { canAddOrderLine, canEditPrice } from '../../features/orders/orderRules';
import { statusLabel } from '../../features/orders/orderMappers';
import {
  mapAgreementLineRequest,
  mapNormalLineRequest,
  sameLine,
} from '../../features/orders/orderSubmissionMapper';
import { orderSubmissionService } from '../../features/orders/orderSubmissionService';
import { Button, Card, Input, Select, Toggle } from '../ui';
import { ErrorState, LoadingState } from '../ui/PageState';
import { useOrderAttachments } from '../../features/attachments/attachmentQueries';
import { hasValidPaymentAttachment, requiresPaymentAttachment } from '../../features/attachments/attachmentValidation';

// This does NOT create another OrderDraft/order header — the order already exists.
// Each POST /d365/sales/line request carries the existing SalesOrderNumber directly.
type PendingLine = OrderDraftLine & {
  submissionStatus: 'pending' | 'submitting' | 'failed' | 'ambiguous';
  submissionError: string | null;
};

const AddExistingOrderLinePage = () => {
  const { salesOrderNumber = '' } = useParams();
  const navigate = useNavigate();
  const { api, context } = useSession();
  const data = useOrderDetail(salesOrderNumber);
  const queryClient = useQueryClient();
  const order = data.header.data;
  const paymentRequired = requiresPaymentAttachment(order?.customerAccount);
  const attachments = useOrderAttachments(salesOrderNumber, paymentRequired);
  const hasPayment = hasValidPaymentAttachment(attachments.data ?? []);

  const [search, setSearch] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [variant, setVariant] = useState<ProductVariant | null>(null);
  const [stock, setStock] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [promotionId, setPromotionId] = useState('');
  const [independent, setIndependent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [priceOverride, setPriceOverride] = useState('');
  const [forceRegisterVariant, setForceRegisterVariant] = useState(false);
  const [pendingLines, setPendingLines] = useState<PendingLine[]>([]);
  const [editingPendingId, setEditingPendingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const deliveryCountryRegionId = order?.deliveryCountryRegionId ?? '';
  const pendingStorageKey = `sales4app.existingOrderPendingLines.v1:${context.accountId}:${order?.companyId ?? ''}:${salesOrderNumber}`;

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(pendingStorageKey);
      setPendingLines(saved ? (JSON.parse(saved) as PendingLine[]) : []);
    } catch {
      setPendingLines([]);
    }
  }, [pendingStorageKey]);
  useEffect(() => {
    sessionStorage.setItem(pendingStorageKey, JSON.stringify(pendingLines));
  }, [pendingLines, pendingStorageKey]);
  useEffect(() => {
    if (!pendingLines.length) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pendingLines.length]);

  const debouncedSearch = useDebouncedValue(search, 1000);
  const products = useInfiniteProducts(debouncedSearch);
  const isProductSearchApplied =
    debouncedSearch.trim().length >= 1 && debouncedSearch.trim() === search.trim();
  const variants = useVariants(product, {
    forceRegistry: forceRegisterVariant,
    regionId: forceRegisterVariant ? deliveryCountryRegionId : undefined,
  });
  const inventory = useInventory(product, variant?.displayProductNumber ?? '', 1);
  const refs = useReferenceCatalogs('', '', {
    delivery: false,
    origins: false,
    agreements: false,
    documents: false,
  });
  const price = useQuery({
    queryKey: catalogKeys.price(
      order?.companyId ?? '',
      order?.customerAccount ?? '',
      order?.currencyCode ?? '',
      product?.itemId ?? '',
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
    if (!editingPendingId) setPriceOverride('');
  }, [
    editingPendingId,
    product?.itemId,
    variant?.displayProductNumber,
    order?.customerAccount,
    order?.currencyCode,
  ]);
  useEffect(() => {
    if (!forceRegisterVariant) return;
    setVariant(null);
    setStock(null);
    setPriceOverride('');
  }, [deliveryCountryRegionId, forceRegisterVariant]);
  const pricePermission = canEditPrice(context.permissions);
  const effectivePrice = price.data
    ? { ...price.data, price: priceOverride !== '' ? Number(priceOverride) || 0 : price.data.price }
    : null;
  const promotion = refs.promotions.data?.find((x) => x.groupId === promotionId) ?? null;

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
            id: '',
            accountId: context.accountId,
            dataAreaId: order.companyId,
            vendorId: context.vendor?.id ?? '',
            languageId: context.user?.language ?? '',
            personnelnumber: context.user?.personnelnumber ?? '',
            customer: null,
            currencyCode: order.currencyCode,
            deliveryMode: null,
            deliveryAddress: null,
            requestedShippingDate: '',
            customerReference: '',
            observations: '',
            salesOrigin: null,
            agreement: null,
            taxExemptNumber: null,
            lines: [],
            updatedAt: '',
          }
        : null,
    [order, context.accountId, context.vendor, context.user],
  );
  const generatedLines = shellDraft && selection ? buildDraftLines(shellDraft, selection) : [];
  const errors = generatedLines.length
    ? generatedLines.flatMap(validateDraftLine)
    : [{ message: 'Seleccione producto e inventario.' }];

  const reset = () => {
    setProduct(null);
    setVariant(null);
    setStock(null);
    setSearch('');
    setQuantity('1');
    setPromotionId('');
    setIndependent(false);
    setPriceOverride('');
  };

  const addToPending = () => {
    if (!generatedLines.length || errors.length) return;
    const nextLines = generatedLines.map((line) => ({
        ...line,
        submissionStatus: 'pending' as const,
        submissionError: null,
      }));
    setPendingLines((current) => [
      ...(editingPendingId
        ? (removeDraftLine(current, editingPendingId) as PendingLine[])
        : current),
      ...nextLines,
    ]);
    setMessage(
      editingPendingId
        ? 'Línea pendiente actualizada localmente.'
        : 'Línea agregada a pendientes. Todavía no se envió al Backend.',
    );
    setEditingPendingId(null);
    reset();
  };

  const submitPending = async () => {
    if (!shellDraft || !order || !pendingLines.length || submitting) return;
    if (paymentRequired) {
      const refreshed = await attachments.refetch();
      if (!hasValidPaymentAttachment(refreshed.data ?? [])) {
        setMessage('Debe adjuntar un comprobante de pago en formato imagen antes de enviar líneas. No se realizó ningún POST de línea.');
        return;
      }
    }
    setSubmitting(true);
    setMessage(null);
    const gateway = orderSubmissionService(api);
    const snapshot = [...pendingLines];
    const created = new Set<string>();
    for (const line of snapshot) {
      let matchingBefore: number | null = null;
      try {
        const existingBefore = await gateway.getExistingLines(order.companyId, salesOrderNumber);
        matchingBefore = existingBefore.filter((existing) => sameLine(line, existing)).length;
      } catch {
        // Creation can continue, but an ambiguous response cannot be recovered without a baseline.
      }
      setPendingLines((current) =>
        current.map((item) =>
          item.localId === line.localId
            ? { ...item, submissionStatus: 'submitting', submissionError: null }
            : item,
        ),
      );
      try {
        if (line.source === 'agreement')
          await gateway.createAgreementLine(
            mapAgreementLineRequest(shellDraft, line, salesOrderNumber),
          );
        else
          await gateway.createNormalLine(mapNormalLineRequest(shellDraft, line, salesOrderNumber));
        created.add(line.localId);
      } catch (error) {
        const ambiguous = isAmbiguousError(error);
        let recovered = false;
        if (ambiguous && matchingBefore !== null) {
          try {
            const existing = await gateway.getExistingLines(order.companyId, salesOrderNumber);
            recovered = existing.filter((item) => sameLine(line, item)).length > matchingBefore;
          } catch {
            // Keep an ambiguous line and never repeat its POST automatically.
          }
        }
        if (recovered) created.add(line.localId);
        else
          setPendingLines((current) =>
            current.map((item) =>
              item.localId === line.localId
                ? {
                    ...item,
                    submissionStatus: ambiguous ? 'ambiguous' : 'failed',
                    submissionError: ambiguous
                      ? `${mutationErrorMessage(error)} No se reenviará automáticamente.`
                      : mutationErrorMessage(error),
                  }
                : item,
            ),
          );
      }
    }
    setPendingLines((current) => current.filter((line) => !created.has(line.localId)));
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(order.companyId, salesOrderNumber) }),
      queryClient.invalidateQueries({ queryKey: orderKeys.lines(order.companyId, salesOrderNumber) }),
      queryClient.invalidateQueries({ queryKey: orderKeys.officialLines(order.companyId, salesOrderNumber) }),
      queryClient.invalidateQueries({ queryKey: orderKeys.all(order.companyId) }),
    ]);
    setSubmitting(false);
    const remaining = snapshot.length - created.size;
    if (!remaining) {
      sessionStorage.removeItem(pendingStorageKey);
      navigate(`/pedidos/${encodeURIComponent(salesOrderNumber)}`);
      return;
    }
    setMessage(`${created.size} creada(s); ${remaining} requieren revisión. Las exitosas no se reenviarán.`);
  };

  const beginPendingEdit = (line: PendingLine) => {
    const linkedBonus = line.parentLineId
      ? pendingLines.find(
          (item) => item.parentLineId === line.parentLineId && item.isBonification,
        )
      : undefined;
    setEditingPendingId(line.localId);
    setProduct({
      itemId: line.itemId,
      name: line.itemName,
      productType: line.productType,
      dimensionGroup: '',
      requiresVariant: Boolean(line.presentationCode),
    });
    setVariant(
      line.presentationCode
        ? {
            itemId: line.itemId,
            displayProductNumber: line.presentationCode,
            name: line.presentationName ?? line.itemName,
            dimensionGroup: '',
            configId: line.dimensions.configId,
            colorId: line.dimensions.colorId,
            sizeId: line.dimensions.sizeId,
            styleId: line.dimensions.styleId,
            versionId: line.dimensions.versionId,
          }
        : null,
    );
    setStock({
      companyId: order?.companyId ?? '', itemId: line.itemId,
      displayProductNumber: line.presentationCode ?? '', productName: line.itemName,
      itemGroupId: '', activeIngredientId: '', siteId: line.siteId,
      warehouseId: line.warehouseId, physical: 0, availablePhysical: line.availablePhysical,
      onOrder: 0, reservedOrdered: 0, ordered: 0, availableOrdered: 0,
      totalAvailable: line.availablePhysical, ...line.dimensions,
    });
    setSearch(`${line.itemId} · ${line.itemName}`);
    setQuantity(String(line.quantity));
    setPriceOverride(String(line.price));
    setIndependent(line.isBonification && !line.promotion);
    setPromotionId(linkedBonus?.promotion?.groupId ?? line.promotion?.groupId ?? '');
  };
  const returnToDetail = () => {
    if (
      pendingLines.length &&
      !window.confirm('Tienes líneas pendientes que todavía no se han enviado. ¿Salir del flujo?')
    )
      return;
    navigate(`/pedidos/${encodeURIComponent(salesOrderNumber)}`);
  };

  if (data.header.isLoading) return <LoadingState message="Cargando pedido..." />;
  if (data.header.isError)
    return (
      <ErrorState
        message="No se pudo cargar el encabezado."
        onRetry={() => data.header.refetch()}
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
          onClick={() => navigate(`/pedidos/${encodeURIComponent(salesOrderNumber)}`)}
        >
          ← Volver al pedido
        </button>
        <Card className="p-4">
          <strong>No es posible agregar líneas</strong>
          <p className="text-sm mt-1">
            El pedido {salesOrderNumber} está en estado "{statusLabel(order.status)}" y no admite
            nuevas líneas.
          </p>
        </Card>
      </div>
    );
  if (paymentRequired && !hasPayment)
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate(`/pedidos/${encodeURIComponent(salesOrderNumber)}`)}>Volver al pedido</Button>
        <Card className="border-amber-300 bg-amber-50 p-4">
          <strong>Comprobante de pago requerido</strong>
          <p className="mt-1 text-sm">Para agregar líneas debe cargar primero una imagen JPG, JPEG o PNG con descripción “pago”.</p>
          <Button className="mt-3" onClick={() => navigate(`/pedidos/${encodeURIComponent(salesOrderNumber)}/adjuntos`)}>Agregar comprobante</Button>
        </Card>
      </div>
    );

  return (
    <div className="space-y-4 pb-12">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Agregar línea · {salesOrderNumber}</h1>
          <p className="text-xs">
            {order.customerAccount} · {order.currencyCode}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={returnToDetail}
        >
          Volver al detalle
        </Button>
      </div>
      {message && (
        <div role="status" className="p-3 bg-amber-50 border rounded text-sm">
          {message}
        </div>
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
              setPriceOverride('');
            }}
            icon="search"
          />
          {!product && isProductSearchApplied && products.isFetching && !products.isFetchingNextPage && (
            <p className="text-xs text-on-surface-variant">Buscando productos...</p>
          )}
          {!product && isProductSearchApplied && products.isError && (
            <p className="text-xs text-error">
              No fue posible consultar productos.{' '}
              <button className="underline" onClick={() => void products.refetch()}>Reintentar</button>
            </p>
          )}
          {!product && isProductSearchApplied && !products.isError && products.items.length > 0 && (
            <div className="max-h-40 w-full max-w-full overflow-x-hidden overflow-y-auto rounded border">
              {products.items.map((p) => (
                <button
                  key={p.itemId}
                  className="block w-full min-w-0 max-w-full break-words border-b p-2 text-left text-sm hover:bg-surface-container"
                  onClick={() => {
                    setProduct(p);
                    setVariant(null);
                    setStock(null);
                    setPriceOverride('');
                    setSearch(`${p.itemId} · ${p.name}`);
                  }}
                >
                  {p.itemId} · {p.name} <small>{p.productType}</small>
                </button>
              ))}
              {products.hasNextPage && (
                <Button
                  fullWidth
                  variant="outline"
                  loading={products.isFetchingNextPage}
                  onClick={() => void products.fetchNextPage()}
                >
                  Cargar más productos
                </Button>
              )}
            </div>
          )}
          {!product && isProductSearchApplied && !products.isFetching && !products.isError && products.items.length === 0 && (
            <p className="text-xs text-on-surface-variant">No se encontraron productos.</p>
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
                    setPriceOverride('');
                  }}
              />
              {!deliveryCountryRegionId && (
                <p className="text-xs text-amber-700">
                  El encabezado del pedido no contiene el CountryRegionId de la dirección.
                </p>
              )}
              <Select
                label="Variante obligatoria"
                value={variant?.displayProductNumber ?? ''}
                disabled={forceRegisterVariant && !deliveryCountryRegionId}
                onChange={(e) => {
                  setVariant(
                    variants.data?.items.find((v) => v.displayProductNumber === e.target.value) ??
                      null,
                  );
                  setStock(null);
                  setPriceOverride('');
                }}
                options={[
                  { value: '', label: variants.isLoading ? 'Cargando...' : 'Seleccione...' },
                  ...(variants.data?.items ?? []).map((v) => ({
                    value: v.displayProductNumber,
                    label: `${v.displayProductNumber} · ${v.name}`,
                  })),
                ]}
              />
              {variants.isFetching && (
                <p className="text-xs text-on-surface-variant">Buscando variantes...</p>
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
                if (v) setPromotionId('');
              }}
          />
          {!independent && (
            <Select
              label="Promoción vinculada (opcional)"
              value={promotionId}
              onChange={(e) => setPromotionId(e.target.value)}
              options={[
                { value: '', label: 'Sin promoción' },
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
              {price.isLoading && <p className="text-xs">Calculando precio...</p>}
              {price.isError && (
                <p className="text-xs text-error">
                  Error al consultar precio.{' '}
                  <button className="underline" onClick={() => price.refetch()}>
                    Reintentar
                  </button>
                </p>
              )}
              {price.data && price.data.price === 0 && price.data.debugMessage.trim() && (
                <p className="text-xs text-amber-700">{price.data.debugMessage}</p>
              )}
              <Input
                label={`Precio${price.data ? ` (${price.data.currency})` : ''}`}
                type="number"
                step="any"
                value={
                  priceOverride !== '' ? priceOverride : price.data ? String(price.data.price) : ''
                }
                disabled={!pricePermission || !price.data}
                onChange={(e) => setPriceOverride(e.target.value)}
              />
              {!pricePermission && (
                <p className="text-xs text-on-surface-variant">
                  Sin permiso Create Sales Orders → Price Sales Line → Editar.
                </p>
              )}
              {price.data && (
                <p className="text-xs text-on-surface-variant">PriceUnit {price.data.priceUnit}</p>
              )}
            </div>
          )}
        </Card>
        <Card className="p-4 space-y-3">
          <h2 className="font-bold">Inventario, sitio y almacén</h2>
          {inventory.isLoading && <LoadingState message="Consultando inventario..." />}
          {inventory.isError && (
            <ErrorState
              message="No se pudo consultar inventario."
              onRetry={() => inventory.refetch()}
            />
          )}
          {inventory.data && !inventory.data.items.length && (
            <p className="text-sm">Sin inventario para la selección.</p>
          )}
          <div className="max-h-96 w-full max-w-full space-y-2 overflow-x-hidden overflow-y-auto">
            {inventory.data?.items.map((item, i) => (
              <button
                key={`${item.siteId}-${item.warehouseId}-${i}`}
                onClick={() => setStock(item)}
                className={`w-full min-w-0 max-w-full break-words text-left border rounded-lg p-3 ${stock === item ? 'border-primary bg-primary/5' : ''}`}
              >
                <strong>
                  {item.siteId} · {item.warehouseId}
                </strong>
                <p className="text-xs">
                  Físico: {item.physical} · Disponible físico: {item.availablePhysical} · Total:{' '}
                  {item.totalAvailable}
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
              {errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          )}
          <Button
            fullWidth
            disabled={!generatedLines.length || errors.length > 0 || price.isLoading || submitting}
            onClick={addToPending}
          >
            {editingPendingId ? 'Guardar cambios locales' : 'Agregar a pendientes'}
          </Button>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div>
            <h2 className="font-bold">Líneas pendientes ({pendingLines.length})</h2>
            <p className="text-xs text-on-surface-variant">Temporales hasta su envío explícito.</p>
          </div>
          <Button
            loading={submitting}
            disabled={!pendingLines.length || pendingLines.some((line) => line.submissionStatus === 'ambiguous')}
            onClick={() => void submitPending()}
          >
            Enviar {pendingLines.length} línea{pendingLines.length === 1 ? '' : 's'}
          </Button>
        </div>
        {!pendingLines.length && <p className="border-t p-3 text-sm">No hay líneas pendientes.</p>}
        {pendingLines.length > 0 && (
          <div className="max-h-72 overflow-auto border-t">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="sticky top-0 z-10 bg-surface-container">
                <tr><th className="p-2 text-left">Producto</th><th>Cantidad</th><th>Precio</th><th>Total</th><th>Estado / acciones</th></tr>
              </thead>
              <tbody>
                {(editingPendingId ? pendingLines.filter((line) => line.localId === editingPendingId) : pendingLines).map((line) => (
                  <tr key={line.localId} className="border-t">
                    <td className="p-2"><strong>{line.itemId}</strong><small className="block">{line.itemName}</small></td>
                    <td className="text-center">{line.quantity}</td>
                    <td className="text-center">{line.currency} {line.price.toFixed(2)}</td>
                    <td className="text-center">{line.currency} {(line.quantity * line.price).toFixed(2)}</td>
                    <td className="p-2">
                      {line.submissionError && <p className="mb-1 text-xs text-error">{line.submissionError}</p>}
                      {line.submissionStatus === 'submitting' ? <span className="text-xs font-semibold text-primary">Enviando...</span> : line.submissionStatus === 'ambiguous' ? <span className="text-xs font-semibold text-amber-700">Revisión manual requerida</span> : editingPendingId ? <span className="text-xs font-semibold text-primary">Editando localmente</span> : (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => beginPendingEdit(line)}>Editar</Button>
                          <Button size="sm" variant="danger" onClick={() => setPendingLines((current) => removeDraftLine(current, line.localId) as PendingLine[])}>Eliminar</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {editingPendingId && (
          <div className="flex items-center justify-between gap-2 border-t p-3 text-sm">
            <span>Modifique la selección en el formulario y guarde los cambios locales.</span>
            <Button variant="outline" onClick={() => { setEditingPendingId(null); reset(); }}>
              Cancelar edición
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
export default AddExistingOrderLinePage;
