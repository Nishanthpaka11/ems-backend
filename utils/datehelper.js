// utils/datehelper.js
function countWeekdaysInMonth(year, monthIndex) {
  let weekdays = 0;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Sunday, 6 = Saturday
      weekdays++;
    }
  }

  return weekdays;
}

module.exports = { countWeekdaysInMonth };
