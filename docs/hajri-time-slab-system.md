# Contractor AI - Continuous Time-Slab Hajri System Documentation 📊

Comprehensive technical design, business logic rules, time tables, single-record lifecycle, and walkthrough documentation for the **Time-Range Based Hajri System**.

---

## 📌 1. Executive Summary & Business Intent

In construction site workforce management, **Hajri (Daily Work Shift Unit)** is strictly determined by the **time-of-day** when workers finish their shift and checkout photos are submitted, rather than dividing total worked minutes/hours.

### Key Rules Enforced:
1. **Authoritative Timestamp**: Uses the actual WhatsApp message received timestamp (`messageObj.timestamp` converted to IST).
2. **Timezone**: All business-time calculations use **`Asia/Kolkata`** (UTC+05:30).
3. **No Duration Division**: `workedMinutes` and `workedHours` are calculated and stored **purely for informational display**. They NEVER calculate or alter Hajri values.
4. **Overnight Shifts**: Overnight shift checkouts (e.g. 01:20 AM or 03:10 AM on the next calendar day following a 10:00 AM check-in) are matched seamlessly across calendar day boundaries.
5. **Strict Unmatched State**: If a checkout photo timestamp falls after 03:30:59 AM Next Day, the system returns `status: "unmatched"`, `hajri: null`, `label: "Unmatched Checkout Time"`. The system **NEVER** guesses or fabricates Hajri values.

---

## ⏰ 2. Complete Hajri Time Slabs Table (`Asia/Kolkata` IST)

Standard Workday Base Check-in: **10:00 AM IST**

| Rule ID | Rule Name | Display Label | Hajri Value | Start Time (IST) | End Time (IST) | Relative Day | Exact Slab Window |
|---|---|---|---|---|---|---|---|
| `rule_normal` | `Normal` | **Normal** | **1.0** | `10:00:00` (10:00 AM) | `19:29:59` (07:29:59 PM) | `same_day` | `10:00:00 AM` through `07:29:59 PM` IST |
| `rule_dedhi` | `Dedhi` | **Dedhi** | **1.5** | `19:30:00` (07:30 PM) | `21:29:59` (09:29:59 PM) | `same_day` | `07:30:00 PM` through `09:29:59 PM` IST |
| `rule_double` | `Double` | **Double** | **2.0** | `21:30:00` (09:30 PM) | `00:59:59` (12:59:59 AM) | `same_day / next_day` | `09:30:00 PM` Same Day to `12:59:59 AM` Next Day IST |
| `rule_dhai` | `Dhai` | **Dhai** | **2.5** | `01:00:00` (01:00 AM) | `02:29:59` (02:29:59 AM) | `next_day` (+1) | `01:00:00 AM` through `02:29:59 AM` IST Next Day |
| `rule_three` | `Three` | **Three Hajri** | **3.0** | `02:30:00` (02:30 AM) | `03:30:59` (03:30:59 AM) | `next_day` (+1) | `02:30:00 AM` through `03:30:59 AM` IST Next Day |
| `unmatched` | `Unmatched` | **Unmatched** | **null** | After `03:30:59 AM` | Next Day | `next_day` | Any timestamp after `03:30:59 AM` Next Day |

---

## 🔄 3. Single Worker Attendance Record Lifecycle

The system enforces exactly **1 attendance record per `(workerId, siteId, workDate)`**:

### First Recognized Photo (Check-In)
* Creates the single worker attendance document in Firestore `attendanceRecords`.
* Sets `checkInTime` to the authoritative timestamp (e.g. 10:00 AM).
* Sets `checkOutTime` initially equal to `checkInTime`.

### Subsequent Recognized Photos (Check-Out Updates)
* Queries existing document for `(workerId, siteId, workDate)`.
* **Latest valid timestamp wins**: Updates `checkOutTime` to the new timestamp.
* Updates `attendancePhotoUrl` to the latest photo.
* Evaluates `HajriCalculatorService` and updates `hajri`, `hajriLabel`, `ruleName`, `workedMinutes`, and `workedHours`.
* **Zero Duplicate Records**: Prevents creating multiple documents for the same worker on the same work-date.

---

## 📁 4. Architecture & File Mapping

