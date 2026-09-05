# 📱 Contractor AI - WhatsApp Commands & Captions Master Cheat Sheet

Is document mein WhatsApp par bheje jaane wale sabhi **Shortcodes, Captions, Keywords, Multi-Worker Split Rules, aur QR Tokens** ka detailed reference diya gaya hai.

System in codes ko padhkar automatically classify karta hai ki receipt **Worker Advance Khata** mein jayegi, **Vendor / Material Ledger** ke specific tab mein jayegi, ya **Site Attendance** lagayegi.

---

## 📑 1. Master Quick-Lookup Table

| Category / Purpose | Shortcodes | Real WhatsApp Caption Examples | Dashboard Tab / Location | System Action & Logic |
| :--- | :--- | :--- | :--- | :--- |
| 🧱 **Material & Hardware** | `m`, `v`, `material`, `cement`, `hardware` | `UltraTech, m`<br>`Asian Paints, material`<br>`Sri Cements, v`<br>`Ret Bajri, m`<br>`Hardware shop, v` | `/vendors` ➔ **Material & Hardware** | Supplier / Dukan ke profile mein Material bill add hoga. Material dashboard mein live aggregate hoga. |
| 🚚 **Transport & Vehicles** | `t`, `transport`, `tempo`, `dumper`, `diesel` | `Raju Dumper, transport`<br>`Tempo, t`<br>`Diesel generator, v`<br>`Gaadi bhada, transport` | `/vendors` ➔ **Transport & Vehicles** | Vehicle owner ya transport driver ke profile mein gaadi bhada / diesel record hoga. |
| 🔨 **Subcontractors & Thekedar** | `thekedar`, `contractor`, `subcontractor` | `Manoj, thekedar`<br>`Plumbing contractor, thekedar`<br>`POP mistri, contractor` | `/vendors` ➔ **Subcontractors / Thekedar** | Thekedar ke profile mein work order / advance bill record hoga. |
| 🏢 **General Vendor / Others** | `v`, `vendor`, `expense` | `v`<br>`vendor`<br>`Sharma ji, v` | `/vendors` ➔ **All Vendors / Material** | General expense ya unidentified vendor supply ledger mein record hoga. |
| 👷 **Worker Advance (Single)** | `w`, `worker`, `a`, `advance`, `kharcha` | `pintu, w`<br>`w pintu`<br>`mubarak, advance`<br>`durgesh kharcha` | `/workers/[id]` ➔ **Khata (Advance)** | Strictly worker ke individual profile mein kharcha judega (Bhale hi payment patni/bete ke UPI par gayi ho). |
| 👥 **Multi-Worker Split (Batch)** | `name: amount` | `pintu: 2000 durgesh: 3000 mubarak: 6000`<br>`pintu = 2000, durgesh = 3000`<br>`'pintu: 2000' 'durgesh: 3000'` | `/workers` ➔ **Sabhi Workers ke Individual Khate** | Ek hi screenshot (e.g. ₹11,000) se har worker ke khate mein unka hissa distribute hokar record hoga. |
| 📍 **Site QR Gate Check-in** | `CHECKIN_[TOKEN]` | `CHECKIN_CK_1725541234_ABC` | `/attendance` & `/workers/[id]` | Worker bina selfie ke gate QR scan karke 1-Tap Present (1.0 Hajri) mark karta hai. |
| 📸 **Supervisor Group Selfie** | Registered Supervisor No. | *(Direct Photo / Selfie without caption)* | `/attendance` & Live AI Diagnostics | SFace AI ek sath sabhi workers ke faces detect karke attendance lagata hai. |

---

## 🎯 2. Quick One-Line Decision Rules

* 🧱 **Agar aap `Material` ya `m` likhenge** ➔ `/vendors` ke **Material & Hardware** tab mein jayega.
* 🚚 **Agar aap `Transport` ya `t` likhenge** ➔ `/vendors` ke **Transport & Vehicles** tab mein jayega.
* 🔨 **Agar aap `Thekedar` ya `contractor` likhenge** ➔ `/vendors` ke **Subcontractors / Thekedar** tab mein jayega.
* 👷 **Agar aap `w` ya `Worker` ya `[Name], w` likhenge** ➔ Strictly **Worker Advance Khata** mein jayega.
* 👥 **Agar aap `Name: Amount Name: Amount` likhenge** ➔ Strictly har worker ke khate mein **Batch Advance Split** hoga.

