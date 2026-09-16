// The only vacation source in the app: one record per request, with a status.
// Prototype only — in memory, seeded so the screens have something to show.

import { toIsoDate } from '$lib/fakeData';
import { vacationRequests, type VacationRequest, type VacationStatus } from '$lib/studioData';
import { notifyEmployees } from '$lib/notifications.svelte';

const vacations = $state<{ items: VacationRequest[] }>({
	items: vacationRequests.map((vacation) => ({ ...vacation }))
});

export function allVacations(): VacationRequest[] {
	return vacations.items;
}

export function pendingVacations(): VacationRequest[] {
	return vacations.items.filter((vacation) => vacation.status === 'pending');
}

export function vacationsOf(employeeId: string): VacationRequest[] {
	return vacations.items.filter((vacation) => vacation.employeeId === employeeId);
}

// A declined request is not a vacation — it leaves no mark on any screen.
export function vacationOn(employeeId: string, date: Date): VacationRequest | undefined {
	const isoDate = toIsoDate(date);
	return vacations.items.find(
		(vacation) =>
			vacation.employeeId === employeeId &&
			vacation.status !== 'declined' &&
			isoDate >= vacation.fromDate &&
			isoDate <= vacation.toDate
	);
}

// Every day one person is away, as ISO strings — what the grids colour by.
export function vacationDatesOf(employeeId: string): Record<string, VacationStatus> {
	const dates: Record<string, VacationStatus> = {};
	for (const vacation of vacationsOf(employeeId)) {
		if (vacation.status === 'declined') continue;
		const day = new Date(`${vacation.fromDate}T00:00:00`);
		const lastDay = new Date(`${vacation.toDate}T00:00:00`);
		while (day <= lastDay) {
			dates[toIsoDate(day)] = vacation.status;
			day.setDate(day.getDate() + 1);
		}
	}
	return dates;
}

// The next day off that has not started yet, for the sidebar counter.
export function nextVacationOf(employeeId: string): VacationRequest | undefined {
	const today = toIsoDate(new Date());
	return vacationsOf(employeeId)
		.filter((vacation) => vacation.status !== 'declined' && vacation.toDate >= today)
		.sort((first, second) => first.fromDate.localeCompare(second.fromDate))[0];
}

export function requestVacation(
	employeeId: string,
	fromDate: string,
	toDate: string,
	bossEmployeeId = 'david'
) {
	if (!fromDate || !toDate || toDate < fromDate) return;
	vacations.items = [
		...vacations.items,
		{
			vacationId: `v-${Date.now()}`,
			employeeId,
			fromDate,
			toDate,
			status: 'pending'
		}
	];
	notifyEmployees([bossEmployeeId], `Новая заявка на отпуск: ${fromDate} — ${toDate}.`);
}

export function decideVacation(vacationId: string, status: 'approved' | 'declined') {
	const vacation = vacations.items.find((candidate) => candidate.vacationId === vacationId);
	if (!vacation) return;
	vacations.items = vacations.items.map((candidate) =>
		candidate.vacationId === vacationId ? { ...candidate, status } : candidate
	);
	notifyEmployees(
		[vacation.employeeId],
		status === 'approved' ? 'Отпуск одобрен.' : 'Заявка на отпуск отклонена.'
	);
}

export function cancelVacation(vacationId: string) {
	vacations.items = vacations.items.filter((vacation) => vacation.vacationId !== vacationId);
}
