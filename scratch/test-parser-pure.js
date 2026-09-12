function parseDirectTextPayment(rawText) {
  if (!rawText || !rawText.trim()) return null;
  const text = rawText.trim();

  // Ignore check-in codes
  if (text.toUpperCase().includes('CHECKIN_')) return null;

  // Primary pattern matching: Name [:=- or space] [₹/Rs] Amount [Trailing Method/Tag]
  const mainRegex = /^(?:['"‘“])?([a-zA-Z0-9\s._&]+?)(?:['"’”])?\s*[:=-]?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*(.*)$/i;

  const match = text.match(mainRegex);
  if (!match || !match[1] || !match[2]) return null;

  const rawName = match[1].trim().replace(/^['"‘“]+|['"’”]+$/g, '').trim();
  const rawAmt = match[2].replace(/,/g, '').trim();
  const amount = parseFloat(rawAmt);
  const trailingStr = (match[3] || '').trim().toLowerCase();

  const reservedWords = ['checkin', 'help', 'status', 'start', 'stop', 'hi', 'hello'];
  if (!rawName || isNaN(amount) || amount <= 0 || reservedWords.includes(rawName.toLowerCase())) {
    return null;
  }

  const tokens = trailingStr.split(/[\s,._\-\/]+/).filter(Boolean);

  let paymentMethod = 'cash';
  const methodKeywords = {
    cash: 'cash',
    gpay: 'gpay',
    googlepay: 'gpay',
    phonepe: 'phonepe',
    paytm: 'paytm',
    upi: 'upi',
    online: 'bank_transfer',
    bank: 'bank_transfer',
    transfer: 'bank_transfer',
    cheque: 'bank_transfer',
  };

  for (const token of tokens) {
    if (methodKeywords[token]) {
      paymentMethod = methodKeywords[token];
      break;
    }
  }

  let tagType = 'vendor_payment';
  let ledgerCategory = 'vendor';
  let isWorkerTarget = false;

  const workerTags = ['w', 'worker', 'karigar', 'advance', 'kharcha'];
  const materialTags = ['m', 'material', 'hardware', 'supplier', 'goods'];
  const transportTags = ['t', 'transport', 'vehicle', 'truck', 'dumper', 'freight', 'bhada'];
  const contractorTags = ['c', 'contractor', 'thekedar', 'subcontractor'];
  const vendorTags = ['v', 'vendor', 'payee', 'seller'];

  for (const token of tokens) {
    if (workerTags.includes(token)) {
      tagType = 'advance';
      ledgerCategory = 'advance';
      isWorkerTarget = true;
      break;
    } else if (materialTags.includes(token)) {
      tagType = 'material';
      ledgerCategory = 'material';
      isWorkerTarget = false;
      break;
    } else if (transportTags.includes(token)) {
      tagType = 'transport';
      ledgerCategory = 'vendor';
      isWorkerTarget = false;
      break;
    } else if (contractorTags.includes(token)) {
      tagType = 'thekedar';
      ledgerCategory = 'vendor';
      isWorkerTarget = false;
      break;
    } else if (vendorTags.includes(token)) {
      tagType = 'vendor_payment';
      ledgerCategory = 'vendor';
      isWorkerTarget = false;
      break;
    }
  }

  return {
    payeeOrWorkerName: rawName,
    amount,
    paymentMethod,
    isWorkerTarget,
    ledgerCategory,
    tagType,
  };
}

const testCases = [
  { input: "pintu prajapati: 500 cash", expectedTag: "vendor_payment", expectedWorker: false },
  { input: "rohit yadav: 300 cash w", expectedTag: "advance", expectedWorker: true },
  { input: "rohit yadav: 300 cash worker", expectedTag: "advance", expectedWorker: true },
  { input: "ganesh pathak: 7000 cash v", expectedTag: "vendor_payment", expectedWorker: false },
  { input: "ganesh pathak: 7000 cash vendor", expectedTag: "vendor_payment", expectedWorker: false },
  { input: "suresh hardware: 6000 cash m", expectedTag: "material", expectedWorker: false },
  { input: "suresh hardware: 6000 cash material", expectedTag: "material", expectedWorker: false },
  { input: "deepak: 500 cash t", expectedTag: "transport", expectedWorker: false },
  { input: "deepak: 500 cash transport", expectedTag: "transport", expectedWorker: false },
  { input: "sanju singh yadav: 4000 cash c", expectedTag: "thekedar", expectedWorker: false },
  { input: "sanju singh yadav: 4000 cash contractor", expectedTag: "thekedar", expectedWorker: false },
  { input: "sanju singh yadav: 4000 cash thekedar", expectedTag: "thekedar", expectedWorker: false },
];

console.log("=== RUNNING DIRECT TEXT PAYMENT PARSER TESTS ===");
let passed = 0;
for (const tc of testCases) {
  const result = parseDirectTextPayment(tc.input);
  const matchOk = result && result.tagType === tc.expectedTag && result.isWorkerTarget === tc.expectedWorker;
  console.log(`Input: "${tc.input}" -> Tag: ${result?.tagType}, Worker: ${result?.isWorkerTarget} [${matchOk ? 'PASS' : 'FAIL'}]`);
  if (matchOk) passed++;
}
console.log(`\nResult: Passed ${passed}/${testCases.length} tests.`);
