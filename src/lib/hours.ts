// Hour helpers shared by the grid, the sidebar and the reports.

import { toIsoDate } from '$lib/fakeData';
import { isWeekend } from '$lib/dates';

export type HoursByTaskAndDate = Record<string, string>;

export function parseHours(value: string): number {
	return Number(value.replace(',', '.')) || 0;
}

export function formatHours(hours: number): string {
	return String(Math.round(hours * 100) / 100).replace('.', ',');
}

export const maximumHoursPerDay = 24;

/**
 * Input stays text so "5," is typable: only digits and one separator survive,
 * at most two decimals, and nothing above 24 — the same bounds the `hours`
 * column will enforce (numeric(4,2), 0…24).
 */
export function sanitizeHoursInput(value: string): string {
	const digitsAndDot = value.replace(',', '.').replace(/[^0-9.]/g, '');
	const [wholePart, ...fractionParts] = digitsAndDot.split('.');
	const fraction = fractionParts.join('').slice(0, 2);
	const cleaned = fractionParts.length > 0 ? `${wholePart}.${fraction}` : wholePart;
	if (cleaned === '' || cleaned === '.') return '';
	// "24." and "24,5" both clamp to the cap, keeping the separator typable.
	if (Number(cleaned) > maximumHoursPerDay) return String(maximumHoursPerDay);
	return cleaned;
}

// 0.25 is the smallest unit anyone bills, so that is what a cell rounds to.
export function roundToQuarter(hours: number): number {
	return Math.round(hours * 4) / 4;
}

// Cell keys are `taskId:isoDate` — split once, here, and nowhere else.
export function splitCellKey(cellKey: string): { taskId: string; isoDate: string } {
	const separatorIndex = cellKey.lastIndexOf(':');
	return { taskId: cellKey.slice(0, separatorIndex), isoDate: cellKey.slice(separatorIndex + 1) };
}

/**
 * Every hour total in the app comes from here: one pass over the entries,
 * bucketed by whatever key the caller needs, then O(1) lookups.
 * Return null from `keyOf` to skip an entry.
 */
export function aggregateHours(
	hoursByTaskAndDate: HoursByTaskAndDate,
	keyOf: (taskId: string, isoDate: string) => string | null
): Record<string, number> {
	const totals: Record<string, number> = {};
	for (const [cellKey, value] of Object.entries(hoursByTaskAndDate)) {
		const { taskId, isoDate } = splitCellKey(cellKey);
		const key = keyOf(taskId, isoDate);
		if (key === null) continue;
		totals[key] = (totals[key] ?? 0) + parseHours(value);
	}
	return totals;
}

export function buildHoursByDate(hoursByTaskAndDate: HoursByTaskAndDate): Record<string, number> {
	return aggregateHours(hoursByTaskAndDate, (_taskId, isoDate) => isoDate);
}

export function buildHoursByTaskId(hoursByTaskAndDate: HoursByTaskAndDate): Record<string, number> {
	return aggregateHours(hoursByTaskAndDate, (taskId) => taskId);
}

// One pass over the entries, then a lookup per date — never a scan per date.
export function sumHoursOnDates(hoursByTaskAndDate: HoursByTaskAndDate, dates: Date[]): number {
	const hoursByDate = buildHoursByDate(hoursByTaskAndDate);
	return dates.reduce((sum, date) => sum + (hoursByDate[toIsoDate(date)] ?? 0), 0);
}

/**
 * The only place "how many hours should this period hold" is answered:
 * working days in the period × the daily norm × how many people.
 * Weekends never count, even when the grid is showing them.
 */
export function expectedHoursFor(
	dates: Date[],
	targetHoursPerDay: number,
	headcount = 1
): number {
	const workingDayCount = dates.filter((date) => !isWeekend(date)).length;
	return workingDayCount * targetHoursPerDay * headcount;
}

export function dayFillColor(loggedHours: number, targetHoursPerDay: number): string {
	if (loggedHours === 0) return 'transparent';
	return loggedHours >= targetHoursPerDay ? 'var(--color-day-full)' : 'var(--color-day-partial)';
}
