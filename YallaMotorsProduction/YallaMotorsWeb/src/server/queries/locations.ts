import 'server-only';

import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { AreaListResponseSchema, CityAreasParamsSchema, CityListResponseSchema, CountryCitiesParamsSchema, CountryCodeParamsSchema, CountryConfigResponseSchema, CountryListResponseSchema, adaptRawAreaList, adaptRawCityList, adaptRawCountryConfig, adaptRawCountryList } from '@/lib/api/schemas/taxonomy';
import { areasPolicy, citiesPolicy, countriesPolicy, countryConfigPolicy } from '@/lib/cache/policy';
import { publicQuery } from './public';
import type { Locale } from '@/types/common';
import type { AreaListResponse, CityAreasParams, CityListResponse, CountryCitiesParams, CountryCodeParams, CountryConfigResponse, CountryListResponse } from '@/types/taxonomy';

export function listCountries(locale: Locale): Promise<CountryListResponse> { return publicQuery({ operation: 'listCountries', endpoint: UPSTREAM_ENDPOINTS.countries, outputSchema: CountryListResponseSchema, locale, cachePolicy: countriesPolicy(), adapter: adaptRawCountryList }); }
export function getCountryConfig(params: CountryCodeParams, locale: Locale): Promise<CountryConfigResponse> { const { code } = CountryCodeParamsSchema.parse(params); return publicQuery({ operation: 'getCountryConfig', endpoint: () => UPSTREAM_ENDPOINTS.countryConfig(code), outputSchema: CountryConfigResponseSchema, locale, cachePolicy: countryConfigPolicy(code), adapter: adaptRawCountryConfig }); }
export function listCities(params: CountryCitiesParams, locale: Locale): Promise<CityListResponse> { const { code } = CountryCitiesParamsSchema.parse(params); return publicQuery({ operation: 'listCities', endpoint: () => UPSTREAM_ENDPOINTS.cities(code), outputSchema: CityListResponseSchema, locale, cachePolicy: citiesPolicy(code), adapter: adaptRawCityList }); }
export function listAreas(params: CityAreasParams, locale: Locale): Promise<AreaListResponse> { const { cityId } = CityAreasParamsSchema.parse(params); return publicQuery({ operation: 'listAreas', endpoint: () => UPSTREAM_ENDPOINTS.areas(cityId), outputSchema: AreaListResponseSchema, locale, cachePolicy: areasPolicy(cityId), adapter: adaptRawAreaList }); }

