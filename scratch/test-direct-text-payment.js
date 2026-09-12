const { parseDirectTextPayment } = require('../frontend/services/webhook-processor.server');

const testCases = [
  "pintu prajapati: 500 cash",
  "rohit yadav: 300 cash w",
  "rohit yadav: 300 cash worker",
  "ganesh pathak: 7000 cash v",
  "ganesh pathak: 7000 cash vendor",
  "suresh hardware: 6000 cash m",
  "suresh hardware: 6000 cash material",
  "deepak: 500 cash t",
  "deepak: 500 cash transport",
  "sanju singh yadav: 4000 cash c",
  "sanju singh yadav: 4000 cash contractor",
  "sanju singh yadav: 4000 cash thekedar",
];

console.log("=== RUNNING DIRECT TEXT PAYMENT PARSER TESTS ===");
let passed = 0;
for (const tc of testCases) {
  const result = parseDirectTextPayment(tc);
  console.log(`Input: "${tc}" ->`, result);
  if (result) passed++;
}
console.log(`Passed ${passed}/${testCases.length} tests`);