---

## ⚡ 3. All Defined Caption Codes & Examples (Summary Directory)

Is table mein system mein defined **har ek caption code** aur uska exact caption example listed hai:

### A. 👷 Worker Advance Khata Codes

| Caption Code Keyword | Example WhatsApp Caption | Kya Hoga / Action |
| :--- | :--- | :--- |
| `w` | `w` | Auto-match worker by OCR & record advance |
| `worker` | `worker` | Auto-match worker by OCR & record advance |
| `a` | `a` | Auto-match worker by OCR & record advance |
| `advance` | `advance` | Auto-match worker by OCR & record advance |
| `kharcha` | `kharcha` | Auto-match worker by OCR & record advance |
| `labour` | `labour` | Auto-match worker by OCR & record advance |
| `k` | `k` | Auto-match worker by OCR & record advance |
| `karigar` | `karigar` | Auto-match worker by OCR & record advance |
| `wage` | `wage` | Auto-match worker by OCR & record advance |
| `majdoor` | `majdoor` | Auto-match worker by OCR & record advance |
| `[Worker Name], w` | `pintu, w` | Strictly **Pintu** ke khate mein advance link hoga |
| `[Worker Name], worker` | `mubarak, worker` | Strictly **Mubarak** ke khate mein advance link hoga |
| `[Worker Name], advance` | `durgesh, advance` | Strictly **Durgesh** ke khate mein advance link hoga |
| `[Worker Name], kharcha` | `pintu, kharcha` | Strictly **Pintu** ke khate mein advance link hoga |
| `[Worker Name], labour` | `ramesh, labour` | Strictly **Ramesh** ke khate mein advance link hoga |
| `[Worker Name], karigar` | `dinesh, karigar` | Strictly **Dinesh** ke khate mein advance link hoga |
| `[Worker Name] - w` | `pintu - w` | Dash format support |
| `[Worker Name]: w` | `pintu: w` | Colon format support |
| `[Worker Name] / w` | `pintu / w` | Slash format support |
| `w [Worker Name]` | `w pintu` | Leading tag format support |
| `worker [Worker Name]` | `worker mubarak` | Leading tag format support |
| `advance [Worker Name]` | `advance durgesh` | Leading tag format support |
| `kharcha [Worker Name]` | `kharcha pintu` | Leading tag format support |

---

### B. 👥 Multi-Worker Batch Split Formats

| Split Format Style | Example WhatsApp Caption | Kya Hoga / Action |
| :--- | :--- | :--- |
| **Space Separated** | `pintu: 2000 durgesh: 3000 mubarak: 6000` | 1 Receipt se teeno ke khate mein ₹2k, ₹3k, ₹6k alag-alag credit |
| **Comma Separated** | `pintu: 2000, durgesh: 3000, mubarak: 6000` | Comma separated multiple workers advance |
| **Quotes Enclosed** | `'pintu: 2000' 'durgesh: 3000' 'mubarak: 6000'` | Quotes ke sath batch distribution |
| **Equal Separator** | `pintu = 2000, durgesh = 3000` | Equal sign se split |
| **Dash Separator** | `pintu - 2000, durgesh - 3000` | Dash sign se split |
| **Rupee Symbol** | `pintu: ₹2000, durgesh: ₹3000` | Currency symbol ke sath parsing |
| **Only / Suffix** | `pintu: 2000/-, durgesh: 3000/-` | Hindi accounting suffix format |
| **Multi-line** | `pintu: 2000`<br>`durgesh: 3000`<br>`mubarak: 6000` | Newline separated multiple workers split |

---

### C. 🧱 Material & Hardware Codes

