import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from '../../core/hooks/useDebouncedValue';
import { useProducts, useVariants } from '../../features/catalogs/hooks';
import type { Product } from '../../features/catalogs/types';
import { Badge, Button, Card, EmptyState, Input } from '../ui';
import { ErrorState, LoadingState } from '../ui/PageState';
const ProductsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? 1);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const debounced = useDebouncedValue(search);
  const [selected, setSelected] = useState<Product | null>(null);
  const products = useProducts(debounced, page);
  const variants = useVariants(selected);
  React.useEffect(
    () => setParams({ ...(debounced ? { search: debounced } : {}), page: '1' }),
    [debounced],
  );
  if (products.isPending) return <LoadingState message="Cargando productos..." />;
  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Catálogo de productos</h1>
          <p className="text-xs text-on-surface-variant">
            Productos y variantes de la empresa activa
          </p>
        </div>
        <Input
          icon="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Código o nombre..."
        />
      </div>
      {products.isError ? (
        <ErrorState
          message="No fue posible cargar productos."
          onRetry={() => void products.refetch()}
        />
      ) : !products.data.items.length ? (
        <EmptyState title="No se encontraron productos" />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {products.data.items.map((p) => (
            <Card key={p.itemId} hover className="p-4" onClick={() => setSelected(p)}>
              <div className="flex justify-between">
                <strong>{p.itemId}</strong>
                {p.requiresVariant && <Badge label="REQUIERE VARIANTE" variant="info" />}
              </div>
              <p className="text-sm mt-1">{p.name}</p>
              <p className="text-xs text-on-surface-variant mt-2">
                {p.productType} · {p.dimensionGroup}
              </p>
              {selected?.itemId === p.itemId && p.requiresVariant && (
                <div className="mt-3 border-t pt-3">
                  {variants.isPending
                    ? 'Cargando variantes...'
                    : variants.data?.items.map((v) => (
                        <div key={v.displayProductNumber} className="text-xs py-1">
                          <strong>{v.displayProductNumber}</strong> —{' '}
                          {[v.configId, v.sizeId, v.colorId, v.styleId, v.versionId]
                            .filter(Boolean)
                            .join(' / ')}
                        </div>
                      ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => setParams({ search: debounced, page: String(page - 1) })}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          disabled={page >= (products.data?.pagination.totalPages ?? 0)}
          onClick={() => setParams({ search: debounced, page: String(page + 1) })}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
};
export default ProductsPage;
