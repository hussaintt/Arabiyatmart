export type SettingGroup =
  | 'BUSINESS'
  | 'LISTING'
  | 'VENDOR'
  | 'PAYMENT'
  | 'APP'
  | 'NOTIFICATION';

export type SettingType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';

export interface PublicSetting {
  key: string;
  group: SettingGroup;
  value: string;
  type: SettingType;
  updatedAt: string;
}

export interface FinanceConfig {
  annualRate: number;
  downPaymentFraction: number;
  tenorMonths: number;
}

export interface SupportConfig {
  termsUrl: string | null;
  privacyUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
}

export interface PublicSettingsResponse {
  data: {
    rows: PublicSetting[];
    finance: FinanceConfig;
    support: SupportConfig;
  };
}