| Caption Code Keyword | Example WhatsApp Caption | Destination Tab in `/vendors` |
| :--- | :--- | :--- |
| `m` | `m` | **Material & Hardware** |
| `material` | `material` | **Material & Hardware** |
| `cement` | `cement` | **Material & Hardware** |
| `steel` | `steel` | **Material & Hardware** |
| `sand` | `sand` | **Material & Hardware** |
| `ret` | `ret` | **Material & Hardware** |
| `bajri` | `bajri` | **Material & Hardware** |
| `sariya` | `sariya` | **Material & Hardware** |
| `rodi` | `rodi` | **Material & Hardware** |
| `hardware` | `hardware` | **Material & Hardware** |
| `paint` | `paint` | **Material & Hardware** |
| `electric` | `electric` | **Material & Hardware** |
| `shop` | `shop` | **Material & Hardware** |
| `store` | `store` | **Material & Hardware** |
| `dukaan` | `dukaan` | **Material & Hardware** |
| `supplier` | `supplier` | **Material & Hardware** |
| `brick` | `brick` | **Material & Hardware** |
| `tiles` | `tiles` | **Material & Hardware** |
| `sanitary` | `sanitary` | **Material & Hardware** |
| `wood` | `wood` | **Material & Hardware** |
| `glass` | `glass` | **Material & Hardware** |
| `[Vendor], m` | `UltraTech, m` | **Material & Hardware** (UltraTech profile) |
| `[Vendor], material` | `Asian Paints, material` | **Material & Hardware** (Asian Paints profile) |
| `[Vendor], v` | `Sri Cements, v` | **Material & Hardware** (Sri Cements profile) |
| `[Vendor], hardware` | `National Hardware, hardware` | **Material & Hardware** (National Hardware profile) |
| `[Vendor], paint` | `Berger Paints, paint` | **Material & Hardware** (Berger Paints profile) |
| `[Vendor], electric` | `Havells Store, electric` | **Material & Hardware** (Havells Store profile) |
| `[Vendor], ret` | `Shyam Ret Supplier, ret` | **Material & Hardware** (Shyam Ret profile) |
| `[Vendor], bajri` | `Ganga Bajri, bajri` | **Material & Hardware** (Ganga Bajri profile) |
| `[Vendor], steel` | `Tata Tiscon, steel` | **Material & Hardware** (Tata Tiscon profile) |
| `m [Vendor]` | `m UltraTech` | **Material & Hardware** (Leading tag format) |
| `v [Vendor]` | `v Sri Cements` | **Material & Hardware** (Leading tag format) |

---

### D. 🚚 Transport & Vehicles Codes

| Caption Code Keyword | Example WhatsApp Caption | Destination Tab in `/vendors` |
| :--- | :--- | :--- |
| `t` | `t` | **Transport & Vehicles** |
| `transport` | `transport` | **Transport & Vehicles** |
| `tempo` | `tempo` | **Transport & Vehicles** |
| `truck` | `truck` | **Transport & Vehicles** |
| `dumper` | `dumper` | **Transport & Vehicles** |
| `driver` | `driver` | **Transport & Vehicles** |
| `gaadi` | `gaadi` | **Transport & Vehicles** |
| `bhada` | `bhada` | **Transport & Vehicles** |
| `diesel` | `diesel` | **Transport & Vehicles** |
| `petrol` | `petrol` | **Transport & Vehicles** |
| `freight` | `freight` | **Transport & Vehicles** |
| `tractor` | `tractor` | **Transport & Vehicles** |
| `trolley` | `trolley` | **Transport & Vehicles** |
| `auto` | `auto` | **Transport & Vehicles** |
| `[Name], t` | `Tempo, t` | **Transport & Vehicles** |
| `[Name], transport` | `Raju Dumper, transport` | **Transport & Vehicles** (Raju Dumper profile) |
| `[Name], tempo` | `Chotu, tempo` | **Transport & Vehicles** (Chotu profile) |
| `[Name], truck` | `Singh, truck` | **Transport & Vehicles** (Singh profile) |
| `[Name], dumper` | `Raju, dumper` | **Transport & Vehicles** (Raju profile) |
| `[Name], driver` | `Mukesh, driver` | **Transport & Vehicles** (Mukesh profile) |
| `[Name], gaadi` | `Site gaadi, gaadi` | **Transport & Vehicles** |
| `[Name], bhada` | `Ret gaadi bhada, bhada` | **Transport & Vehicles** |
| `[Name], diesel` | `Generator diesel, diesel` | **Transport & Vehicles** |
| `[Name], petrol` | `Site bike petrol, petrol` | **Transport & Vehicles** |
| `[Name], tractor` | `Tractor ret, tractor` | **Transport & Vehicles** |
| `t [Name]` | `t Raju Dumper` | **Transport & Vehicles** (Leading tag format) |
| `transport [Name]` | `transport Raju Dumper` | **Transport & Vehicles** (Leading tag format) |

