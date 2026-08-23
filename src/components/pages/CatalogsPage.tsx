import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/providers/SessionProvider';
import { catalogService } from '../../features/catalogs/catalogService';
import { GeographySelector } from '../../features/catalogs/GeographySelector';
import { emptyGeography, type GeographySelection } from '../../features/catalogs/geography';
import { useReferenceCatalogs } from '../../features/catalogs/hooks';
import { catalogKeys } from '../../features/catalogs/queryKeys';
import { Card, EmptyState, Input } from '../ui';
const CatalogsPage: React.FC = () => {
  const { api, context } = useSession();
  const [geo, setGeo] = useState<GeographySelection>(emptyGeography);
  const [vatSearch, setVatSearch] = useState('');
  const refs = useReferenceCatalogs('', geo.countryId);
  const vats = useQuery({
    queryKey: catalogKeys.catalog('vat', context.company?.id ?? '', geo.countryId, vatSearch),
    queryFn: ({ signal }) =>
      catalogService(api).vatNumbers(context.company!.id, geo.countryId, vatSearch, { signal }),
    enabled: Boolean(context.company && geo.countryId),
  });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Catálogos operativos</h1>
        <p className="text-xs text-on-surface-variant">
          Entrega, origen, promociones, geografía y documentos
        </p>
      </div>
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Ubicación geográfica</h2>
        <GeographySelector value={geo} onChange={setGeo} />
      </Card>
      <div className="grid md:grid-cols-3 gap-3">
        <Card className="p-4">
          <h2 className="font-semibold mb-2">Modos de entrega</h2>
          {refs.delivery.data?.map((x) => (
            <p className="text-xs py-1" key={x.code}>
              <strong>{x.code}</strong> — {x.description}
            </p>
          ))}
        </Card>
        <Card className="p-4">
          <h2 className="font-semibold mb-2">Orígenes de venta</h2>
          {refs.origins.data?.map((x) => (
            <p className="text-xs py-1" key={x.id}>
              <strong>{x.id}</strong> — {x.description}
            </p>
          ))}
        </Card>
        <Card className="p-4">
          <h2 className="font-semibold mb-2">Grupos de bonificación</h2>
          {refs.promotions.data?.map((x) => (
            <p className="text-xs py-1" key={x.groupId}>
              <strong>{x.groupId}</strong> — {x.name} ({x.forecastDiscount}%)
            </p>
          ))}
        </Card>
      </div>
      <Card className="p-4">
        <h2 className="font-semibold mb-3">NIT y tipos de documento</h2>
        {!geo.countryId ? (
          <EmptyState title="Selecciona un país" />
        ) : (
          <>
            <p className="text-xs mb-3">
              Tipos: {refs.documents.data?.documentTypes.join(', ') || 'Sin opciones'}
            </p>
            <Input
              label="Buscar nombre/NIT"
              value={vatSearch}
              onChange={(e) => setVatSearch(e.target.value)}
            />
            <div className="mt-3">
              {vats.data?.items.map((x) => (
                <p key={x.vatNumber} className="text-xs py-1">
                  <strong>{x.vatNumber}</strong> — {x.name} · {x.documentType}
                </p>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
export default CatalogsPage;
