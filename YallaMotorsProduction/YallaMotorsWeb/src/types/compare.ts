import type {
  BodyType,
  FuelType,
  Transmission,
} from './listing';

export type CompareItemKind = 'listing' | 'trim';

export interface CompareItemRef {
  kind: 'listing' | 'trim';
  id: string;
}

export interface ComparisonItem {
  id: string;
  title: string;
  subtitle: string | null;
  detailRoute: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  powerHp: number | null;
  warrantyYears: number | null;
  engineCc: number | null;
  mileageKm: number | null;
  seats: number | null;
  transmission: Transmission | null;
  fuelType: FuelType | null;
  bodyType: BodyType | null;
}

export type ComparisonBetter = 'none' | 'lower' | 'higher';

export interface ComparisonSpecRow {
  label: string;
  display: string[];
  numeric: Array<number | null>;
  better: ComparisonBetter;
}

export interface ComparePageData {
  items: ComparisonItem[];
  rows: ComparisonSpecRow[];
}

export interface CompareParams {
  items: CompareItemRef[];
}
