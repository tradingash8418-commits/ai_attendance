import { PaymentLedgerService } from './payment-ledger.service';
import { SitesService } from './sites.service';
import type { PaymentLedgerEntry } from '@/types/payment';

export interface VendorSummary {
  id: string; // URL-safe identifier
  name: string;
  category: 'material' | 'thekedar' | 'transport' | 'service' | 'general';
  totalPaid: number;
  billsCount: number;
  latestPaymentDate: string;
  latestPaymentTime?: string;
  upiId?: string;
  paymentMethod?: string;
  notes?: string;
  recentPayments: PaymentLedgerEntry[];
  allPayments: PaymentLedgerEntry[];
  sitesInvolved: Array<{
    siteId: string;
    siteName: string;
    amount: number;
    count: number;
  }>;
}

export class VendorsService {
  /**
   * Automatically aggregates all unique vendors and suppliers from the Khata Payment Ledger.
   */
  public static async getVendorsSummary(dateRange?: { startDate?: string; endDate?: string }): Promise<{
    vendors: VendorSummary[];
    totalVendorPaidAll: number;
    totalBillsAll: number;
  }> {
    const [allPayments, allSites] = await Promise.all([
      PaymentLedgerService.getPayments(),
      SitesService.getSites(),
    ]);

    const siteMap = new Map<string, string>();
    allSites.forEach((s) => siteMap.set(s.id, s.name));

    // Filter payments categorized as 'vendor'
    let vendorPayments = allPayments.filter((p) => p.category === 'vendor');

    if (dateRange?.startDate) {
      vendorPayments = vendorPayments.filter((p) => (p.paymentDate || '') >= dateRange.startDate!);
    }
    if (dateRange?.endDate) {
      vendorPayments = vendorPayments.filter((p) => (p.paymentDate || '') <= dateRange.endDate!);
    }

    // Group payments by Vendor Entity Name (case-insensitive)
    const grouped: Record<string, PaymentLedgerEntry[]> = {};

    for (const p of vendorPayments) {
      const rawName = (p.paidTo || p.notes || 'Vendor / Material Supplier').trim();
      const normalizedKey = rawName.toUpperCase();

      if (!grouped[normalizedKey]) {
        grouped[normalizedKey] = [];
      }
      grouped[normalizedKey].push(p);
    }

    let totalVendorPaidAll = 0;
    let totalBillsAll = 0;

    const vendors: VendorSummary[] = Object.entries(grouped).map(([key, payments]) => {
      // Sort payments newest first
      payments.sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));

      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const billsCount = payments.length;
      totalVendorPaidAll += totalPaid;
      totalBillsAll += billsCount;

      const latest = payments[0];
      const displayName = latest.paidTo || key;

      // Classify vendor category based on name keywords
      const lower = displayName.toLowerCase();
      let category: 'material' | 'thekedar' | 'transport' | 'service' | 'general' = 'general';

      if (lower.includes('cement') || lower.includes('steel') || lower.includes('sand') || lower.includes('ret') || lower.includes('hardware') || lower.includes('trader') || lower.includes('supplier') || lower.includes('paint') || lower.includes('electric') || lower.includes('shop') || lower.includes('store')) {
        category = 'material';
      } else if (lower.includes('thekedar') || lower.includes('contractor') || lower.includes('fabricator') || lower.includes('plumber') || lower.includes('carpenter')) {
        category = 'thekedar';
      } else if (lower.includes('transport') || lower.includes('tempo') || lower.includes('truck') || lower.includes('dumper') || lower.includes('driver')) {
        category = 'transport';
      } else if (lower.includes('diesel') || lower.includes('petrol') || lower.includes('rent') || lower.includes('repair')) {
        category = 'service';
      }

      // Group by site
      const siteGroup: Record<string, { amount: number; count: number }> = {};
      payments.forEach((p) => {
        const sId = p.siteId || 'unassigned';
        if (!siteGroup[sId]) {
          siteGroup[sId] = { amount: 0, count: 0 };
        }
        siteGroup[sId].amount += p.amount;
        siteGroup[sId].count += 1;
      });

      const sitesInvolved = Object.entries(siteGroup).map(([sId, data]) => ({
        siteId: sId,
        siteName: siteMap.get(sId) || (sId === 'unassigned' ? 'Headquarters / General Site' : `Site #${sId.slice(0, 6)}`),
        amount: data.amount,
        count: data.count,
      }));

      // Create URL-safe ID
      const safeId = encodeURIComponent(displayName.toLowerCase().replace(/\s+/g, '-'));

      return {
        id: safeId,
        name: displayName,
        category,
        totalPaid,
        billsCount,
        latestPaymentDate: latest.paymentDate || 'Recorded',
        latestPaymentTime: latest.paymentTime,
        upiId: latest.upiId,
        paymentMethod: latest.paymentMethod,
        notes: latest.notes,
        recentPayments: payments.slice(0, 5),
        allPayments: payments,
        sitesInvolved,
      };
    });

    // Sort vendors by total paid descending
    vendors.sort((a, b) => b.totalPaid - a.totalPaid);

    return {
      vendors,
      totalVendorPaidAll,
      totalBillsAll,
    };
  }

  /**
   * Retrieves a single vendor profile by URL id or entity name.
   */
  public static async getVendorById(idOrName: string): Promise<VendorSummary | null> {
    const { vendors } = await this.getVendorsSummary();
    const decoded = decodeURIComponent(idOrName).toLowerCase().replace(/-/g, ' ').trim();

    return (
      vendors.find(
        (v) =>
          v.id === idOrName ||
          v.name.toLowerCase().trim() === decoded ||
          encodeURIComponent(v.name.toLowerCase().replace(/\s+/g, '-')) === idOrName
      ) || null
    );
  }
}
