import { useQuery } from "@tanstack/react-query";
import { useSession } from "../../app/providers/SessionProvider";
import { catalogService } from "../catalogs/catalogService";
import { catalogKeys } from "../catalogs/queryKeys";
import type { OrderDraft } from "./types";
import { agreementPackageError } from "./agreementPackage";

export const useAgreementPackage = (draft: OrderDraft) => {
  const { api } = useSession();
  const query = useQuery({
    queryKey: catalogKeys.catalog(
      "agreement-package",
      draft.dataAreaId,
      draft.customer?.account ?? "",
      String(draft.agreement?.recId ?? ""),
    ),
    queryFn: ({ signal }) =>
      catalogService(api).partialAgreementLines(
        draft.dataAreaId,
        draft.customer!.account,
        draft.agreement!.recId,
        { signal },
      ),
    enabled: Boolean(draft.customer && draft.agreement),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const validation = query.data
    ? agreementPackageError(draft, query.data)
    : null;
  return {
    query,
    validation,
    ready: query.isSuccess && !query.isFetching && !validation,
  };
};
