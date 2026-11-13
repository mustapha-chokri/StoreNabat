import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import {
  customers,
  landingPages,
  orderItems,
  orders,
  products,
} from '@/db/schema/tenant';
import { getRequestTenant, withTenantDb } from '@/core/tenancy/context';
import { requireAdmin } from '@/core/auth/admin-session';
import { errorResponse } from '@/core/http/api';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getRequestTenant();
    await requireAdmin(tenant, 'analytics.view');

    const sp = req.nextUrl.searchParams;
    const fromParam = sp.get('from');
    const toParam = sp.get('to');
    const statusFilter = sp.get('status') || '';
    const categoryIdFilter = sp.get('categoryId') || '';
    const productIdFilter = sp.get('productId') || '';

    const data = await withTenantDb(tenant, async (db) => {
      const orderConditions = [eq(orders.storeId, tenant.id)];
      if (fromParam) orderConditions.push(gte(orders.createdAt, new Date(fromParam)));
      if (toParam) orderConditions.push(lte(orders.createdAt, new Date(toParam)));
      if (statusFilter) orderConditions.push(eq(orders.orderStatus, statusFilter as never));

      const allOrders = await db
        .select()
        .from(orders)
        .where(and(...orderConditions))
        .orderBy(desc(orders.createdAt));

      let filteredOrders = allOrders;
      if (productIdFilter || categoryIdFilter) {
        const orderIds = allOrders.map((o) => o.id);
        if (orderIds.length > 0) {
          const itemRows = await db
            .select({
              orderId: orderItems.orderId,
              productId: orderItems.productId,
            })
            .from(orderItems)
            .where(eq(orderItems.storeId, tenant.id));

          let allowedProductIds = new Set<string>();
          if (productIdFilter) {
            allowedProductIds.add(productIdFilter);
          } else if (categoryIdFilter) {
            const catProds = await db
              .select({ id: products.id })
              .from(products)
              .where(
                and(eq(products.storeId, tenant.id), eq(products.categoryId, categoryIdFilter))
              );
            allowedProductIds = new Set(catProds.map((p) => p.id));
          }

          const matchingOrderIds = new Set(
            itemRows
              .filter((r) => r.productId && allowedProductIds.has(r.productId))
              .map((r) => r.orderId)
          );
          filteredOrders = allOrders.filter((o) => matchingOrderIds.has(o.id));
        }
      }

      const validRevenueOrders = filteredOrders.filter(
        (o) => !['CANCELLED', 'RETURNED', 'REFUNDED'].includes(o.orderStatus)
      );

      const totalRevenue = validRevenueOrders.reduce(
        (sum, o) => sum + Number(o.totalAmount),
        0
      );
      const totalOrders = filteredOrders.length;
      const pendingOrders = filteredOrders.filter((o) =>
        ['NEW', 'PENDING_WHATSAPP_CONFIRMATION'].includes(o.orderStatus)
      ).length;
      const confirmedOrders = filteredOrders.filter((o) =>
        ['CONFIRMED', 'PROCESSING', 'READY_FOR_SHIPPING', 'SHIPPED', 'OUT_FOR_DELIVERY'].includes(
          o.orderStatus
        )
      ).length;
      const deliveredOrders = filteredOrders.filter((o) => o.orderStatus === 'DELIVERED').length;
      const cancelledOrders = filteredOrders.filter((o) => o.orderStatus === 'CANCELLED').length;
      const aov = validRevenueOrders.length > 0 ? totalRevenue / validRevenueOrders.length : 0;

      // Landing page views vs orders conversion metric when tracking views exist
      const lpStats = await db
        .select({
          views: sql<number>`COALESCE(SUM(${landingPages.viewsCount}), 0)::int`,
          orders: sql<number>`COALESCE(SUM(${landingPages.ordersCount}), 0)::int`,
        })
        .from(landingPages)
        .where(eq(landingPages.storeId, tenant.id));

      const lpViews = lpStats[0]?.views || 0;
      const conversionRate = lpViews > 0 ? Number(((lpStats[0].orders / lpViews) * 100).toFixed(2)) : null;

      // Daily series for charts
      const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>();
      for (const o of filteredOrders) {
        const day = o.createdAt.toISOString().slice(0, 10);
        const cur = dailyMap.get(day) || { date: day, revenue: 0, orders: 0 };
        cur.orders += 1;
        if (!['CANCELLED', 'RETURNED', 'REFUNDED'].includes(o.orderStatus)) {
          cur.revenue = Number((cur.revenue + Number(o.totalAmount)).toFixed(2));
        }
        dailyMap.set(day, cur);
      }
      const salesChart = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      // Status distribution
      const statusCounts = new Map<string, number>();
      for (const o of filteredOrders) {
        statusCounts.set(o.orderStatus, (statusCounts.get(o.orderStatus) || 0) + 1);
      }
      const statusChart = Array.from(statusCounts.entries()).map(([status, count]) => ({
        status,
        count,
      }));

      // Best-selling & low-stock products
      const allProducts = await db
        .select()
        .from(products)
        .where(eq(products.storeId, tenant.id))
        .orderBy(desc(products.salesCount));

      const bestSellers = allProducts.slice(0, 6);
      const lowStockProducts = allProducts.filter(
        (p) => p.trackInventory && p.stockQuantity <= p.lowStockThreshold
      );

      // Recent customer activity
      const recentCustomers = await db
        .select()
        .from(customers)
        .where(eq(customers.storeId, tenant.id))
        .orderBy(desc(customers.updatedAt))
        .limit(8);

      return {
        kpis: {
          totalRevenue: Number(totalRevenue.toFixed(2)),
          totalOrders,
          pendingOrders,
          confirmedOrders,
          deliveredOrders,
          cancelledOrders,
          averageOrderValue: Number(aov.toFixed(2)),
          conversionRate,
        },
        salesChart,
        statusChart,
        bestSellers,
        lowStockProducts,
        recentOrders: filteredOrders.slice(0, 10),
        recentCustomers,
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}

