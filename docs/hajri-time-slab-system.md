# Contractor AI - Worked Hours Duration Hajri System Documentation 📊

Comprehensive technical design, business logic rules, duration tables, single-record lifecycle, and walkthrough documentation for the **Worked Hours Duration-Based Hajri System**.

---

## 📌 1. Executive Summary & Business Intent

In construction site workforce management, **Hajri (Daily Work Shift Unit)** is strictly determined by the **total worked hours (duration)** between a worker's Check-In and Check-Out timestamp.

### Key Rules Enforced:
1. **Duration-Based Calculation**: Hajri is calculated directly from the elapsed duration between Check-In and Check-Out (`checkoutMs - checkInMs`).
2. **Late Check-in Protection**: Workers checking in late (e.g., evening) and checking out after a short duration will NOT receive full Hajri based on wall-clock checkout time; they must complete the required minimum worked hours.
3. **Minimum 8-Hour Requirement (Option B Rule)**: Any shift duration under **8.0 worked hours** yields **0.0 Hajri** (Short Shift).
4. **Timezone**: All timestamp conversions use **`Asia/Kolkata`** (UTC+05:30).
5. **Overnight Shifts**: Overnight shift checkouts (e.g. 01:00 AM or 03:30 AM on the next calendar day following a 10:00 AM check-in) calculate exact worked hours across calendar day boundaries.

---

## ⏰ 2. Complete Hajri Worked Hours Duration Table (Option B Rules)

| Rule ID | Rule Name | Display Label | Hajri Value | Worked Duration Range | Minimum Mandatory Hours | Example Shift (Check-In 10:00 AM) |
|---|---|---|---|---|---|---|
| `rule_short_shift` | `Short Shift` | **0.0 Hajri (Short Shift - Min 8 hrs Required)** | **0.0** | `0.0 hrs` to `< 8.0 hrs` | None (< 8.0 hrs) | 10:00 AM $\rightarrow$ 12:00 PM (2 hrs) / 5:59 PM (7.98 hrs) |
| `rule_normal` | `Normal` | **Normal (1.0 Hajri)** | **1.0** | `8.0 hrs` to `< 10.0 hrs` | **8.0 Hours** | 10:00 AM $\rightarrow$ 6:00 PM (8 hrs) / 7:00 PM (9 hrs) |
| `rule_dedhi` | `Dedhi` | **Dedhi (1.5 Hajri)** | **1.5** | `10.0 hrs` to `< 12.0 hrs` | **10.0 Hours** | 10:00 AM $\rightarrow$ 8:00 PM (10 hrs) / 9:00 PM (11 hrs) |
| `rule_double` | `Double` | **Double (2.0 Hajri)** | **2.0** | `12.0 hrs` to `< 15.0 hrs` | **12.0 Hours** | 10:00 AM $\rightarrow$ 10:00 PM (12 hrs) / 12:00 AM (14 hrs) |
| `rule_dhai` | `Dhai` | **Dhai (2.5 Hajri)** | **2.5** | `15.0 hrs` to `< 17.5 hrs` | **15.0 Hours** | 10:00 AM $\rightarrow$ 1:00 AM Next Day (15 hrs) |
| `rule_three` | `Three` | **Three (3.0 Hajri)** | **3.0** | `≥ 17.5 Worked Hours` | **17.5 Hours** | 10:00 AM $\rightarrow$ 3:30 AM Next Day (17.5 hrs) |

---

## ⏱️ 3. Worked Hours Time Slab Breakdown & Examples

### 1. Short Shift (< 8.0 Hours) $\rightarrow$ **0.0 Hajri**
- **Condition**: Worked duration is less than 8.0 hours.
- **Rule**: Option B strictly requires a minimum of 8.0 hours for 1.0 Hajri.
- **Example A**: Check-In 10:00 AM $\rightarrow$ Check-Out 12:00 PM (2.0 hrs worked) $\rightarrow$ **0.0 Hajri**.
- **Example B (Late Check-in Protection)**: Check-In 6:00 PM $\rightarrow$ Check-Out 7:00 PM (1.0 hr worked) $\rightarrow$ **0.0 Hajri**.