---

### E. 🔨 Subcontractors & Thekedar Codes

| Caption Code Keyword | Example WhatsApp Caption | Destination Tab in `/vendors` |
| :--- | :--- | :--- |
| `thekedar` | `thekedar` | **Subcontractors / Thekedar** |
| `contractor` | `contractor` | **Subcontractors / Thekedar** |
| `subcontractor` | `subcontractor` | **Subcontractors / Thekedar** |
| `fabricator` | `fabricator` | **Subcontractors / Thekedar** |
| `plumber` | `plumber` | **Subcontractors / Thekedar** |
| `carpenter` | `carpenter` | **Subcontractors / Thekedar** |
| `mason` | `mason` | **Subcontractors / Thekedar** |
| `mistri` | `mistri` | **Subcontractors / Thekedar** |
| `pop` | `pop` | **Subcontractors / Thekedar** |
| `civil` | `civil` | **Subcontractors / Thekedar** |
| `[Name], thekedar` | `Manoj, thekedar` | **Subcontractors / Thekedar** (Manoj profile) |
| `[Name], contractor` | `Sharma, contractor` | **Subcontractors / Thekedar** (Sharma profile) |
| `[Name], subcontractor` | `Verma, subcontractor` | **Subcontractors / Thekedar** (Verma profile) |
| `[Name], fabricator` | `Steel Works, fabricator` | **Subcontractors / Thekedar** (Steel Works profile) |
| `[Name], plumber` | `Sanitary work, plumber` | **Subcontractors / Thekedar** |
| `[Name], carpenter` | `Wood fitting, carpenter` | **Subcontractors / Thekedar** |
| `[Name], mistri` | `Rajesh Mistri, mistri` | **Subcontractors / Thekedar** (Rajesh Mistri profile) |
| `[Name], mason` | `Suresh Mason, mason` | **Subcontractors / Thekedar** (Suresh Mason profile) |
| `[Name], pop` | `False Ceiling, pop` | **Subcontractors / Thekedar** |
| `[Name], civil` | `Civil Foundation, civil` | **Subcontractors / Thekedar** |
| `thekedar [Name]` | `thekedar Manoj` | **Subcontractors / Thekedar** (Leading tag format) |
| `contractor [Name]` | `contractor Sharma` | **Subcontractors / Thekedar** (Leading tag format) |

---

### F. 🏢 General Expense, Utility & Service Codes

| Caption Code Keyword | Example WhatsApp Caption | Destination Tab in `/vendors` |
| :--- | :--- | :--- |
| `v` | `v` | **All Vendors / Material** |
| `vendor` | `vendor` | **All Vendors / Material** |
| `expense` | `expense` | **All Vendors / Material** |
| `service` | `service` | **All Vendors / Material** |
| `rent` | `rent` | **All Vendors / Material** |
| `repair` | `repair` | **All Vendors / Material** |
| `maintenance` | `maintenance` | **All Vendors / Material** |
| `chai` | `chai` | **All Vendors / Material** |
| `khana` | `khana` | **All Vendors / Material** |
| `food` | `food` | **All Vendors / Material** |
| `[Name], v` | `Sharma ji, v` | **All Vendors / Material** |
| `[Name], expense` | `Site Tea, expense` | **All Vendors / Material** |
| `[Name], rent` | `Office room rent, rent` | **All Vendors / Material** |
| `[Name], repair` | `Mixer machine repair, repair` | **All Vendors / Material** |
| `[Name], service` | `Water tanker, service` | **All Vendors / Material** |

---

### G. 📍 Site QR Attendance & Selfie Codes

| Code / Action | Example | Destination & Action |
| :--- | :--- | :--- |
| `CHECKIN_[TOKEN]` | `CHECKIN_CK_1725541234_ABC` | 1-Tap Site Attendance (Gate QR Scan) |
| Registered Supervisor Photo | *(Direct Selfie / Group Photo)* | SFace Multi-Face Attendance AI Engine |

---

## 🔍 4. Deep-Dive Specification & Real-World Use Cases

---

