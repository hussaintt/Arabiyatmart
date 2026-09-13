'use client';

import * as React from 'react';
import { BarChart3, CreditCard } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { AppLocale } from '@/i18n/config';

interface DashboardViewTabsProps {
  overviewContent: React.ReactNode;
  billingContent: React.ReactNode;
  locale: AppLocale;
}

export function DashboardViewTabs({
  overviewContent,
  billingContent,
  locale,
}: DashboardViewTabsProps) {
  const ar = locale === 'ar';
  const [activeTab, setActiveTab] = React.useState('overview');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6" data-testid="dashboard-view-tabs">
      <TabsList className="grid w-full grid-cols-2 sm:w-80">
        <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-trigger-overview">
          <BarChart3 className="h-4 w-4" />
          <span>{ar ? 'أداء المتجر' : 'Performance'}</span>
        </TabsTrigger>
        <TabsTrigger value="billing" className="flex items-center gap-2" data-testid="tab-trigger-billing">
          <CreditCard className="h-4 w-4" />
          <span>{ar ? 'الحصص والاشتراك' : 'Quotas & Billing'}</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
        {overviewContent}
      </TabsContent>

      <TabsContent value="billing" className="space-y-6 focus-visible:outline-none">
        {billingContent}
      </TabsContent>
    </Tabs>
  );
}