### 2. Normal Shift (8.0 to < 10.0 Hours) $\rightarrow$ **1.0 Hajri**
- **Condition**: Worked duration is between 8.0 hours and 9.99 hours.
- **Example A**: Check-In 10:00 AM $\rightarrow$ Check-Out 6:00 PM (8.0 hrs worked) $\rightarrow$ **1.0 Hajri**.
- **Example B**: Check-In 10:00 AM $\rightarrow$ Check-Out 7:00 PM (9.0 hrs worked) $\rightarrow$ **1.0 Hajri**.

### 3. Dedhi Shift (10.0 to < 12.0 Hours) $\rightarrow$ **1.5 Hajri**
- **Condition**: Worked duration is between 10.0 hours and 11.99 hours.
- **Example A**: Check-In 10:00 AM $\rightarrow$ Check-Out 8:00 PM (10.0 hrs worked) $\rightarrow$ **1.5 Hajri**.
- **Example B**: Check-In 10:00 AM $\rightarrow$ Check-Out 9:00 PM (11.0 hrs worked) $\rightarrow$ **1.5 Hajri**.

### 4. Double Shift (12.0 to < 15.0 Hours) $\rightarrow$ **2.0 Hajri**
- **Condition**: Worked duration is between 12.0 hours and 14.99 hours.
- **Example A**: Check-In 10:00 AM $\rightarrow$ Check-Out 10:00 PM (12.0 hrs worked) $\rightarrow$ **2.0 Hajri**.
- **Example B**: Check-In 10:00 AM $\rightarrow$ Check-Out 12:00 AM Midnight (14.0 hrs worked) $\rightarrow$ **2.0 Hajri**.

### 5. Dhai Shift (15.0 to < 17.5 Hours) $\rightarrow$ **2.5 Hajri**
- **Condition**: Worked duration is between 15.0 hours and 17.49 hours.
- **Example**: Check-In 10:00 AM $\rightarrow$ Check-Out 1:00 AM Next Day (15.0 hrs worked) $\rightarrow$ **2.5 Hajri**.

### 6. Three Hajri Shift ($\ge$ 17.5 Hours) $\rightarrow$ **3.0 Hajri**
- **Condition**: Worked duration is 17.5 hours or more.
- **Example**: Check-In 10:00 AM $\rightarrow$ Check-Out 3:30 AM Next Day (17.5 hrs worked) $\rightarrow$ **3.0 Hajri**.

---

## 🔄 4. Single Worker Attendance Record Lifecycle

The system enforces exactly **1 attendance record per `(workerId, siteId, workDate)`**:

### First Recognized Photo (Check-In)
* Creates the single worker attendance document in Firestore `attendanceRecords`.
* Sets `checkInTime` to the authoritative timestamp (e.g. 10:00 AM).
* Sets `checkOutTime` initially equal to `checkInTime`.

### Subsequent Recognized Photos (Check-Out Updates)
* Queries existing document for `(workerId, siteId, workDate)`.
* **Latest valid timestamp wins**: Updates `checkOutTime` to the new timestamp.
* Updates `attendancePhotoUrl` to the latest photo.
* Evaluates `HajriCalculatorService.calculateHajriFromCheckoutTimestamp(checkInDate, checkoutDate)` based on elapsed worked duration.
* Updates `hajri`, `hajriLabel`, `ruleName`, `workedMinutes`, and `workedHours`.
* **Zero Duplicate Records**: Prevents creating multiple documents for the same worker on the same work-date.

---

## 📁 5. Architecture & File Mapping

