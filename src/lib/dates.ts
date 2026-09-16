// Date helpers shared by the grid, the sidebar and the reports.

export const weekDayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const monthNames = [
	'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
	'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export type ViewMode = 'week' | 'month' | 'year';

export function toMondayOfWeek(date: Date): Date {
	const monday = new Date(date);
	const weekDayStartingMonday = (date.getDay() + 6) % 7;
	monday.setDate(date.getDate() - weekDayStartingMonday);
	return monday;
}

export function addDays(date: Date, dayCount: number): Date {
	const shifted = new Date(date);
	shifted.setDate(date.getDate() + dayCount);
	return shifted;
}

export function isSameDay(first: Date, second: Date): boolean {
	return first.toDateString() === second.toDateString();
}

export function isWeekend(date: Date): boolean {
	return date.getDay() === 0 || date.getDay() === 6;
}

export function countWeekdaysBetween(fromDate: Date, toDate: Date): number {
	let weekdayCount = 0;
	for (const day = new Date(fromDate); day <= toDate; day.setDate(day.getDate() + 1)) {
		if (!isWeekend(day)) weekdayCount += 1;
	}
	return weekdayCount;
}

export function datesOfWeek(anchorDate: Date): Date[] {
	return Array.from({ length: 7 }, (_, dayIndex) => addDays(toMondayOfWeek(anchorDate), dayIndex));
}

export function datesOfMonth(anchorDate: Date): Date[] {
	const year = anchorDate.getFullYear();
	const month = anchorDate.getMonth();
	const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
	return Array.from({ length: lastDayOfMonth }, (_, dayIndex) => new Date(year, month, dayIndex + 1));
}

// The days the grid shows for the current period, weekends optional.
export function visibleDatesFor(
	anchorDate: Date,
	viewMode: ViewMode,
	showWeekends: boolean
): Date[] {
	const dates = viewMode === 'week' ? datesOfWeek(anchorDate) : datesOfMonth(anchorDate);
	return dates.filter((date) => showWeekends || !isWeekend(date));
}

export function datesOfYear(anchorDate: Date): Date[] {
	const year = anchorDate.getFullYear();
	return Array.from({ length: 12 }, (_, monthIndex) => datesOfMonth(new Date(year, monthIndex, 1))).flat();
}
