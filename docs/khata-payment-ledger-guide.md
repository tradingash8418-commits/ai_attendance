# 📒 Contractor AI - Khata & Payment Ledger System Documentation

Contractor AI ka **Khata & Payment Ledger System** construction sites par workers ke daily advances (kharcha), weekly wage settlements, aur real-time Hajri calculations ko automatically maintain karta hai.

---

## 1. 💾 Ledger Kaha Save Hota Hai?

Ledger data **Google Cloud Firestore Database** mein `paymentLedger` collection ke andar permanent securely store hota hai.

- **Database Engine**: Firebase Cloud Firestore (NoSQL, Real-Time Cloud Sync)
- **Primary Collection**: `paymentLedger`
- **Related Collections**:
  - `workers`: Worker master data (Name, Phone, Worker Code, Role, Face Photo)
  - `attendanceRecords`: Daily check-in/check-out and Hajri units (1.0 Hajri, 0.5 Half-day, 1.5 Overtime)
  - `sites`: Construction project locations

---

## 2. 📋 Ledger Mein Kya-Kya Fields Maintain Hoti Hain?

Har payment entry mein complete audit trail maintain hota hai:

| Field Name | Data Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Unique Firestore Document ID | `pay_9a8f7c2b` |
| `workerId` | `string` | Firestore worker document reference | `wrk_abhay_006` |
| `workerName` | `string` | Worker ka full registered name | `Abhay Sharma` / `Mubarak` |
| `workerCode` | `string` | Unique Worker ID Code | `WRK-006` |
| `workerPhone` | `string` | Worker ka WhatsApp / UPI phone number | `+917304397048` |
| `siteId` | `string` | Jis construction site par kharcha hua | `site_metro_line4` |
| `siteName` | `string` | Site ka readable naam | `Metro Line 4 - Gate 1` |
| `amount` | `number` | Payment amount in Indian Rupees (₹) | `460.00` |
| `category` | `string` | Payment type: `advance`, `wage`, `bonus`, `deduction`, `kharcha` | `advance` |
| `paymentMethod` | `string` | `gpay`, `phonepe`, `paytm`, `upi`, `cash`, `bank_transfer` | `gpay` |
| `upiId` | `string` | Worker ki UPI ID | `7304397048@yespop` |
| `transactionRef`| `string` | Bank / UPI UTR / Transaction ID | `624838634812` |
| `paymentDate` | `string` | Payment ki date (`YYYY-MM-DD`) | `2026-09-04` |
| `paymentTime` | `string` | Payment ka exact time | `05:41 PM` |
| `receiptPhotoUrl`| `string`| GPay / PhonePe screenshot ya receipt bill photo | `https://.../receipt.jpg` |
| `notes` | `string` | Contractor ka optional note / reason | `Diye the kharche ke liye` |
| `recordedBy` | `string` | Source: `ai_screenshot_ocr`, `whatsapp_bot`, `admin_dashboard` | `ai_screenshot_ocr` |
| `rawOcrText` | `string` | Screenshot se nikla raw text (for audit proof) | `Paid to MUBARAK ₹460.00...` |
| `createdAt` | `Timestamp`| Entry create hone ka exact server time | `2026-09-04T17:41:00Z` |

---

## 3. 🧮 Automatic Khata & Balance Formula

Dashboard (`/payments`) par real-time auto-calculation hoti hai:

```text
1. Total Hajri Earned = Sum of all verified check-ins (1.0, 0.5, 1.5)
2. Total Wages Earned = Total Hajri × Daily Wage Rate (e.g. ₹500/day)
3. Total Advances Given = Sum of all 'advance' + 'kharcha' entries
4. Net Payable Balance = Total Wages Earned - Total Advances Given
```

### Example:
- Worker **Mubarak** ne **10 Din** kaam kiya $\rightarrow$ **10 Hajri**
- Daily Rate = **₹500 / Day**
- Total Earned Wages = $10 \times 500 = \text{₹5,000}$
- GPay se diya gaya Advance = **₹460 + ₹1,000 = ₹1,460**
- **Net Remaining Payable = ₹5,000 - ₹1,460 = ₹3,540** (Contractor ko worker ko dena baaki hai).

---

## 4. 🚀 3 Tareeke Se Ledger Entry Kaise Hoti Hai?

### Tareeka 1: WhatsApp Bot par Screenshot Forward Karke
- Contractor ya supervisor Google Pay / PhonePe ka screenshot WhatsApp bot number par bhejte hain.
- AI OCR instant amount (`₹460`) aur recipient name/phone nikal kar `paymentLedger` mein save kar deta hai.
- Bot WhatsApp par confirmation receipt bhej deta hai.

### Tareeka 2: Web Dashboard AI OCR Scanner (`/payments`)
- Admin dashboard ke **"Scan GPay / UPI Bill"** tab par image drop karte hain.
- Screen par instant preview aata hai, worker select karke **"Confirm & Record"** dabate hi Firestore update ho jata hai.

### Tareeka 3: Manual Direct Entry (`+ Log Payment / Advance`)
- Agar cash ya direct bank transfer kiya hai, to modal open karke Worker select karke amount enter karke save kar sakte hain.

---

## 5. 🔒 Data Safety & Backup

- **Real-Time Sync**: Firestore multi-region servers par live sync rehta hai.
- **Audit Proof**: Original payment screenshot aur OCR text hamesha record ke sath attached rehti hai, jisse koi dispute nahi ho sakta.
