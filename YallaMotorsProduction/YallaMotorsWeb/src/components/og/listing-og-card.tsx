import * as React from 'react';

export interface ListingOgCardProps {
  isArabic: boolean;
  title: string;
  priceFormatted: string;
  year: number;
  condition: string;
  mileageFormatted: string;
  transmission: string;
  fuelType: string;
  cityName: string;
  isVerified?: boolean;
  vendorName?: string | null;
  coverImageBase64?: string | null;
}

export function ListingOgCard({
  isArabic,
  title,
  priceFormatted,
  year,
  condition,
  mileageFormatted,
  transmission,
  fuelType,
  cityName,
  isVerified = false,
  vendorName,
  coverImageBase64,
}: ListingOgCardProps) {
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
        padding: '40px 48px',
        boxSizing: 'border-box',
        justifyContent: 'space-between',
        direction: isArabic ? 'rtl' : 'ltr',
      }}
    >
      {/* Top Header */}
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
              display: 'flex',
              backgroundColor: '#2563EB',
              borderRadius: '12px',
              width: '42px',
              height: '42px',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '22px',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
            }}
          >
            ع
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isArabic ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: '26px',
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.5px',
                lineHeight: 1.1,
              }}
            >
              {isArabic ? 'عربيات مارت' : 'Arabiyatmart'}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: '13px',
                fontWeight: 400,
                color: '#94A3B8',
                marginTop: '2px',
              }}
            >
              {isArabic ? 'سوق السيارات الأول في مصر' : 'Egypt Automotive Marketplace'}
            </div>
          </div>
        </div>

        {isVerified ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '999px',
              padding: '6px 16px',
              color: '#34D399',
              fontSize: '14px',
              fontWeight: 600,
              gap: '8px',
              flexDirection: isArabic ? 'row-reverse' : 'row',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#34D399"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{isArabic ? 'إعلان موثق' : 'Verified Listing'}</span>
          </div>
        ) : null}
      </div>

      {/* Center Hero & Specs */}
      <div
        style={{
          display: 'flex',
          flexDirection: isArabic ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          gap: '36px',
          flex: 1,
          margin: '20px 0',
        }}
      >
        {/* Information Panel */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            gap: '14px',
            alignItems: isArabic ? 'flex-end' : 'flex-start',
          }}
        >
          {/* Pills row */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              flexDirection: isArabic ? 'row-reverse' : 'row',
            }}
          >
            <div
              style={{
                display: 'flex',
                backgroundColor: '#1E293B',
                color: '#38BDF8',
                border: '1px solid #334155',
                padding: '4px 14px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {year}
            </div>
            <div
              style={{
                display: 'flex',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#E2E8F0',
                padding: '4px 14px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {condition}
            </div>
            {vendorName ? (
              <div
                style={{
                  display: 'flex',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#FBBF24',
                  padding: '4px 14px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                {vendorName}
              </div>
            ) : null}
          </div>

          {/* Car Title */}
          <div
            style={{
              display: 'flex',
              fontSize: '34px',
              fontWeight: 700,
              lineHeight: 1.25,
              color: '#FFFFFF',
              maxHeight: '86px',
              overflow: 'hidden',
              textAlign: isArabic ? 'right' : 'left',
            }}
          >
            {title}
          </div>

          {/* Price Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: '38px',
                fontWeight: 700,
                color: '#10B981',
                letterSpacing: '-0.5px',
              }}
            >
              {priceFormatted}
            </div>
          </div>

          {/* 4 Key Specs */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              marginTop: '4px',
              flexDirection: isArabic ? 'row-reverse' : 'row',
            }}
          >
            {/* Mileage */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#E2E8F0',
                flexDirection: isArabic ? 'row-reverse' : 'row',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 14l4-4" />
                <path d="M3.34 18a10 10 0 1 1 17.32 0" />
              </svg>
              <span>{mileageFormatted}</span>
            </div>

            {/* Transmission */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#E2E8F0',
                flexDirection: isArabic ? 'row-reverse' : 'row',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>{transmission}</span>
            </div>

            {/* Fuel */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#E2E8F0',
                flexDirection: isArabic ? 'row-reverse' : 'row',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18" />
                <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5" />
                <path d="M3 9h10" />
              </svg>
              <span>{fuelType}</span>
            </div>

            {/* City */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#E2E8F0',
                flexDirection: isArabic ? 'row-reverse' : 'row',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{cityName}</span>
            </div>
          </div>
        </div>

        {/* Hero Image Container */}
        <div
          style={{
            width: '470px',
            height: '310px',
            borderRadius: '20px',
            backgroundColor: '#1E293B',
            border: '2px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.6)',
          }}
        >
          {coverImageBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImageBase64}
              alt={title}
              width="470"
              height="310"
              style={{
                objectFit: 'cover',
                width: '100%',
                height: '100%',
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                color: '#64748B',
              }}
            >
              <svg
                width="84"
                height="84"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748B"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                <circle cx="7" cy="17" r="2" />
                <path d="M9 17h6" />
                <circle cx="17" cy="17" r="2" />
              </svg>
              <span style={{ fontSize: '15px', color: '#94A3B8' }}>
                {isArabic ? 'عربيات مارت' : 'Arabiyatmart'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer */}
      <div
        style={{
          display: 'flex',
          flexDirection: isArabic ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          paddingTop: '16px',
          width: '100%',
          fontSize: '14px',
          color: '#94A3B8',
        }}
      >
        <div style={{ display: 'flex' }}>
          {isArabic
            ? 'تصفح تفاصيل الإعلان والصور والمواصفات الكاملة على الموقع'
            : 'View full listing details, specs, and photos on Arabiyatmart'}
        </div>
        <div
          style={{
            display: 'flex',
            color: '#38BDF8',
            fontWeight: 600,
            fontSize: '16px',
            letterSpacing: '0.5px',
          }}
        >
          arabiyatmart.com
        </div>
      </div>
    </div>
  );
}
