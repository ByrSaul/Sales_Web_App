import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../../core/api/apiClient";
import { vatService, type CreateVatInput } from "./vatService";

const input: CreateVatInput = {
  company: "CO",
  countryId: "PAN",
  vatNumber: "123",
  name: "Cliente",
  documentType: "RUC",
  taxpayerType: "Natural",
  personType: "",
};
const record = {
  dataAreaId: "CO",
  CountryRegionId: "PAN",
  VATNum: "456",
  Name: "Confirmado",
  DocumentTypeIdentificationId: "RUC",
  CS_FEL_TaxpayerType_PA: "Juridico",
  CS_FEL_PersonType_SV: "",
  CS_FEL_RUCChecker_PA: "9",
};
const setup = (response: unknown) => {
  const post = vi.fn().mockResolvedValue(response);
  return { post, service: vatService({ post } as unknown as ApiClient) };
};

describe("VAT backend contracts", () => {
  it.each([
    { response: record },
    { response: [record] },
    { response: { "@odata": [record] } },
  ])(
    "normalizes supported creation envelopes without changing the POST",
    async ({ response }) => {
      const { post, service } = setup(response);
      await expect(service.create(input)).resolves.toMatchObject({
        companyId: "CO",
        countryId: "PAN",
        vatNumber: "456",
        name: "Confirmado",
        taxpayerTypePanama: "Juridico",
        rucCheckerPanama: "9",
      });
      expect(post).toHaveBeenCalledExactlyOnceWith("/d365/vat_num", {
        dataAreaId: "CO",
        CountryRegionId: "PAN",
        VATNum: "123",
        Name: "Cliente",
        DocumentTypeIdentificationId: "RUC",
        CS_FEL_TaxpayerType_PA: "Natural",
        CS_FEL_PersonType_SV: "",
      });
    },
  );

  it.each([{ response: {} }, { response: [] }, { response: { "@odata": [] } }])(
    "preserves submitted identifiers for an empty creation response",
    async ({ response }) => {
      const { service } = setup(response);
      await expect(service.create(input)).resolves.toMatchObject({
        vatNumber: "123",
        name: "Cliente",
        documentType: "RUC",
        taxpayerTypePanama: "Natural",
      });
    },
  );

  it("preserves filters, sort, pagination and cancellation in VAT searches", async () => {
    const { service, post } = setup({
      "@odata": [record],
      pagination: {
        CurrentPage: 2,
        PerPage: 25,
        FromRecord: 26,
        ToRecord: 26,
        TotalRecords: 26,
        TotalPages: 2,
      },
    });
    const signal = new AbortController().signal;
    const response = await service.query("CO", "PAN", "Cliente", 2, signal);
    expect(response.items[0]).toMatchObject({
      vatNumber: "456",
      rucCheckerPanama: "9",
    });
    expect(response.pagination).toMatchObject({
      currentPage: 2,
      totalRecords: 26,
    });
    expect(post).toHaveBeenCalledExactlyOnceWith(
      "/d365/vat_num/query",
      {
        filters: { Name: "Cliente", dataAreaId: "CO", CountryRegionId: "PAN" },
        sort: { fields: [{ name: "VATNum", order: "desc" }] },
        page: 2,
        perpage: 25,
      },
      { signal },
    );
  });

  it("maps document catalogs and ignores empty values without inventing fiscal codes", async () => {
    const { service, post } = setup({
      "@odata": {
        DocType: [{ DocumentTypeIdentificationId: "RUC" }, {}],
        FelPA: [{ CS_FEL_RUCChecker_PA: "9" }],
        FelSV: [{ CS_FEL_PersonType_SV: "Natural" }],
      },
    });
    await expect(service.documentTypes("CO", "PAN")).resolves.toEqual({
      documentTypes: ["RUC"],
      felPanama: ["9"],
      felElSalvador: ["Natural"],
    });
    expect(post).toHaveBeenCalledExactlyOnceWith(
      "/d365/vat_num/document_type/query",
      { filters: { dataAreaId: "CO", CountryRegionId: "PAN" } },
      { signal: undefined },
    );
  });

  it("handles absent query records and document catalogs", async () => {
    const { service } = setup({});
    await expect(service.query("CO", "PAN", "", 1)).resolves.toMatchObject({
      items: [],
      pagination: { currentPage: 1, totalRecords: 0 },
    });
    await expect(service.documentTypes("CO", "PAN")).resolves.toEqual({
      documentTypes: [],
      felPanama: [],
      felElSalvador: [],
    });
  });

  it("propagates a backend rejection once without posting again", async () => {
    const { service, post } = setup({});
    const failure = new Error("offline");
    post.mockRejectedValue(failure);
    await expect(service.create(input)).rejects.toBe(failure);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