### 1. 👷 Worker Khata Advance Codes (`w`, `worker`, `kharcha`, `advance`)

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
   * Caption: `w` ya `worker`
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

### 3. 🏢 Vendor & Material Ledger Codes (`v`, `vendor`, `material`, `thekedar`, `transport`)

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

#### 🏷️ Category Auto-Routing Rules:

##### A. Material & Hardware
* **Keywords:** `cement`, `steel`, `sand`, `ret`, `sariya`, `rodi`, `bajri`, `hardware`, `paint`, `electric`, `shop`, `store`, `trader`, `supplier`, `brick`, `tiles`, `sanitary`, `wood`, `glass`, `m`, `material`.
* **Example Captions:**
  * `UltraTech, m`
  * `sri hardware, v`
  * `Asian Paints, material`
  * `Ret Bajri, v`
* **Destination:** `/vendors` ➔ Category: **Material & Hardware**.

##### B. Subcontractors & Thekedar
* **Keywords:** `thekedar`, `contractor`, `fabricator`, `plumber`, `carpenter`, `mason`, `mistri`, `pop`, `subcontractor`, `civil`.
* **Example Captions:**
  * `Manoj, thekedar`
  * `Sharma Plumbing Contractor, contractor`
  * `Mistri Rajesh, thekedar`
* **Destination:** `/vendors` ➔ Category: **Subcontractors / Thekedar**.

##### C. Transport & Vehicles
* **Keywords:** `transport`, `tempo`, `truck`, `dumper`, `driver`, `t`, `diesel`, `petrol`, `rent`, `vehicle`, `bhada`, `freight`, `auto`, `trolley`, `tractor`, `gaadi`.
* **Example Captions:**
  * `Raju Dumper, transport`
  * `Tempo bhada, t`
  * `Diesel generator, v`
  * `Tractor ret bhada, transport`
* **Destination:** `/vendors` ➔ Category: **Transport & Vehicles**.

##### D. General Vendor / Default
* **Example Captions:**
  * `v`
  * `vendor`
  * `sri traders, v`
* **Destination:** `/vendors` ➔ Category: **Material & Hardware / General**.

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

## 💡 5. Best Practices & Troubleshooting Table

| Situation / Problem | Kya Karna Chahiye | System Behavior |
| :--- | :--- | :--- |
| **Bina kisi caption ke payment screenshot bheja** | Kuch likhne ki jarurat nahi agar account registered worker ka hai | Agar receiver name kisi worker se match hota hai to Worker Advance mein jayega, warna automatically Vendor Ledger mein save hoga. |
| **Worker ke relative / patni ke account par paise bheje** | Caption mein `[Worker Name], w` likhein (e.g. `pintu, w`) | System third-party account name ko bypass karke strictly Pintu ke profile mein advance link karega. |
| **Ek payment mein 3 alag workers ka kharcha hai** | Caption mein `Name: Amount Name: Amount` likhein | System automatic batch split karega aur 3 separate individual khata entries banayega. |
| **Hardware / Material dukan ka payment hai** | Caption mein `[Dukan Name], m` ya `[Dukan Name], v` likhein | `/vendors` ke **Material & Hardware** tab mein profile banegi aur all bills aggregate honge. |
| **Gaadi / Dumper / Tempo ka bhada hai** | Caption mein `[Driver Name], transport` ya `[Gaadi], t` likhein | `/vendors` ke **Transport & Vehicles** tab mein add hoga. |
| **Thekedar ka advance ya payment hai** | Caption mein `[Thekedar Name], thekedar` likhein | `/vendors` ke **Subcontractors / Thekedar** tab mein add hoga. |

---

## 🎯 Summary Rules Checklist

1. **Worker Khata (Advance)** ➔ `w`, `worker`, `[Name], w`, ya `[Name: Amount]`
2. **Vendor Ledger (Material)** ➔ `v`, `m`, `[Name], v`, `[Name], material`
3. **Transport (Gaadi Bhada)** ➔ `[Name], transport`, `[Name], t`
4. **Thekedar (Contractor)** ➔ `[Name], thekedar`, `[Name], contractor`
5. **QR Attendance** ➔ `CHECKIN_...`

Is cheat sheet ko follow karke WhatsApp se construction site ka 100% attendance aur payment khata automated rahega!
