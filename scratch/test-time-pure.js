function formatTime(val, fallback = '-') {
  if (!val || val === '-') return fallback;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '-' || !trimmed) return fallback;

    const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12 && match12[1] && match12[2] && match12[3]) {
      const hh = match12[1].padStart(2, '0');
      const mm = match12[2];
      const ampm = match12[3].toUpperCase();
      return `${hh}:${mm} ${ampm}`;
    }

    const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (match24 && match24[1] && match24[2]) {
      let h = parseInt(match24[1], 10);
      const mm = match24[2];
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      const hh = String(h).padStart(2, '0');
      return `${hh}:${mm} ${ampm}`;
    }
  }

  try {
    let d;
    if (typeof val === 'object' && 'toDate' in val && typeof val.toDate === 'function') {
      d = val.toDate();
    } else if (typeof val === 'object' && 'seconds' in val) {
      d = new Date(val.seconds * 1000);
    } else {
      d = new Date(val);
    }
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return fallback;
  }
}

function convertTimeToIsoString(timeStr, baseDateStr) {
  if (!timeStr || !timeStr.trim() || timeStr.trim() === '-') return null;
  const str = timeStr.trim();

  let hours = -1;
  let minutes = -1;

  const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12 && match12[1] && match12[2] && match12[3]) {
    let h = parseInt(match12[1], 10);
    minutes = parseInt(match12[2], 10);
    const ampm = match12[3].toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    hours = h;
  } else {
    const match24 = str.match(/^(\d{1,2}):(\d{2})$/);
    if (match24 && match24[1] && match24[2]) {
      hours = parseInt(match24[1], 10);
      minutes = parseInt(match24[2], 10);
    } else {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
      return null;
    }
  }

  if (hours < 0 || minutes < 0 || hours > 23 || minutes > 59) return null;

  const dateParts = baseDateStr.split('-').map((v) => parseInt(v, 10));
  const yyyy = dateParts[0] || new Date().getFullYear();
  const mm = dateParts[1] || (new Date().getMonth() + 1);
  const dd = dateParts[2] || new Date().getDate();

  const resultDate = new Date(yyyy, mm - 1, dd, hours, minutes, 0, 0);
  return resultDate.toISOString();
}

console.log("=== TESTING PURE TIME FUNCTIONS ===");
const iso1 = convertTimeToIsoString("06:30 PM", "2026-09-07");
console.log('06:30 PM -> ISO:', iso1, '-> Formatted:', formatTime(iso1));

const iso2 = convertTimeToIsoString("10:00 AM", "2026-09-07");
console.log('10:00 AM -> ISO:', iso2, '-> Formatted:', formatTime(iso2));

const iso3 = convertTimeToIsoString("-", "2026-09-07");
console.log('- -> ISO:', iso3, '-> Formatted:', formatTime(iso3));

const directFormatted = formatTime("06:30 PM");
console.log('Direct string "06:30 PM" formatted:', directFormatted);
