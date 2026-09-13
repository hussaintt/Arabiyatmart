'use client';

import * as React from 'react';
import { CarFront, ChevronDown, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { browserApiRequest } from '@/lib/api/browser';
import { VehicleSearchSuggestionResponseSchema } from '@/lib/api/schemas/saved-search';
import { fetchMakes, fetchModels } from '@/lib/search/options';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { CarCondition } from '@/types/listing';
import type { VehicleSearchSuggestion } from '@/types/saved-search';
import type { Make } from '@/types/taxonomy';

export interface HeroSearchProps {
  locale?: AppLocale | undefined;
  className?: string | undefined;
  seedSuggestions?: VehicleSearchSuggestion[] | undefined;
}

export interface SmartVehicleSuggestion extends VehicleSearchSuggestion {
  id: string;
  displayLabel: string;
  year: number | null;
}

const EMPTY_SUGGESTIONS: VehicleSearchSuggestion[] = [];

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isOrderedSubsequence(needle: string, haystack: string): boolean {
  if (!needle) return true;
  let needleIndex = 0;
  for (const character of haystack) {
    if (character === needle[needleIndex]) needleIndex += 1;
    if (needleIndex === needle.length) return true;
  }
  return false;
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1]! + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(previous[rightIndex]! + 1, current[rightIndex - 1]! + 1, substitution);
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length]!;
}

function isAdjacentTransposition(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  const differences = Array.from({ length: left.length }, (_, index) => index)
    .filter((index) => left[index] !== right[index]);
  if (differences.length !== 2 || differences[1] !== differences[0]! + 1) return false;
  const first = differences[0]!;
  const second = differences[1]!;
  return left[first] === right[second] && left[second] === right[first];
}

function hasCloseWordPrefix(needle: string, haystack: string): boolean {
  if (needle.length < 3) return false;
  return haystack.split(' ').some((word) => {
    const shortest = Math.max(1, needle.length - 1);
    const longest = Math.min(word.length, needle.length + 1);
    for (let length = shortest; length <= longest; length += 1) {
      const prefix = word.slice(0, length);
      if (editDistance(needle, prefix) <= 1 || isAdjacentTransposition(needle, prefix)) return true;
    }
    return false;
  });
}

function smartMatchScore(label: string, query: string): number {
  const haystack = normalizeSearchText(label);
  const needle = normalizeSearchText(query);
  if (haystack.startsWith(needle)) return 0;
  if (needle.startsWith(haystack)) return 1;
  if (haystack.split(' ').some((word) => word.startsWith(needle))) return 2;
  if (hasCloseWordPrefix(needle, haystack)) return 3;
  if (haystack.includes(needle)) return 4;
  if (isOrderedSubsequence(needle, haystack)) return 5;
  return 10;
}

function rankMatchingMakes(makes: Make[], query: string, locale: AppLocale): Make[] {
  return makes
    .filter((make) => make.isActive)
    .map((make) => ({ make, score: smartMatchScore(make.name[locale], query) }))
    .filter(({ score }) => score < 10)
    .sort((a, b) => a.score - b.score || a.make.sortOrder - b.make.sortOrder)
    .slice(0, 2)
    .map(({ make }) => make);
}

export function buildSmartSuggestions(
  items: VehicleSearchSuggestion[],
  query: string,
  locale: AppLocale,
  currentYear = new Date().getFullYear(),
): SmartVehicleSuggestion[] {
  const needle = normalizeSearchText(query);
  const yearLabel = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    useGrouping: false,
  }).format(currentYear);

  const ranked = [...items]
    .map((item, index) => {
      const haystack = normalizeSearchText(item.label);
      const score = smartMatchScore(haystack, needle);
      return { item, index, score: score * 10 + (item.type === 'MODEL' ? 0 : 1) };
    })
    .filter(({ score }) => score < 100)
    .sort((a, b) => a.score - b.score || a.index - b.index);

  const expanded: SmartVehicleSuggestion[] = [];
  const seen = new Set<string>();

  for (const { item } of ranked) {
    const baseId = `${item.type}:${item.makeSlug}:${item.modelSlug ?? ''}`;
    if (!seen.has(baseId)) {
      seen.add(baseId);
      expanded.push({ ...item, id: baseId, displayLabel: item.label, year: null });
    }

    if (item.type === 'MODEL' && item.modelSlug) {
      const yearId = `${baseId}:${currentYear}`;
      if (!seen.has(yearId)) {
        seen.add(yearId);
        expanded.push({
          ...item,
          id: yearId,
          displayLabel: `${item.label} ${yearLabel}`,
          year: currentYear,
        });
      }
    }

    if (expanded.length >= 8) break;
  }

  return expanded.slice(0, 8);
}

