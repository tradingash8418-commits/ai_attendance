# 📱 Contractor AI - WhatsApp Commands & Captions Cheat Sheet

Is document mein WhatsApp par bheje jaane wale sabhi **Shortcodes, Captions, Keywords, Multi-Worker Split Rules, aur QR Tokens** ka detailed specification diya gaya hai. 

System in codes ko padhkar automatically classify karta hai ki receipt **Worker Advance Khata** mein jayegi, **Vendor / Material Ledger** mein jayegi, ya **Site Attendance** lagayegi.

---

## 📑 Quick Reference Table (Sabse Jyada Use Hone Wale Codes)

| Shortcode / Caption | Example Input | Classification Destination | System Action / Logic |
| :--- | :--- | :--- | :--- |
| **`w`** | `w` ya `worker` | 👷 **Worker Advance Khata** | Receipt ka pura amount **Worker Advance** mein record hoga. |
| **`v`** | `v` ya `vendor` | 🏢 **Vendor / Material Ledger** | Receipt ka pura amount **Vendor / Expense** mein record hoga. |
| **`[Worker Name], w`** | `pintu, w` ya `mubarak, w` | 👷 **Specific Worker Advance** | Strictly **Pintu / Mubarak** ke individual khate mein advance link hoga (Bhale hi payment unke patni ya bete ke account par gayi ho). |
| **`[Vendor Name], v`** | `UltraTech, v` ya `Sri Cements, m` | 🧱 **Material & Hardware Vendor** | **UltraTech / Sri Cements** ke vendor khate mein Material expense add hoga. |
| **`[Thekedar Name], v`** | `Manoj, thekedar` | 🔨 **Subcontractor / Thekedar** | Manoj Thekedar ke profile mein Subcontractor bill record hoga. |
| **`[Transport], v`** | `Raju Dumper, transport` | 🚚 **Transport & Vehicles** | Raju Dumper ke profile mein Transport / Gaadi Bhada record hoga. |
| **`Multi-Worker Split`** | `pintu: 2000 durgesh: 3000 mubarak: 6000` | 👥 **Multiple Worker Advance Split** | Ek hi screenshot (e.g. ₹11,000) se har worker ke khate mein unka individual advance (₹2000, ₹3000, ₹6000) strictly record hoga. |
| **`CHECKIN_[TOKEN]`** | `CHECKIN_CK_1725541234_ABC` | 📍 **1-Tap Site QR Attendance** | Worker Gate QR scan karne par bina selfie ke instant Present mark hota hai. |

---
* Agar aap **Material** likhenge ➔ Material & Hardware mein jayega.
* Agar aap **Transport** likhenge ➔ Transport & Vehicles mein jayega.
* Agar aap **Thekedar ya contractor** likhenge ➔ Subcontractors / Thekedar mein jayega.
* Agar aap w ya **Worker** likhenge ➔ Worker Advance Khata mein jayega.

## 🔍 Code Inspection & Deep-Dive Specification

---

### 1. 👷 Worker Khata Advance Codes (`w`, `worker`, `kharcha`)

#### 📌 Use Case:
Jab aap kisi worker / karigar / labour ko weekly kharcha, advance, ya payment dete hain aur chahte hain ki wo strictly **Worker Khata** mein jaye aur unke total hajri wage se deduct ho sake.

#### 📝 Accepted Keywords:
* `w`
* `worker`
* `a`
* `advance`
* `kharcha`
* `labour`
* `k`
* `karigar`
* `wage`
* `majdoor`

#### 💡 Syntax & Caption Variations:
1. **Single Category Tag (AI Auto-Match):**
   * Caption: `w`
   * *Kya hoga:* AI screenshot se receiver ka naam padhega aur Firestore ke registered worker se match karke Advance Khata mein daal dega.
2. **Specific Worker Remark (Family / Third-Party UPI Account Override):**
   * Caption: `pintu, w` ya `pintu - w` ya `pintu: w` ya `w pintu` ya `pintu advance`
   * *Kya hoga:* Agar payment Pintu ki patni ya kisi aur ke account par gayi hai, tab bhi ye **strictly Pintu** ke Worker Profile mein advance credit karega. Notes mein original account holder ka naam proof ke liye rahega.

---

### 2. 👥 Multi-Worker Batch Split Advance (`Name: Amount`)

#### 📌 Use Case:
Jab aap ek hi bank transfer ya GPay se ₹11,000 bhejte hain jisme multiple workers ka advance shamil hai (e.g. Pintu ka ₹2,000, Durgesh ka ₹3,000, Mubarak ka ₹6,000).

#### 📝 Supported Formats:
* **Space / Single Quotes separated:** `'pintu: 2000' 'durgesh: 3000' 'mubarak: 6000'`
* **Comma separated:** `pintu: 2000, durgesh: 3000, mubarak: 6000`
* **Plain space separated:** `pintu: 2000 durgesh: 3000 mubarak: 6000`
* **Equal / Dash separated:** `pintu = 2000, durgesh = 3000, mubarak = 6000`
* **Rupee Symbol / Suffix:** `pintu: ₹2000, durgesh: ₹3000, mubarak: 6000/-`
* **Multi-line formatted:**
  ```text
  pintu: 2000
  durgesh: 3000
  mubarak: 6000
  ```