```text
frontend/
├── config/
│   └── hajri-rules.config.ts           # Central HAJRI_DURATION_RULES array & timezone configuration
├── services/
│   ├── hajri-calculator.service.ts     # Worked-hours duration calculation engine
│   ├── attendance.service.ts           # Single-record lifecycle & Firestore persistence
│   ├── webhook-processor.server.ts     # Meta Webhook receiver & timestamp extraction
│   ├── whatsapp-feedback.server.ts     # Clean user-facing WhatsApp text report formatter
│   └── __tests__/
│       └── hajri-calculator.test.ts    # Worked-hours duration boundary test suite
```

### Key Service Descriptions:

* **[`frontend/config/hajri-rules.config.ts`](file:///d:/face%20recognition%20attendence/frontend/config/hajri-rules.config.ts)**:
  Exports `TIMEZONE = 'Asia/Kolkata'`, `HAJRI_DURATION_RULES` array, and `UNMATCHED_HAJRI_STATE`.

* **[`frontend/services/hajri-calculator.service.ts`](file:///d:/face%20recognition%20attendence/frontend/services/hajri-calculator.service.ts)**:
  Method `calculateHajriFromCheckoutTimestamp(checkInDate, checkoutDate)` calculates total worked minutes/hours, matches against `HAJRI_DURATION_RULES` descending order of `minHours`, and returns matching `HajriCalculationResult`.

* **[`frontend/services/whatsapp-feedback.server.ts`](file:///d:/face%20recognition%20attendence/frontend/services/whatsapp-feedback.server.ts)**:
  Formats clean text reports sent back to supervisor phone without internal IDs, face confidence scores, or technical AI details.

---

## 🧪 6. Duration Matrix Test Suite

Test File: [`frontend/services/__tests__/hajri-calculator.test.ts`](file:///d:/face%20recognition%20attendence/frontend/services/__tests__/hajri-calculator.test.ts)

| Test # | Check-In Time | Check-Out Time | Worked Hours | Expected Hajri | Display Label | Rule Name | Verification |
|---|---|---|---|---|---|---|---|
| 1 | `10:00 AM` | `12:00 PM` | 2.0 hrs | **0.0** | 0.0 Hajri (Short Shift) | Short Shift | ✅ PASS |
| 2 | `10:00 AM` | `05:59 PM` | 7.98 hrs | **0.0** | 0.0 Hajri (Short Shift) | Short Shift | ✅ PASS |
| 3 | `10:00 AM` | `06:00 PM` | 8.0 hrs | **1.0** | Normal (1.0 Hajri) | Normal | ✅ PASS |
| 4 | `10:00 AM` | `07:00 PM` | 9.0 hrs | **1.0** | Normal (1.0 Hajri) | Normal | ✅ PASS |
| 5 | `10:00 AM` | `08:00 PM` | 10.0 hrs | **1.5** | Dedhi (1.5 Hajri) | Dedhi | ✅ PASS |
| 6 | `10:00 AM` | `09:00 PM` | 11.0 hrs | **1.5** | Dedhi (1.5 Hajri) | Dedhi | ✅ PASS |
| 7 | `10:00 AM` | `10:00 PM` | 12.0 hrs | **2.0** | Double (2.0 Hajri) | Double | ✅ PASS |
| 8 | `10:00 AM` | `01:00 AM` (+1) | 15.0 hrs | **2.5** | Dhai (2.5 Hajri) | Dhai | ✅ PASS |
| 9 | `10:00 AM` | `03:30 AM` (+1) | 17.5 hrs | **3.0** | Three (3.0 Hajri) | Three | ✅ PASS |
| 10 | `06:00 PM` | `07:00 PM` | 1.0 hr | **0.0** | 0.0 Hajri (Short Shift) | Short Shift | ✅ PASS |

---

## 💬 7. Clean WhatsApp Feedback Report Sample

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
   Check-in: 6:00 PM
   Check-out: 7:00 PM
   Worked: 1h 00m
   Hajri: 0.0 (Short Shift - Min 8 hrs Required)

Total Present: 2
```

---

*Documentation Version: 3.0.0 | Contractor AI Workforce Management System*
