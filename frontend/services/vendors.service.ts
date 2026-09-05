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

const GENERIC_CATEGORY_KEYWORDS = new Set([
  'transport', 'material', 'thekedar', 'contractor', 'subcontractor', 'vendor',
  'expense', 'service', 'general', 'hardware', 'cement', 'tempo', 'truck', 'dumper', 'driver'
]);

function extractRealVendorName(p: PaymentLedgerEntry): string {
  let name = (p.paidTo || '').trim();
  const lower = name.toLowerCase();

  if (!name || GENERIC_CATEGORY_KEYWORDS.has(lower) || lower === 'vendor / payee' || lower === 'vendor / expense') {
    if (p.notes && p.notes.includes('A/C:')) {
      const acMatch = p.notes.match(/A\/C:\s*([^|()]+)/i);
      if (acMatch && acMatch[1].trim()) {
        const found = acMatch[1].trim();
        if (!GENERIC_CATEGORY_KEYWORDS.has(found.toLowerCase())) {
          return found;
        }
      }
    }
    if (p.notes && p.notes.includes('Remark:')) {
      const remMatch = p.notes.match(/Remark:\s*([^|()]+)/i);
      if (remMatch && remMatch[1].trim()) {
        const found = remMatch[1].trim();
        if (!GENERIC_CATEGORY_KEYWORDS.has(found.toLowerCase())) {
          return found;
        }
      }
    }
  }
  return name || 'Vendor / Material Supplier';
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
      const rawName = extractRealVendorName(p);
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
      const displayName = extractRealVendorName(latest) || key;

      // Collect all contextual text across all payments for this vendor:
      // (displayName, payment notes, WhatsApp captions, raw OCR receipt text)
      const allText = [
        displayName,
        ...payments.map((p) => `${p.notes || ''} ${p.rawOcrText || ''}`),
      ]
        .join(' ')
        .toLowerCase();

      let category: 'material' | 'thekedar' | 'transport' | 'service' | 'general' = 'material';

      // 1. Subcontractors / Thekedar keywords
      if (
        /\b(thekedar|contractor|subcontractor|fabricator|plumber|carpenter|mason|mistri|pop|civil)\b/i.test(allText)
      ) {
        category = 'thekedar';
      }
      // 2. Transport & Vehicles keywords
      else if (
        /\b(transport|tempo|truck|dumper|driver|diesel|petrol|vehicle|bhada|freight|auto|trolley|tractor|gaadi)\b/i.test(allText) ||
        /\bcaption:\s*(t|transport)\b/i.test(allText)
      ) {
        category = 'transport';
      }
      // 3. Service & Utility keywords
      else if (
        /\b(service|rent|repair|maintenance|electricity|generator|chai|khana)\b/i.test(allText)
      ) {
        category = 'service';
      }
      // 4. Default is Material & Hardware (all supplier, cement, steel, sand, hardware, general material shops)
      else {
        category = 'material';
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
