import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isAppLocale, type AppLocale } from "./config";

const messageLoaders: Record<AppLocale, () => Promise<{ default: Record<string, unknown> }>> = {
  ar: () => import("../../messages/ar.json"),
  en: () => import("../../messages/en.json"),
};

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !isAppLocale(locale)) {
    locale = defaultLocale;
  }

  const selectedLocale = locale as AppLocale;
  const messagesModule = await (messageLoaders[selectedLocale] ?? messageLoaders[defaultLocale])();

  return {
    locale: selectedLocale,
    messages: messagesModule.default,
  };
});
