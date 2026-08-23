import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../app/providers/SessionProvider';
import { useInventory, useProducts, useReferenceCatalogs, useVariants } from '../../features/catalogs/hooks';
import { catalogService } from '../../features/catalogs/catalogService';
import { catalogKeys } from '../../features/catalogs/queryKeys';
import type { InventoryItem, Product, ProductVariant } from '../../features/catalogs/types';
import { buildDraftLines } from '../../features/orderDraft/domain';
import { validateDraftLine } from '../../features/orderDraft/validation';
import type { NewLineSelection } from '../../features/orderDraft/types';
import { isAmbiguousError, mutationErrorMessage } from '../../features/orders/mutationOutcome';
import { useOrderDetail, useOrderMutations, BonusLineFailure } from '../../features/orders/orderQueries';
import { canAddOrderLine, canEditPrice } from '../../features/orders/orderRules';
import { statusLabel } from '../../features/orders/orderMappers';
import { mapNormalLineRequest } from '../../features/orders/orderSubmissionMapper';
import { Button, Card, Input, Select, Toggle } from '../ui';
import { ErrorState, LoadingState } from '../ui/PageState';

// This does NOT create another OrderDraft/order header — the order already exists.
// Each POST /d365/sales/line request carries the existing SalesOrderNumber directly.
const AddExistingOrderLinePage = () => {
  const { salesOrderNumber = '' } = useParams();
  const navigate = useNavigate();
  const { api, context } = useSession();
  const data = useOrderDetail(salesOrderNumber);
  const mutations = useOrderMutations(salesOrderNumber);
  const order = data.header.data;

  const [search, setSearch] = useState(''); const [product, setProduct] = useState<Product | null>(null); const [variant, setVariant] = useState<ProductVariant | null>(null); const [stock, setStock] = useState<InventoryItem | null>(null); const [quantity, setQuantity] = useState('1'); const [promotionId, setPromotionId] = useState(''); const [independent, setIndependent] = useState(false); const [message, setMessage] = useState<string | null>(null); const [priceOverride, setPriceOverride] = useState('');

  const products = useProducts(search, 1); const variants = useVariants(product); const inventory = useInventory(product, variant?.displayProductNumber ?? '', 1); const refs = useReferenceCatalogs();
  const price = useQuery({ queryKey: catalogKeys.price(order?.companyId ?? '', order?.customerAccount ?? '', order?.currencyCode ?? '', product?.itemId ?? '', variant), queryFn: ({ signal }) => catalogService(api).getPrice({ company: order!.companyId, currency: order!.currencyCode, customerAccount: order!.customerAccount, itemId: product!.itemId, configId: variant?.configId, colorId: variant?.colorId, sizeId: variant?.sizeId, styleId: variant?.styleId, versionId: variant?.versionId, signal }), enabled: Boolean(order && product && (!product.requiresVariant || variant)) });
  // A new product/variant/customer/currency invalidates any manual price override and the previous DebugMessage.
  useEffect(() => { setPriceOverride(''); }, [product?.itemId, variant?.displayProductNumber, order?.customerAccount, order?.currencyCode]);
  const pricePermission = canEditPrice(context.permissions);
  const effectivePrice = price.data ? { ...price.data, price: priceOverride !== '' ? Number(priceOverride) || 0 : price.data.price } : null;
  const promotion = refs.promotions.data?.find(x => x.groupId === promotionId) ?? null;

  const selection: NewLineSelection | null = useMemo(() => product && stock ? { product, variant, quantity: Number(quantity), siteId: stock.siteId, warehouseId: stock.warehouseId, availablePhysical: stock.availablePhysical, price: independent ? null : effectivePrice, independentBonification: independent, promotion: independent ? null : promotion, matchingAgreementLine: null, agreementRemainingQuantity: null } : null, [product, stock, variant, quantity, independent, effectivePrice, promotion]);
  // shellDraft feeds the existing pure Fase 3 line-building/validation logic (buildDraftLines,
  // validateDraftLine); it is never persisted and never goes through OrderDraftProvider.
  const shellDraft = useMemo(() => order ? { id: '', accountId: context.accountId, dataAreaId: order.companyId, vendorId: context.vendor?.id ?? '', languageId: context.user?.language ?? '', orderResponsiblePersonnelNumber: context.user?.personnelNumber ?? '', customer: null, currencyCode: order.currencyCode, deliveryMode: null, deliveryAddress: null, requestedShippingDate: '', customerReference: '', observations: '', salesOrigin: null, agreement: null, taxExemptNumber: null, lines: [], updatedAt: '' } : null, [order, context.accountId, context.vendor, context.user]);
  const generatedLines = shellDraft && selection ? buildDraftLines(shellDraft, selection) : [];
  const errors = generatedLines.length ? generatedLines.flatMap(validateDraftLine) : [{ message: 'Seleccione producto e inventario.' }];

  const reset = () => { setProduct(null); setVariant(null); setStock(null); setSearch(''); setQuantity('1'); setPromotionId(''); setIndependent(false); setPriceOverride(''); };

  const submit = async () => {
    if (!shellDraft || !generatedLines.length || errors.length || mutations.addLine.isPending) return;
    setMessage(null);
    const [mainLine, bonusLine] = generatedLines;
    const main = mapNormalLineRequest(shellDraft, mainLine, salesOrderNumber);
    const bonus = bonusLine ? mapNormalLineRequest(shellDraft, bonusLine, salesOrderNumber) : undefined;
    try {
      await mutations.addLine.mutateAsync({ main, bonus });
      setMessage('Línea agregada; se consultó nuevamente el detalle.');
      reset();
    } catch (error) {
      if (error instanceof BonusLineFailure) {
        setMessage(`La línea principal se creó. La bonificación ${isAmbiguousError(error.cause) ? 'no pudo verificarse: el resultado es ambiguo.' : `fue rechazada: ${mutationErrorMessage(error.cause)}`} Revise el detalle antes de reintentar.`);
      } else {
        setMessage(isAmbiguousError(error) ? 'No fue posible determinar si Dynamics creó la línea.' : `Dynamics rechazó la línea: ${mutationErrorMessage(error)}`);
      }
    }
  };

  if (data.header.isLoading) return <LoadingState message="Cargando pedido..." />;
  if (data.header.isError) return <ErrorState message="No se pudo cargar el encabezado." onRetry={() => data.header.refetch()} />;
  if (!order) return <Card className="p-4"><strong>Pedido no encontrado</strong></Card>;
  if (!canAddOrderLine(order)) return <div className="space-y-4"><button className="text-sm text-primary" onClick={() => navigate(`/pedidos/${encodeURIComponent(salesOrderNumber)}`)}>← Volver al pedido</button><Card className="p-4"><strong>No es posible agregar líneas</strong><p className="text-sm mt-1">El pedido {salesOrderNumber} está en estado "{statusLabel(order.status)}" y no admite nuevas líneas.</p></Card></div>;

  return <div className="space-y-4 pb-12">
    <div className="flex flex-wrap justify-between gap-2"><div><h1 className="text-xl font-bold">Agregar línea · {salesOrderNumber}</h1><p className="text-xs">{order.customerAccount} · {order.currencyCode}</p></div><Button variant="outline" onClick={() => navigate(`/pedidos/${encodeURIComponent(salesOrderNumber)}`)}>Volver al detalle</Button></div>
    {message && <div role="status" className="p-3 bg-amber-50 border rounded text-sm">{message}</div>}
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="p-4 space-y-3"><h2 className="font-bold">Producto y precio</h2><Input label="Buscar producto" value={search} onChange={e => { setSearch(e.target.value); setProduct(null); setStock(null); }} icon="search" />
        {products.isLoading && <LoadingState message="Cargando productos..." />}{products.isError && <ErrorState message="No se pudieron cargar los productos." onRetry={() => products.refetch()} />}
        {!product && search && <div className="max-h-40 overflow-auto border rounded">{products.data?.items.map(p => <button key={p.itemId} className="block w-full text-left p-2 border-b text-sm hover:bg-surface-container" onClick={() => { setProduct(p); setSearch(`${p.itemId} · ${p.name}`); }}>{p.itemId} · {p.name} <small>{p.productType}</small></button>)}</div>}
        {product?.requiresVariant && <Select label="Variante obligatoria" value={variant?.displayProductNumber ?? ''} onChange={e => { setVariant(variants.data?.items.find(v => v.displayProductNumber === e.target.value) ?? null); setStock(null); }} options={[{ value: '', label: variants.isLoading ? 'Cargando...' : 'Seleccione...' }, ...(variants.data?.items ?? []).map(v => ({ value: v.displayProductNumber, label: `${v.displayProductNumber} · ${v.name}` }))]} />}
        <Input label="Cantidad" type="number" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} /><div className="flex justify-between border p-3 rounded"><span className="text-sm">Bonificación independiente</span><Toggle checked={independent} onChange={v => { setIndependent(v); if (v) setPromotionId(''); }} /></div>
        {!independent && <Select label="Promoción vinculada (opcional)" value={promotionId} onChange={e => setPromotionId(e.target.value)} options={[{ value: '', label: 'Sin promoción' }, ...(refs.promotions.data ?? []).map(p => ({ value: p.groupId, label: `${p.groupId} · ${p.name} (${p.forecastDiscount}%)` }))]} />}
        {independent ? <div className="p-3 bg-surface-container rounded text-sm">Precio: 0 (bonificación independiente)</div> : <div className="space-y-1">
          {price.isLoading && <p className="text-xs">Calculando precio...</p>}
          {price.isError && <p className="text-xs text-error">Error al consultar precio. <button className="underline" onClick={() => price.refetch()}>Reintentar</button></p>}
          {price.data && price.data.price === 0 && price.data.debugMessage.trim() && <p className="text-xs text-amber-700">{price.data.debugMessage}</p>}
          <Input label={`Precio${price.data ? ` (${price.data.currency})` : ''}`} type="number" step="any" value={priceOverride !== '' ? priceOverride : price.data ? String(price.data.price) : ''} disabled={!pricePermission || !price.data} onChange={e => setPriceOverride(e.target.value)} />
          {!pricePermission && <p className="text-xs text-on-surface-variant">Sin permiso Create Sales Orders → Price Sales Line → Editar.</p>}
          {price.data && <p className="text-xs text-on-surface-variant">PriceUnit {price.data.priceUnit}</p>}
        </div>}
      </Card>
      <Card className="p-4 space-y-3"><h2 className="font-bold">Inventario, sitio y almacén</h2>{inventory.isLoading && <LoadingState message="Consultando inventario..." />}{inventory.isError && <ErrorState message="No se pudo consultar inventario." onRetry={() => inventory.refetch()} />}{inventory.data && !inventory.data.items.length && <p className="text-sm">Sin inventario para la selección.</p>}
        <div className="space-y-2 max-h-96 overflow-auto">{inventory.data?.items.map((item, i) => <button key={`${item.siteId}-${item.warehouseId}-${i}`} onClick={() => setStock(item)} className={`w-full text-left border rounded-lg p-3 ${stock === item ? 'border-primary bg-primary/5' : ''}`}><strong>{item.siteId} · {item.warehouseId}</strong><p className="text-xs">Físico: {item.physical} · Disponible físico: {item.availablePhysical} · Total: {item.totalAvailable}</p></button>)}</div>{stock && <p className="text-xs text-amber-700">Disponibilidad informativa; Dynamics es la fuente final.</p>}
        {errors.length > 0 && <ul role="alert" className="text-sm text-error list-disc pl-5">{errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>}
        <Button fullWidth loading={mutations.addLine.isPending} disabled={!generatedLines.length || errors.length > 0 || price.isLoading} onClick={submit}>Agregar línea</Button>
      </Card>
    </div>
  </div>;
};
export default AddExistingOrderLinePage;
