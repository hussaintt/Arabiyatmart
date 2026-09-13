import Link from 'next/link';

export const metadata = {
  title: '404 - الصفحة غير موجودة / Page Not Found | Arabiyatmart',
  description: 'الصفحة غير موجودة في عربيات مارت / Page not found on Arabiyatmart',
  robots: { index: false, follow: true },
};

export default function RootNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased">
      {/* Minimal Branded Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/ar"
            className="flex items-center gap-3 transition-opacity hover:opacity-90"
            aria-label="عربيات مارت - الرئيسية"
          >
            {/* Automotive Steering Wheel Icon */}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="2.5" />
                <path d="M12 14.5V21" />
                <path d="M4.5 8.5L9.5 11" />
                <path d="M19.5 8.5L14.5 11" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-primary leading-none">
                عربيات مارت
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">
                Arabiyatmart
              </span>
            </div>
          </Link>

          {/* Language Switcher */}
          <nav className="flex items-center gap-1.5 text-xs font-bold" aria-label="اللغة / Language">
            <Link
              href="/ar"
              className="rounded-lg bg-muted px-3 py-1.5 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              العربية
            </Link>
            <span className="text-border" aria-hidden="true">|</span>
            <Link
              href="/en"
              className="rounded-lg border border-border px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              English
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Error Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8 min-h-[70vh]">
        <div className="relative w-full max-w-2xl rounded-3xl border border-border bg-card/90 p-8 text-center shadow-sm sm:p-12">
          {/* Car-Themed SVG Illustration */}
          <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-muted text-primary border border-primary/20 shadow-lg sm:h-28 sm:w-28">
            <svg
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-14 w-14 sm:h-16 sm:w-16"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {/* Sleek car outline */}
              <path d="M7 40h6m12 0h14m12 0h6c2.2 0 4-1.8 3.8-4l-1.8-8.2c-.6-2.5-2.6-4.3-5.2-4.6l-8-1-8.8-9.2c-1.5-1.5-3.5-2.4-5.6-2.4H24.4c-2.3 0-4.5 1-6 2.8L12.2 21.8 7.5 24c-2.4 1.1-3.7 3.5-3.5 6.1l.8 6.1C5 38.3 6.8 40 7 40z" />
              {/* Wheels */}
              <circle cx="19" cy="40" r="6" className="fill-card" strokeWidth="2.5" />
              <circle cx="19" cy="40" r="2" fill="currentColor" />
              <circle cx="45" cy="40" r="6" className="fill-card" strokeWidth="2.5" />
              <circle cx="45" cy="40" r="2" fill="currentColor" />
              {/* Windows */}
              <path
                d="M23 15h13.2c1.4 0 2.8.6 3.8 1.6L46 23H20l3-8z"
                className="fill-primary/10"
                strokeWidth="1.8"
              />
              <line x1="33" y1="15" x2="33" y2="23" strokeWidth="1.8" />
              {/* Headlight & Taillight */}
              <path d="M57 28l3 .5" strokeWidth="2" />
              <path d="M5 28.5h3" strokeWidth="2" />
              {/* Road Line with Dashes */}
              <path d="M2 49h60" strokeDasharray="5 3" strokeWidth="2" className="text-muted-foreground/50" />
            </svg>

            {/* Warning Badge */}
            <div
              className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-sm"
              title="تنبيه / Warning"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </div>
          </div>

          {/* Large Styled '404' Number */}
          <div className="relative mb-4 inline-flex flex-col items-center">
            <span className="select-none text-7xl font-black tracking-tight text-primary sm:text-8xl md:text-9xl leading-none">
              404
            </span>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3.5 py-1 text-xs font-bold text-primary">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
              <span>طريق مسدود / Dead End</span>
            </div>
          </div>

          {/* Bilingual Headings & Messages */}
          <div className="space-y-4">
            {/* Arabic Section */}
            <div dir="rtl" className="space-y-1.5">
              <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">
                الصفحة غير موجودة
              </h1>
              <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
                عذراً، يبدو أنك سلكت منعطفاً خاطئاً أو أن الصفحة التي تبحث عنها قد تم نقلها أو حذفها من سوق السيارات.
              </p>
            </div>

            {/* Visual Divider */}
            <div className="relative py-2" aria-hidden="true">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  or
                </span>
              </div>
            </div>

            {/* English Section */}
            <div dir="ltr" className="space-y-1.5">
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                Page Not Found
              </h2>
              <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
                Sorry, the page you are looking for doesn&apos;t exist, has been moved, or the automotive listing has expired.
              </p>
            </div>
          </div>

          {/* Action Links to Arabic and English Homepages */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/ar"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary-dark hover:shadow-brand active:scale-[0.98] sm:w-auto"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>العودة للرئيسية (عربي)</span>
            </Link>

            <Link
              href="/en"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-card px-6 py-3.5 text-sm font-bold text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.98] sm:w-auto"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Go to Homepage (English)</span>
            </Link>
          </div>

          {/* Quick Automotive Links */}
          <div className="mt-8 border-t border-border pt-6">
            <p className="mb-3 text-xs font-semibold text-muted-foreground">
              روابط سريعة لتصفح السوق / Popular Sections:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium">
              <Link
                href="/ar/search"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/50 px-3 py-1.5 text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <span>بحث السيارات / Search Cars</span>
              </Link>
              <Link
                href="/ar/dealers"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/50 px-3 py-1.5 text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
                <span>معارض السيارات / Dealerships</span>
              </Link>
              <Link
                href="/ar/catalogue/makes"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-muted/50 px-3 py-1.5 text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                </svg>
                <span>دليل السيارات / Car Guide</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
          <p className="font-medium">
            عربيات مارت — سوق السيارات الموثوق في مصر • Arabiyatmart
          </p>
          <p>© Arabiyatmart. All rights reserved.</p>
        </div>
      </footer>
      </body>
    </html>
  );
}