export function HeroSearch({ locale = 'ar', className, seedSuggestions = EMPTY_SUGGESTIONS }: HeroSearchProps) {
  const isArabic = locale === 'ar';
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const [query, setQuery] = React.useState('');
  const [budget, setBudget] = React.useState('');
  const [condition, setCondition] = React.useState<CarCondition | 'ALL'>('ALL');
  const [suggestions, setSuggestions] = React.useState<SmartVehicleSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);

  const trimmedQuery = query.trim();
  const listboxId = React.useId();
  const showSuggestions = isFocused && trimmedQuery.length >= 2 && (isLoading || suggestions.length > 0);

  React.useEffect(() => {
    if (trimmedQuery.length < 2) {
      abortRef.current?.abort();
      setSuggestions([]);
      setActiveIndex(-1);
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmedQuery, locale, limit: '8' });
        if (condition !== 'ALL') params.set('condition', condition);

        const [suggestionResult, makesResult] = await Promise.allSettled([
          browserApiRequest({
            path: `/api/bff/search/suggest?${params.toString()}`,
            outputSchema: VehicleSearchSuggestionResponseSchema,
            signal: controller.signal,
          }),
          fetchMakes({ signal: controller.signal }),
        ]);

        const apiSuggestions = suggestionResult.status === 'fulfilled' ? suggestionResult.value.data : [];
        const matchingMakes = makesResult.status === 'fulfilled'
          ? rankMatchingMakes(makesResult.value, trimmedQuery, locale)
          : [];
        const modelResults = await Promise.allSettled(
          matchingMakes.map((make) => fetchModels(make.slug, { signal: controller.signal })),
        );
        const correctedSuggestionResults = await Promise.allSettled(matchingMakes.map((make) => {
          const correctedParams = new URLSearchParams({ q: make.name[locale], locale, limit: '8' });
          if (condition !== 'ALL') correctedParams.set('condition', condition);
          return browserApiRequest({
            path: `/api/bff/search/suggest?${correctedParams.toString()}`,
            outputSchema: VehicleSearchSuggestionResponseSchema,
            signal: controller.signal,
          });
        }));
        const correctedSuggestions = correctedSuggestionResults.flatMap((result) => (
          result.status === 'fulfilled' ? result.value.data : []
        ));
        const taxonomySuggestions: VehicleSearchSuggestion[] = matchingMakes.flatMap((make, index) => {
          const makeLabel = make.name[locale];
          const makeSuggestion: VehicleSearchSuggestion = {
            type: 'MAKE',
            label: makeLabel,
            makeSlug: make.slug,
            modelSlug: null,
            comparisonRef: null,
          };
          const models = modelResults[index]?.status === 'fulfilled' ? modelResults[index].value : [];
          return [
            makeSuggestion,
            ...models.filter((model) => model.isActive).map((model): VehicleSearchSuggestion => ({
              type: 'MODEL',
              label: `${makeLabel} ${model.name[locale]}`,
              makeSlug: make.slug,
              modelSlug: model.slug,
              comparisonRef: null,
            })),
          ];
        });

        if (!controller.signal.aborted) {
          setSuggestions(buildSmartSuggestions([
            ...seedSuggestions,
            ...correctedSuggestions,
            ...taxonomySuggestions,
            ...apiSuggestions,
          ], trimmedQuery, locale));
          setActiveIndex(-1);
        }
      } catch (error) {
        if (!controller.signal.aborted && (error as Error).name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [condition, locale, seedSuggestions, trimmedQuery]);

  const buildConditionParams = React.useCallback(() => {
    const params = new URLSearchParams();
    if (condition !== 'ALL') params.set('condition', condition);
    if (budget) params.set('priceMax', budget);
    return params;
  }, [condition, budget]);

  const selectSuggestion = (suggestion: SmartVehicleSuggestion) => {
    const params = buildConditionParams();
    params.set('makeSlug', suggestion.makeSlug);
    if (suggestion.modelSlug) params.set('modelSlug', suggestion.modelSlug);
    if (suggestion.year) {
      params.set('yearMin', String(suggestion.year));
      params.set('yearMax', String(suggestion.year));
    }
    setQuery(suggestion.displayLabel);
    setIsFocused(false);
    router.push(`/search?${params.toString()}`);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (activeIndex >= 0 && suggestions[activeIndex]) {
      selectSuggestion(suggestions[activeIndex]);
      return;
    }

    const params = new URLSearchParams();
    if (trimmedQuery) params.set('q', trimmedQuery);
    if (condition !== 'ALL') params.set('condition', condition);
    if (budget) params.set('priceMax', budget);
    const queryString = params.toString();
    router.push(queryString ? `/search?${queryString}` : '/search');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;
    if (event.key !== 'Escape' && (isLoading || suggestions.length === 0)) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsFocused(false);
    }
  };

  const conditions: Array<{ value: CarCondition | 'ALL'; ar: string; en: string }> = [
    { value: 'ALL', ar: 'كل السيارات', en: 'All cars' },
    { value: 'USED', ar: 'مستعمل', en: 'Used' },
    { value: 'NEW', ar: 'جديد', en: 'New' },
  ];

  return (
    <div
      className={cn(
        'home-search',
        className,
      )}
      data-testid="hero-search"
    >
      <form action={`/${locale}/search`} method="get" onSubmit={handleSubmit} role="search">
        {condition !== 'ALL' && <input type="hidden" name="condition" value={condition} />}
        <div className="home-search-top">
        <div className="home-condition-tabs" aria-label={isArabic ? 'حالة السيارة' : 'Vehicle condition'}>
          {conditions.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setCondition(item.value)}
              aria-pressed={condition === item.value}
              className={cn(
                'home-condition-tab',
                condition === item.value
                  ? 'is-selected' : '',
              )}
            >
              {isArabic ? item.ar : item.en}
            </button>
          ))}
        </div>

        <Link href="/search" locale={locale} className="home-advanced-search"><SlidersHorizontal size={15} /><span>{isArabic ? 'بحث متقدم' : 'Advanced search'}</span></Link>
        </div>
        <div className="home-search-fields">
          <div className="relative min-w-0 flex-1">
            <label htmlFor={`${listboxId}-input`} className="home-field-label">{isArabic ? 'الماركة أو الموديل' : 'Make or model'}</label>
            <Search className="pointer-events-none absolute start-4 bottom-[17px] h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              id={`${listboxId}-input`}
              name="q"
              maxLength={120}
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setActiveIndex(-1); }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
              onKeyDown={handleKeyDown}
              placeholder={isArabic ? 'ابحث عن سيارة، ماركة أو موديل...' : 'Search by car, make, or model...'}
              className="home-query-input h-14 rounded-lg ps-12 pe-4 text-sm"
              aria-label={isArabic ? 'بحث السيارات' : 'Search vehicles'}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
              aria-controls={listboxId}
              aria-activedescendant={showSuggestions && !isLoading && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
              autoComplete="off"
            />

            {showSuggestions ? (
              <ul
                id={listboxId}
                role="listbox"
                aria-label={isArabic ? 'اقتراحات السيارات' : 'Vehicle suggestions'}
                className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 max-h-80 overflow-y-auto rounded-xl border border-line bg-card p-2 shadow-lg"
              >
                {isLoading ? (
                  <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground" role="option" aria-selected="false">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    {isArabic ? 'نبحث عن أفضل التطابقات…' : 'Finding the best matches…'}
                  </li>
                ) : suggestions.map((suggestion, index) => (
                  <li id={`${listboxId}-${index}`} key={suggestion.id} role="option" aria-selected={index === activeIndex}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectSuggestion(suggestion)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm transition-colors',
                        index === activeIndex ? 'bg-primary-soft text-primary' : 'hover:bg-muted',
                      )}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <CarFront className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{suggestion.displayLabel}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {suggestion.type === 'MAKE'
                            ? (isArabic ? 'ماركة سيارات' : 'Car make')
                            : suggestion.year
                              ? (isArabic ? 'موديل وسنة الصنع' : 'Model and year')
                              : (isArabic ? 'موديل سيارة' : 'Car model')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="home-budget-field"><label htmlFor={`${listboxId}-budget`} className="home-field-label">{isArabic ? 'الحد الأقصى للسعر' : 'Maximum budget'}</label><div className="relative"><select id={`${listboxId}-budget`} name="priceMax" value={budget} onChange={(event) => setBudget(event.target.value)} className="home-budget-select"><option value="">{isArabic ? 'كل الأسعار' : 'Any price'}</option>{[500000, 750000, 1000000, 1500000, 2000000, 3000000].map(price => <option key={price} value={String(price * 100)}>{new Intl.NumberFormat(isArabic ? 'ar-EG' : 'en-EG').format(price)} {isArabic ? 'ج.م' : 'EGP'}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-muted-foreground" /></div></div>
          <Button type="submit" size="default" aria-label={isArabic ? 'بحث' : 'Search'} className="home-search-submit h-14 shrink-0 rounded-lg px-7 font-bold">
            <Search className="h-4 w-4 shrink-0" />
            <span>{isArabic ? 'ابحث عن سيارتك' : 'Find my car'}</span>
          </Button>
        </div>
      </form>
      <div className="home-popular-searches"><span>{isArabic ? 'اكتشف أيضاً:' : 'Explore:'}</span><Link href="/search?bodyType=SUV" locale={locale}>{isArabic ? 'سيارات SUV' : 'SUVs'}</Link><Link href="/search?bodyType=SEDAN" locale={locale}>{isArabic ? 'سيدان' : 'Sedans'}</Link><Link href="/search?fuelType=ELECTRIC" locale={locale}>{isArabic ? 'كهربائية' : 'Electric cars'}</Link><Link href="/search?sellerType=PRIVATE" locale={locale}>{isArabic ? 'من المالك مباشرة' : 'From private owners'}</Link></div>
    </div>
  );
}
