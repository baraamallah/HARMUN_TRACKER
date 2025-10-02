
import * as React from 'react';
import { getAllAnalyticsData } from '@/lib/actions';
import { AnalyticsClientPage } from '@/components/superior-admin/AnalyticsClientPage';

export default async function AnalyticsPage() {
  try {
    const analyticsData = await getAllAnalyticsData();
    return <AnalyticsClientPage initialData={analyticsData} />;
  } catch (error: any) {
    console.error("Failed to fetch analytics data for server component:", error);
    // You can return a dedicated error component here
    return <AnalyticsClientPage error={error.message} />;
  }
}
