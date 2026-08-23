export type GeographySelection = {
  countryId: string;
  stateId: string;
  countyId: string;
  cityId: string;
  zipCode: string;
};
export const emptyGeography: GeographySelection = {
  countryId: '',
  stateId: '',
  countyId: '',
  cityId: '',
  zipCode: '',
};
export const selectCountry = (
  value: GeographySelection,
  countryId: string,
): GeographySelection => ({ ...emptyGeography, countryId });
export const selectState = (value: GeographySelection, stateId: string): GeographySelection => ({
  ...value,
  stateId,
  countyId: '',
  cityId: '',
  zipCode: '',
});
export const selectCounty = (value: GeographySelection, countyId: string): GeographySelection => ({
  ...value,
  countyId,
  cityId: '',
  zipCode: '',
});
export const selectCity = (value: GeographySelection, cityId: string): GeographySelection => ({
  ...value,
  cityId,
  zipCode: '',
});
