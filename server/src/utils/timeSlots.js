/**
 * Time & slot calculation utilities for ClinicaWeb schedules.
 * All times are handled in HH:MM:SS (24h) format.
 */

function timeToMinutes(timeStr) {
  const parts = String(timeStr).split(':').map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function normalizeTime(timeStr) {
  const raw = String(timeStr || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  const ss = Number(match[3] || 0);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/**
 * Returns ISO day of week: 1 = Monday ... 5 = Friday, 6 = Saturday, 7 = Sunday.
 */
function getIsoDayOfWeek(dateStr) {
  const match = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  const jsDay = d.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Generate all discrete slots for a schedule window.
 */
function generateSlots(startTime, endTime, slotDurationMinutes = 30) {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const duration = Number(slotDurationMinutes) || 30;
  const slots = [];

  for (let current = startMin; current + duration <= endMin; current += duration) {
    slots.push({
      start_time: minutesToTime(current),
      end_time: minutesToTime(current + duration)
    });
  }
  return slots;
}

module.exports = {
  timeToMinutes,
  minutesToTime,
  normalizeTime,
  getIsoDayOfWeek,
  generateSlots
};
