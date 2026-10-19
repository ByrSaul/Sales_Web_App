import { runUiAction } from "../../core/async/uiAction";
import type { useInfiniteProducts } from "../../features/catalogs/hooks";
import type { Product } from "../../features/catalogs/types";
import { Button } from "../ui";
type Props = {
  products: ReturnType<typeof useInfiniteProducts>;
  search: string;
  debouncedSearch: string;
  onSelect: (product: Product) => void;
};
/** Search feedback and pagination share the same debounced query state. */
export const OrderProductSearchResults = ({
  products,
  search,
  debouncedSearch,
  onSelect,
}: Props) => {
  const isProductSearchApplied =
    debouncedSearch.trim().length >= 1 &&
    debouncedSearch.trim() === search.trim();
  return (
    <>
      {isProductSearchApplied &&
        products.isFetching &&
        !products.isFetchingNextPage && (
          <p className="text-xs text-on-surface-variant">
            Buscando productos...
          </p>
        )}
      {isProductSearchApplied && products.isError && (
        <p className="text-xs text-error">
          No fue posible consultar productos.{" "}
          <button
            className="underline"
            onClick={() => runUiAction(() => products.refetch())}
          >
            Reintentar
          </button>
        </p>
      )}
      {isProductSearchApplied &&
        !products.isError &&
        products.items.length > 0 && (
          <div className="max-h-40 w-full max-w-full overflow-x-hidden overflow-y-auto rounded border">
            {products.items.map((p) => (
              <button
                key={p.itemId}
                className="block w-full min-w-0 max-w-full break-words border-b p-2 text-left text-sm hover:bg-surface-container"
                onClick={() => onSelect(p)}
              >
                {p.itemId} · {p.name} <small>{p.productType}</small>
              </button>
            ))}
            {products.hasNextPage && (
              <Button
                fullWidth
                variant="outline"
                loading={products.isFetchingNextPage}
                onClick={() => runUiAction(() => products.fetchNextPage())}
              >
                Cargar más productos
              </Button>
            )}
          </div>
        )}
      {isProductSearchApplied &&
        !products.isFetching &&
        !products.isError &&
        products.items.length === 0 && (
          <p className="text-xs text-on-surface-variant">
            No se encontraron productos.
          </p>
        )}
    </>
  );
};
