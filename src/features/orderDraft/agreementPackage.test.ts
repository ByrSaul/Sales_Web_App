import { describe, expect, it } from "vitest";
import { agreementLine } from "../catalogs/mappers";
import { validDraft } from "../orders/testFixtures";
import {
  agreementPackageError,
  buildAgreementPackageLines,
  validateAgreementSelection,
} from "./agreementPackage";
import type { OrderDraft } from "./types";

const draft = (): OrderDraft => ({
  ...validDraft(),
  agreement: {
    recId: 305,
    number: "PQT-305",
    title: "Paquete 20%",
    currency: "GTQ",
  },
  lines: [],
});
const row = () =>
  agreementLine({
    matchingagreementline: 71,
    itemid: "I1",
    name: "Producto",
    qtyline: 2.5,
    price: 19.7,
    currency: "GTQ",
    customerdataareaid: "CO",
    custaccount: "C1",
    salesnumbersequence: "PQT-305",
    inventsiteid: "S1",
    inventlocationid: "W1",
  });

describe("commercial package validation and construction", () => {
  it("retains exact prices and quantities without interpreting title discounts or creating bonuses", () => {
    const lines = buildAgreementPackageLines(draft(), [row()]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      price: 19.7,
      quantity: 2.5,
      isBonification: false,
      promotion: null,
      matchingAgreementLine: 71,
      presentationCode: null,
    });
    expect(lines[0].localId).toBeTruthy();
  });
  it.each([
    "customer",
    "agreement",
    "currency",
    "header-currency",
    "company",
    "customer-reference",
    "package-reference",
  ])("blocks inconsistent %s context", (context) => {
    const current = draft();
    const line = row();
    switch (context) {
      case "customer":
        current.customer = null;
        break;
      case "agreement":
        current.agreement = null;
        break;
      case "currency":
        line.currency = "USD";
        break;
      case "header-currency":
        current.currencyCode = "USD";
        break;
      case "company":
        line.companyId = "OT";
        break;
      case "customer-reference":
        line.customerAccount = "C2";
        break;
      case "package-reference":
        line.agreementNumber = "OTHER";
        break;
    }
    expect(agreementPackageError(current, [line])).toBeTruthy();
    expect(() => buildAgreementPackageLines(current, [line])).toThrow();
  });
  it("rejects a whole response with repeated line references rather than creating duplicates", () => {
    expect(agreementPackageError(draft(), [row(), row()])).toContain(
      "duplicadas",
    );
    expect(() => buildAgreementPackageLines(draft(), [row(), row()])).toThrow();
  });
  it.each(["reference", "item", "quantity", "price", "site", "warehouse"])(
    "blocks an invalid %s without a partial package",
    (field) => {
      const line = row();
      switch (field) {
        case "reference":
          line.matchingLine = 0;
          break;
        case "item":
          line.itemId = "";
          break;
        case "quantity":
          line.lineQuantity = 0;
          break;
        case "price":
          line.price = 0;
          line.debugMessage = "Precio no disponible";
          break;
        case "site":
          line.siteId = "";
          break;
        case "warehouse":
          line.warehouseId = "";
          break;
      }
      expect(agreementPackageError(draft(), [line])).toBeTruthy();
      expect(() => buildAgreementPackageLines(draft(), [line])).toThrow();
    },
  );
  it("rejects an empty package and exposes its backend explanation for an invalid price", () => {
    expect(agreementPackageError(draft(), [])).toBe(
      "El paquete no tiene líneas disponibles.",
    );
    expect(
      agreementPackageError(draft(), [
        { ...row(), price: 0, debugMessage: "Sin precio en Dynamics" },
      ]),
    ).toContain("Sin precio en Dynamics");
  });
  it("detects an already added reference and leaves unrelated manual selections unchanged", () => {
    const current = draft();
    current.lines = buildAgreementPackageLines(current, [row()]);
    expect(validateAgreementSelection(current, row())[0].message).toContain(
      "ya está",
    );
    expect(validateAgreementSelection(current)).toEqual([]);
    expect(
      validateAgreementSelection(current, { ...row(), matchingLine: 72 }),
    ).toEqual([]);
    expect(
      validateAgreementSelection(current, { ...row(), currency: "USD" }),
    ).toHaveLength(1);
  });
});
