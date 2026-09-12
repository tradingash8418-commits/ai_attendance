const { formatTime, convertTimeToIsoString } = require('../frontend/lib/formatters');

console.log("=== TESTING TIME FORMATTING AND CONVERSION ===");

const t1 = convertTimeToIsoString("06:30 PM", "2026-09-07");
console.log('06:30 PM -> ISO:', t1, 'Formatted back:', formatTime(t1));

const t2 = convertTimeToIsoString("10:00 AM", "2026-09-07");
console.log('10:00 AM -> ISO:', t2, 'Formatted back:', formatTime(t2));

const t3 = convertTimeToIsoString("18:45", "2026-09-07");
console.log('18:45 -> ISO:', t3, 'Formatted back:', formatTime(t3));

const t4 = convertTimeToIsoString("-", "2026-09-07");
console.log('- -> ISO:', t4, 'Formatted back:', formatTime(t4));

const t5 = formatTime("06:30 PM");
console.log('"06:30 PM" formatTime test:', t5);