#### ⚙️ System Processing:
1. System caption ko parse karke teeno workers (`pintu`, `durgesh`, `mubarak`) ko unke database profile se link karega.
2. Har worker ke liye individual `category: 'advance'` entry banegi.
3. Original ₹11,000 ka screenshot sabhi ke record ke sath attach rahega.
4. WhatsApp par confirmation summary breakdown message aayega.

---

### 3. 🏢 Vendor & Material Ledger Codes (`v`, `vendor`, `material`)

#### 📌 Use Case:
Jab aap kisi cement dukan, hardware store, dumper driver, ya thekedar ko payment bhejte hain aur chahte hain ki wo **Vendors Tab** mein classify ho (Labour khate se alag rahe).

#### 📝 Accepted Keywords:
* `v`
* `vendor`
* `m`
* `material`
* `supplier`
* `thekedar`
* `dukaan`
* `shop`
* `expense`

#### 🏷️ Automatic Category Classification Rules:

##### A. Material & Hardware
* **Keywords:** `cement`, `steel`, `sand`, `ret`, `bajri`, `hardware`, `paint`, `electric`, `shop`, `store`, `trader`, `supplier`, `m`, `material`.
* **Example:** `UltraTech, m` ya `sri hardware, v` ya `Asian Paints, material`
* **Destination:** `Vendors` ➔ Category: **Material & Hardware**.

##### B. Subcontractors & Thekedar
* **Keywords:** `thekedar`, `contractor`, `fabricator`, `plumber`, `carpenter`, `pop`, `subcontractor`.
* **Example:** `Manoj, thekedar` ya `Sharma Plumbing Contractor, v`
* **Destination:** `Vendors` ➔ Category: **Subcontractors / Thekedar**.

##### C. Transport & Vehicles
* **Keywords:** `transport`, `tempo`, `truck`, `dumper`, `driver`, `t`, `diesel`, `petrol`, `rent`, `vehicle`, `bhada`.
* **Example:** `Raju Dumper, transport` ya `Tempo bhada, v` ya `Diesel generator, v`
* **Destination:** `Vendors` ➔ Category: **Transport & Vehicles**.

##### D. General Vendor
* **Example:** `v` ya `sri traders, v`
* **Destination:** `Vendors` ➔ Category: **General Vendor / Expense**.

---

### 4. 📄 PDF Receipt Follow-Up Text Captions

#### 📌 Problem & Solution:
WhatsApp par jab koi PDF bill bheja jata hai, toh caption alag text message bankar jata hai.

#### ⚙️ How it works:
1. Aapne WhatsApp par PDF payment receipt bheji.
2. PDF aate hi turant text message bheja:
   * Example A: `pintu, w` ➔ Recent PDF Pintu ke Worker Advance mein link ho jayegi.
   * Example B: `Asian Paints, m` ➔ Recent PDF Asian Paints Material bill mein classify ho jayegi.
   * Example C: `pintu: 2000 durgesh: 3000` ➔ Recent PDF automatically split ho jayegi.

---

### 5. 📍 1-Tap Site Gate QR Attendance (`CHECKIN_...`)

#### 📌 Use Case:
Jab worker site ke entry gate par laga QR code apne phone se scan karta hai.

#### 📝 Code Format:
* `CHECKIN_CK_[TIMESTAMP]_[HASH]` (e.g. `CHECKIN_CK_1725541234_ABC987`)

#### ⚙️ How it works:
1. Worker WhatsApp par send karta hai.
2. System phone number se worker ko pehchanta hai.
3. GPS radius verify karke instant **Present (1.0 Hajri)** record karta hai.
4. Worker ko WhatsApp par instant confirmation report bhejta hai.

---

### 6. 📸 Supervisor Group Selfie Attendance

#### 📌 Use Case:
Jab supervisor site par sabhi workers ke sath group photo / selfie WhatsApp par bhejta hai.

#### 📝 Trigger:
* WhatsApp number supervisor directory mein registered hona chahiye.
* Photo bhejte hi **SFace Deep Neural AI Engine** sabhi faces ko ek sath recognize karke instant attendance lagata hai.

---

## 🎯 Summary Rules Checklist

1. **Worker Khata (Advance)** ➔ `w`, `worker`, `[Name], w`, ya `[Name: Amount]`
2. **Vendor Ledger (Material)** ➔ `v`, `m`, `[Name], v`, `[Name], material`
3. **Transport (Gaadi Bhada)** ➔ `[Name], transport`, `[Name], dumper`
4. **Thekedar (Contractor)** ➔ `[Name], thekedar`
5. **QR Attendance** ➔ `CHECKIN_...`

Is cheat sheet ko follow karke WhatsApp se construction site ka 100% attendance aur payment khata automated rahega!
