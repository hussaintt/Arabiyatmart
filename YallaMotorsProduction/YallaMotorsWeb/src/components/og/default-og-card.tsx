import * as React from 'react';

export interface DefaultOgCardProps {
  isArabic: boolean;
  title?: string;
  description?: string;
  backgroundImageUrl?: string;
}

export function DefaultOgCard({
  isArabic,
  title,
  description,
}: DefaultOgCardProps) {
  const displayTitle = title ?? (isArabic ? 'عربيات مارت - سوق السيارات في مصر' : 'Arabiyatmart - Automotive Marketplace in Egypt');
  const displayDescription = description ?? (isArabic ? 'أكبر سوق موثوق لبيع وشراء السيارات الجديدة والمستعملة في مصر' : "Egypt's premier trusted automotive marketplace for new and used cars");

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '1200px',
        height: '630px',
        backgroundColor: '#090D16',
        backgroundImage: 'radial-gradient(circle at 100% 0%, #1E293B 0%, #090D16 75%)',
        color: '#FFFFFF',
        fontFamily: 'Cairo, sans-serif',
        padding: '50px 60px',
        boxSizing: 'border-box',
        justifyContent: 'space-between',
        direction: isArabic ? 'rtl' : 'ltr',
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: isArabic ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            flexDirection: isArabic ? 'row-reverse' : 'row',
          }}
        >
          <div
            style={{
              backgroundColor: '#2563EB',
              borderRadius: '12px',
              width: '46px',
              height: '46px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '24px',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
            }}
          >
            ع
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: '28px',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.5px',
            }}
          >
            {isArabic ? 'عربيات مارت' : 'Arabiyatmart'}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '999px',
            padding: '6px 20px',
            color: '#38BDF8',
            fontSize: '15px',
            fontWeight: 600,
          }}
        >
          {isArabic ? 'سوق السيارات المعتمد في مصر' : 'Certified Egyptian Auto Marketplace'}
        </div>
      </div>

      {/* Center Hero */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isArabic ? 'flex-end' : 'flex-start',
          gap: '20px',
          maxWidth: '900px',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: '48px',
            fontWeight: 700,
            lineHeight: 1.2,
            color: '#FFFFFF',
            textAlign: isArabic ? 'right' : 'left',
          }}
        >
          {displayTitle}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: '24px',
            fontWeight: 400,
            lineHeight: 1.5,
            color: '#94A3B8',
            textAlign: isArabic ? 'right' : 'left',
          }}
        >
          {displayDescription}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          flexDirection: isArabic ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          paddingTop: '20px',
          width: '100%',
          fontSize: '16px',
          color: '#94A3B8',
        }}
      >
        <div style={{ display: 'flex', gap: '24px', flexDirection: isArabic ? 'row-reverse' : 'row' }}>
          <span>{isArabic ? '• سيارات جديدة ومستعملة' : '• New & Used Cars'}</span>
          <span>{isArabic ? '• فحص وضمان شامل' : '• Inspected & Certified'}</span>
          <span>{isArabic ? '• أكبر معارض مصر' : '• Top Egyptian Dealers'}</span>
        </div>
        <div
          style={{
            display: 'flex',
            color: '#38BDF8',
            fontWeight: 700,
            fontSize: '18px',
            letterSpacing: '0.5px',
          }}
        >
          arabiyatmart.com
        </div>
      </div>
    </div>
  );
}