```text
frontend/
├── config/
│   └── hajri-rules.config.ts           # Central Hajri time slabs & timezone configuration
├── services/
│   ├── hajri-calculator.service.ts     # Time-of-day matching engine (Asia/Kolkata)
│   ├── attendance.service.ts           # Single-record lifecycle & Firestore persistence
│   ├── webhook-processor.server.ts     # Meta Webhook receiver & timestamp extraction
│   ├── whatsapp-feedback.server.ts     # Clean user-facing WhatsApp text report formatter
│   └── __tests__/
│       └── hajri-calculator.test.ts    # 16 Boundary case automated test suite
```

### Key Service Descriptions:

* **[`frontend/config/hajri-rules.config.ts`](file:///d:/face%20recognition%20attendence/frontend/config/hajri-rules.config.ts)**:
  Exports `TIMEZONE = 'Asia/Kolkata'`, `HAJRI_TIME_RANGES` array, and `UNMATCHED_HAJRI_STATE`.

* **[`frontend/services/hajri-calculator.service.ts`](file:///d:/face%20recognition%20attendence/frontend/services/hajri-calculator.service.ts)**:
  Method `calculateHajriFromCheckoutTimestamp(checkInDate, checkoutDate)` formats dates into IST components using `Intl.DateTimeFormat`, determines relative day offset (`same_day` vs `next_day`), and returns matching `HajriCalculationResult`.

* **[`frontend/services/whatsapp-feedback.server.ts`](file:///d:/face%20recognition%20attendence/frontend/services/whatsapp-feedback.server.ts)**:
  Formats clean text reports sent back to supervisor phone without internal IDs, face confidence scores, or technical AI details.

---

## 🧪 5. Boundary Matrix Test Suite (16 Test Cases)

Test File: [`frontend/services/__tests__/hajri-calculator.test.ts`](file:///d:/face%20recognition%20attendence/frontend/services/__tests__/hajri-calculator.test.ts)

| Test # | Checkout Timestamp (IST) | Expected Hajri | Display Label | Rule Name | Verification Result |
|---|---|---|---|---|---|
| 1 | `10:00:00 AM` (Same Day) | **1.0** | Normal | Normal | ✅ PASS |
| 2 | `05:00:00 PM` (Same Day) | **1.0** | Normal | Normal | ✅ PASS |
| 3 | `07:29:59 PM` (Same Day) | **1.0** | Normal | Normal | ✅ PASS |
| 4 | `07:30:00 PM` (Same Day) | **1.5** | Dedhi | Dedhi | ✅ PASS |
| 5 | `08:15:00 PM` (Same Day) | **1.5** | Dedhi | Dedhi | ✅ PASS |
| 6 | `09:29:59 PM` (Same Day) | **1.5** | Dedhi | Dedhi | ✅ PASS |
| 7 | `09:30:00 PM` (Same Day) | **2.0** | Double | Double | ✅ PASS |
| 8 | `10:30:00 PM` (Same Day) | **2.0** | Double | Double | ✅ PASS |
| 9 | `11:30:00 PM` (Same Day) | **2.0** | Double | Double | ✅ PASS |
| 10 | `12:59:59 AM` (Next Day) | **2.0** | Double | Double | ✅ PASS |
| 11 | `01:00:00 AM` (Next Day) | **2.5** | Dhai | Dhai | ✅ PASS |
| 12 | `01:30:00 AM` (Next Day) | **2.5** | Dhai | Dhai | ✅ PASS |
| 13 | `02:29:59 AM` (Next Day) | **2.5** | Dhai | Dhai | ✅ PASS |
| 14 | `02:30:00 AM` (Next Day) | **3.0** | Three Hajri | Three | ✅ PASS |
| 15 | `03:30:59 AM` (Next Day) | **3.0** | Three Hajri | Three | ✅ PASS |
| 16 | `03:31:00 AM` (Next Day) | **null** | Unmatched Checkout Time | Unmatched | ✅ PASS |

---

## 💬 6. Clean WhatsApp Feedback Report Sample

```text
Attendance Recorded ✅

Site: Site A (Andheri Commercial)
Date: 2026-09-03

1. Ramesh (#WRK-005)
   Check-in: 10:00 AM
   Check-out: 8:07 PM
   Worked: 10h 07m
   Hajri: 1.5 (Dedhi)

2. Pintu (#WRK-001)
   Check-in: 10:00 AM
   Check-out: 8:07 PM
   Worked: 10h 07m
   Hajri: 1.5 (Dedhi)

Total Present: 2
```

---

*Documentation Version: 2.0.0 | Contractor AI Workforce Management System*
