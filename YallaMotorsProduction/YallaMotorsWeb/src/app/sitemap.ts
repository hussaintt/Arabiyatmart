import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';
import { serverEnv } from '@/lib/env/server';
import { searchListings } from '@/server/queries/listings';
import { listDealers } from '@/server/queries/dealers';
import { listGenerations, listMakes, listModels, listTrims } from '@/server/queries/taxonomy';

export const revalidate = 3600;

interface SitemapPath {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
}

function localizedEntry({ path, changeFrequency, priority }: SitemapPath, locale: (typeof locales)[number]): MetadataRoute.Sitemap[number] {
  const origin = serverEnv.SITE_ORIGIN.replace(/\/$/, '');
  const localizedPath = `/${locale}${path}`;
  const ar = `${origin}/ar${path}`;
  return {
    url: `${origin}${localizedPath}`,
    changeFrequency,
    priority,
    alternates: { languages: { ar, en: `${origin}/en${path}`, 'x-default': ar } },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths: SitemapPath[] = [
    { path: '', changeFrequency: 'daily', priority: 1 },
    { path: '/search', changeFrequency: 'daily', priority: 0.9 },
    { path: '/dealers', changeFrequency: 'daily', priority: 0.8 },
    { path: '/catalogue/makes', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/news', changeFrequency: 'weekly', priority: 0.5 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  ];

  const [makesResult, dealersResult, listingsResult] = await Promise.allSettled([
    listMakes('ar'),
    listDealers({ limit: 40 }, 'ar'),
    searchListings({ page: 1, limit: 40, sort: 'newest' }, 'ar'),
  ]);

  const makes = makesResult.status === 'fulfilled' ? makesResult.value.data.filter((make) => make.isActive).slice(0, 40) : [];
  const dealers = dealersResult.status === 'fulfilled' ? dealersResult.value.data : [];
  const listings = listingsResult.status === 'fulfilled' ? listingsResult.value.data : [];
  const modelResults = await Promise.allSettled(makes.slice(0, 25).map((make) => listModels({ makeSlug: make.slug }, 'ar')));
  const activeModels = modelResults.flatMap((result) => result.status === 'fulfilled' ? result.value.data.filter((model) => model.isActive) : []);
  const modelIds = [...new Set(activeModels.map((model) => model.publicId))].slice(0, 250);
  const generationResults = await Promise.allSettled(activeModels.slice(0, 20).map((model) => listGenerations({ modelPublicId: model.publicId }, 'ar')));
  const generations = generationResults.flatMap((result) => result.status === 'fulfilled' ? result.value.data : []).slice(0, 30);
  const trimResults = await Promise.allSettled(generations.map((generation) => listTrims({ generationPublicId: generation.publicId }, 'ar')));
  const trimIds = [...new Set(trimResults.flatMap((result) => result.status === 'fulfilled' ? result.value.data.filter((trim) => trim.isActive).map((trim) => trim.publicId) : []))].slice(0, 250);

  const dynamicPaths: SitemapPath[] = [
    ...makes.map((make) => ({ path: `/catalogue/makes/${make.slug}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...modelIds.map((publicId) => ({ path: `/catalogue/models/${publicId}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...trimIds.map((publicId) => ({ path: `/catalogue/trims/${publicId}`, changeFrequency: 'weekly' as const, priority: 0.65 })),
    ...dealers.map((dealer) => ({ path: `/dealers/${dealer.slug}`, changeFrequency: 'daily' as const, priority: 0.7 })),
    ...listings.map((listing) => ({ path: `/listing/${listing.slug}`, changeFrequency: 'daily' as const, priority: 0.8 })),
  ];

  const uniquePaths = [...new Map([...staticPaths, ...dynamicPaths].map((item) => [item.path, item])).values()];
  return uniquePaths.flatMap((item) => locales.map((locale) => localizedEntry(item, locale)));
}
