<!--
	People as rows, days or months as columns: the studio at a glance.
	Read-only — no cell here is editable.
	Needs: employees, tasks (to map hours to a person), the hours map, vacations,
	period and the per-person daily norm.
	Writes: nothing; vacation decisions go out as callbacks.
-->
<script lang="ts">
	import { toIsoDate } from '$lib/fakeData';
	import {
		weekDayNames,
		monthNames,
		isSameDay,
		visibleDatesFor,
		datesOfMonth,
		datesOfYear,
		type ViewMode
	} from '$lib/dates';
	import {
		formatHours,
		aggregateHours,
		expectedHoursFor,
		type HoursByTaskAndDate
	} from '$lib/hours';
	import type { Employee, StudioTask, VacationRequest } from '$lib/studioData';

	let {
		employees,
		tasks,
		hoursByTaskAndDate,
		vacations,
		selectedDate,
		viewMode,
		targetHoursPerDay = 8,
		showWeekends = false,
		onApproveVacation = (_vacationId: string) => {},
		onDeclineVacation = (_vacationId: string) => {},
		onOpenEmployee = (_employeeId: string) => {}
	}: {
		employees: Employee[];
		tasks: StudioTask[];
		hoursByTaskAndDate: HoursByTaskAndDate;
		vacations: VacationRequest[];
		selectedDate: Date;
		viewMode: ViewMode;
		targetHoursPerDay?: number;
		showWeekends?: boolean;
		onApproveVacation?: (vacationId: string) => void;
		onDeclineVacation?: (vacationId: string) => void;
		onOpenEmployee?: (employeeId: string) => void;
	} = $props();

	const visibleDates = $derived(visibleDatesFor(selectedDate, viewMode, showWeekends));

	const monthsOfYear = $derived(
		Array.from({ length: 12 }, (_, monthIndex) => new Date(selectedDate.getFullYear(), monthIndex, 1))
	);

	// Keyed by employee and day, so every cell is a lookup.
	const hoursByEmployeeAndDate = $derived.by(() => {
		const employeeOfTask: Record<string, string> = {};
		for (const task of tasks) employeeOfTask[task.taskId] = task.employeeId;
		return aggregateHours(hoursByTaskAndDate, (taskId, isoDate) =>
			employeeOfTask[taskId] ? `${employeeOfTask[taskId]}:${isoDate}` : null
		);
	});

	function hoursOf(employeeId: string, date: Date): number {
		return hoursByEmployeeAndDate[`${employeeId}:${toIsoDate(date)}`] ?? 0;
	}

	function hoursOfMonth(employeeId: string, monthDate: Date): number {
		const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
		let total = 0;
		for (let day = 1; day <= lastDay; day += 1) {
			total += hoursOf(employeeId, new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
		}
		return total;
	}

	function periodHoursOf(employeeId: string): number {
		if (viewMode === 'year') {
			return monthsOfYear.reduce((sum, month) => sum + hoursOfMonth(employeeId, month), 0);
		}
		return visibleDates.reduce((sum, date) => sum + hoursOf(employeeId, date), 0);
	}

	function expectedPeriodHours(): number {
		return expectedHoursFor(
			viewMode === 'year' ? datesOfYear(selectedDate) : visibleDates,
			targetHoursPerDay
		);
	}

	function loadRatioOf(employeeId: string): number {
		const expected = expectedPeriodHours();
		return expected === 0 ? 0 : periodHoursOf(employeeId) / expected;
	}

	function vacationOn(employeeId: string, date: Date): VacationRequest | undefined {
		const isoDate = toIsoDate(date);
		return vacations.find(
			(vacation) =>
				vacation.employeeId === employeeId &&
				vacation.status !== 'declined' &&
				isoDate >= vacation.fromDate &&
				isoDate <= vacation.toDate
		);
	}

	// Dimmer than the task grid — this table is read at a glance, not edited.
	// A day cell compares against the daily norm, a month cell against its own norm.
	function cellColor(loggedHours: number, expectedHours: number): string {
		if (loggedHours === 0 || expectedHours === 0) return 'transparent';
		const ratio = Math.min(loggedHours / expectedHours, 1);
		return loggedHours >= expectedHours
			? 'rgb(64 150 96 / 0.14)'
			: `rgb(190 160 70 / ${0.05 + ratio * 0.07})`;
	}

	function expectedMonthHours(monthDate: Date): number {
		return expectedHoursFor(datesOfMonth(monthDate), targetHoursPerDay);
	}

	// What the whole studio logged on each column, and for the period.
	const studioTotalsPerColumn = $derived.by(() => {
		if (viewMode === 'year') {
			return monthsOfYear.map((monthDate) =>
				employees.reduce((sum, employee) => sum + hoursOfMonth(employee.employeeId, monthDate), 0)
			);
		}
		return visibleDates.map((date) =>
			employees.reduce((sum, employee) => sum + hoursOf(employee.employeeId, date), 0)
		);
	});

	const studioTotalForPeriod = $derived(
		studioTotalsPerColumn.reduce((sum, columnTotal) => sum + columnTotal, 0)
	);

	const staffCount = $derived(
		employees.filter(
			(employee) =>
				employee.employmentKind === 'staff' && employee.employeeStatus === 'active'
		).length
	);

	// One person's norm × the people who owe it. Outsource and archived rows do not.
	const expectedStudioPerColumn = $derived(
		viewMode === 'year'
			? monthsOfYear.map((monthDate) => expectedMonthHours(monthDate) * staffCount)
			: visibleDates.map((date) => expectedHoursFor([date], targetHoursPerDay) * staffCount)
	);

	const pendingVacations = $derived(vacations.filter((vacation) => vacation.status === 'pending'));

	function employeeName(employeeId: string): string {
		return employees.find((employee) => employee.employeeId === employeeId)?.employeeName ?? '';
	}

	// "12–20 октября", but "28 сентября – 3 октября" when the range crosses months.
	function formatRange(fromDate: string, toDate: string): string {
		const from = new Date(`${fromDate}T00:00:00`);
		const to = new Date(`${toDate}T00:00:00`);
		const toMonthName = monthNames[to.getMonth()].toLowerCase();
		if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
			return `${from.getDate()}–${to.getDate()} ${toMonthName}`;
		}
		return `${from.getDate()} ${monthNames[from.getMonth()].toLowerCase()} – ${to.getDate()} ${toMonthName}`;
	}
</script>

{#if pendingVacations.length > 0}
	<section class="vacation-requests">
		<h2 class="vacation-title">Заявки на отпуск · {pendingVacations.length}</h2>
		{#each pendingVacations as vacation (vacation.vacationId)}
			<div class="vacation-row">
				<strong>{employeeName(vacation.employeeId)}</strong>
				<span class="vacation-range">{formatRange(vacation.fromDate, vacation.toDate)}</span>
				<button class="pill-button is-dark" onclick={() => onApproveVacation(vacation.vacationId)}>
					Одобрить
				</button>
				<button class="pill-button" onclick={() => onDeclineVacation(vacation.vacationId)}>
					Отклонить
				</button>
			</div>
		{/each}
	</section>
{/if}

<div class="team-legend">
	<span class="legend-item"><span class="legend-swatch is-full"></span> норма закрыта</span>
	<span class="legend-item"><span class="legend-swatch is-partial"></span> меньше нормы</span>
	<span class="legend-item"><span class="legend-swatch is-vacation"></span> отпуск одобрен</span>
	<span class="legend-item"><span class="legend-swatch is-vacation-pending"></span> отпуск на согласовании</span>
</div>

<div class="team-scroll">
	<div
		class="team-grid"
		style="grid-template-columns: 16rem repeat({viewMode === 'year'
			? 12
			: visibleDates.length}, minmax(2.25rem, 1fr)) 7rem"
	>
		<div class="team-row is-header">
			<div class="team-cell is-person">Сотрудник</div>
			{#if viewMode === 'year'}
				{#each monthsOfYear as monthDate (monthDate.getMonth())}
					<div class="team-cell is-day">{monthNames[monthDate.getMonth()].slice(0, 3)}</div>
				{/each}
			{:else}
				{#each visibleDates as date (toIsoDate(date))}
					<div class="team-cell is-day" class:is-today={isSameDay(date, new Date())}>
						{#if viewMode === 'week'}
							<span class="day-name">{weekDayNames[(date.getDay() + 6) % 7]}</span>
							<span class="day-number">{date.getDate()}</span>
						{:else}
							{date.getDate()}
						{/if}
					</div>
				{/each}
			{/if}
			<div class="team-cell is-load">Загрузка</div>
		</div>

		{#each employees as employee (employee.employeeId)}
			{@const loadRatio = loadRatioOf(employee.employeeId)}
			<div class="team-row">
				<div class="team-cell is-person" class:is-archived={employee.employeeStatus === 'archived'}>
					<button class="team-person-button" onclick={() => onOpenEmployee(employee.employeeId)}>
						<img class="team-avatar" src={employee.avatarUrl} alt="" />
						<span class="team-person-text">
							<strong>{employee.employeeName}</strong>
							<span>{employee.employeeRole}</span>
						</span>
					</button>
					{#if employee.employmentKind === 'outsource'}
						<span class="team-tag">аутсорс</span>
					{:else if employee.employeeStatus === 'invited'}
						<span class="team-tag">приглашён</span>
					{:else if employee.employeeStatus === 'archived'}
						<span class="team-tag">архив</span>
					{/if}
				</div>

				{#if viewMode === 'year'}
					{#each monthsOfYear as monthDate (monthDate.getMonth())}
						{@const monthHours = hoursOfMonth(employee.employeeId, monthDate)}
						<div
							class="team-cell is-day"
							style="background: {cellColor(monthHours, expectedMonthHours(monthDate))}"
						>
							{monthHours > 0 ? formatHours(monthHours) : ''}
						</div>
					{/each}
				{:else}
					{#each visibleDates as date (toIsoDate(date))}
						{@const loggedHours = hoursOf(employee.employeeId, date)}
						{@const vacation = vacationOn(employee.employeeId, date)}
						<div
							class="team-cell is-day"
							class:is-vacation={vacation?.status === 'approved'}
							class:is-vacation-pending={vacation?.status === 'pending'}
							title={vacation
								? vacation.status === 'approved'
									? 'Отпуск одобрен'
									: 'Отпуск на согласовании'
								: `${formatHours(loggedHours)} ч`}
							style="background: {vacation ? '' : cellColor(loggedHours, targetHoursPerDay)}"
						>
							{#if vacation}
								<span class="vacation-mark">
									{vacation.status === 'approved' ? 'отп' : 'отп?'}
								</span>
							{:else}
								{loggedHours > 0 ? formatHours(loggedHours) : ''}
							{/if}
						</div>
					{/each}
				{/if}

				<div class="team-cell is-load">
					<span class="team-load-value">{formatHours(periodHoursOf(employee.employeeId))} ч</span>
					<span class="team-load-track">
						<span
							class="team-load-fill"
							style="width: {Math.min(loadRatio, 1) * 100}%; background: {loadRatio >= 0.95
								? 'var(--color-day-full-text)'
								: loadRatio >= 0.6
									? 'var(--color-day-partial-text)'
									: 'var(--color-weekend)'}"
						></span>
					</span>
				</div>
			</div>
		{/each}

		{#if employees.length === 0}
			<div class="team-row">
				<div class="team-cell is-blank">
					Никого нет — позовите сотрудника или добавьте аутсорс кнопками сверху.
				</div>
			</div>
		{/if}

		<div class="team-row is-totals">
			<div class="team-cell is-person">Вся студия</div>

			{#each studioTotalsPerColumn as columnTotal, columnIndex (columnIndex)}
				<div
					class="team-cell is-day"
					class:is-under={columnTotal < (expectedStudioPerColumn[columnIndex] ?? 0)}
					title="Ожидалось {formatHours(expectedStudioPerColumn[columnIndex] ?? 0)} ч"
				>
					{columnTotal > 0 ? formatHours(columnTotal) : ''}
				</div>
			{/each}

			<div class="team-cell is-load">
				<span class="team-load-value">{formatHours(studioTotalForPeriod)} ч</span>
			</div>
		</div>
	</div>
</div>

<style>
	.vacation-requests {
		padding: 0.625rem 0.875rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-cell-tint);
	}

	.vacation-title {
		margin: 0 0 0.375rem;
		font-size: 0.8125rem;
	}

	.vacation-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0;
		font-size: 0.8125rem;
	}

	.vacation-range {
		margin-right: auto;
		color: var(--color-text-muted);
	}

	.team-scroll {
		flex: 1;
		overflow: auto;
	}

	.team-grid {
		display: grid;
		min-width: 100%;
	}

	.team-row {
		display: grid;
		grid-template-columns: subgrid;
		grid-column: 1 / -1;
	}

	.team-cell {
		border-right: 1px solid var(--color-border);
		border-bottom: 1px solid var(--color-border);
		padding: 0.375rem 0.5rem;
		font-size: 0.8125rem;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		font-variant-numeric: tabular-nums;
	}

	.team-row.is-header .team-cell {
		background: var(--color-panel);
		position: sticky;
		top: 0;
		z-index: 2;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		min-height: 2.25rem;
	}

	.team-cell.is-person {
		justify-content: flex-start;
		gap: 0.5rem;
		position: sticky;
		left: 0;
		background: var(--color-panel);
		z-index: 1;
	}

	.team-row.is-header .team-cell.is-person {
		z-index: 3;
	}

	.team-avatar {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		object-fit: cover;
		flex: none;
	}

	.team-person-text {
		display: flex;
		flex-direction: column;
		line-height: 1.25;
		min-width: 0;
	}

	.team-person-text span {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.team-tag {
		margin-left: auto;
		padding: 0.0625rem 0.375rem;
		border-radius: 999px;
		background: var(--color-cell-tint);
		font-size: 0.6875rem;
		color: var(--color-text-muted);
	}

	.team-cell.is-blank {
		grid-column: 1 / -1;
		justify-content: flex-start;
		color: var(--color-text-muted);
	}

	/* Sticks to the bottom, the way the header sticks to the top. */
	.team-row.is-totals .team-cell {
		position: sticky;
		bottom: 0;
		z-index: 2;
		background: var(--color-cell-tint);
		border-top: 1px solid var(--color-border);
		border-bottom: 0;
		font-weight: 500;
		min-height: 2.25rem;
	}

	.team-row.is-totals .team-cell.is-person {
		z-index: 3;
	}

	.team-row.is-totals .team-cell.is-under {
		color: var(--color-text-muted);
	}

	.team-cell.is-day.is-today {
		color: var(--color-text);
		font-weight: 600;
	}

	.team-cell.is-vacation {
		background: rgb(70 100 190 / 0.16);
		color: var(--color-vacation-strong);
	}

	.team-cell.is-vacation-pending {
		background: repeating-linear-gradient(
			45deg,
			rgb(70 100 190 / 0.16) 0 0.25rem,
			transparent 0.25rem 0.5rem
		);
		color: var(--color-vacation-strong);
	}

	.vacation-mark {
		font-size: 0.6875rem;
	}

	.day-name {
		margin-right: 0.25rem;
	}

	.team-person-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		padding: 0;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.team-person-button:hover strong {
		text-decoration: underline;
	}

	.team-cell.is-person.is-archived {
		opacity: 0.55;
	}

	.team-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.875rem;
		padding: 0.4375rem 0.875rem;
		border-bottom: 1px solid var(--color-border);
		font-size: 0.6875rem;
		color: var(--color-text-muted);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.3125rem;
	}

	.legend-swatch {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 0.25rem;
		border: 1px solid var(--color-border);
	}

	.legend-swatch.is-full {
		background: rgb(64 150 96 / 0.14);
	}

	.legend-swatch.is-partial {
		background: rgb(190 160 70 / 0.09);
	}

	.legend-swatch.is-vacation {
		background: rgb(70 100 190 / 0.16);
	}

	.legend-swatch.is-vacation-pending {
		background: repeating-linear-gradient(
			45deg,
			rgb(70 100 190 / 0.16) 0 0.1875rem,
			transparent 0.1875rem 0.375rem
		);
	}

	.team-cell.is-load {
		flex-direction: column;
		align-items: stretch;
		gap: 0.25rem;
		justify-content: center;
		border-right: 0;
	}

	.team-load-value {
		font-size: 0.75rem;
		text-align: right;
	}

	.team-load-track {
		height: 0.25rem;
		border-radius: 999px;
		background: var(--color-cell-tint);
		overflow: hidden;
	}

	.team-load-fill {
		display: block;
		height: 100%;
		border-radius: 999px;
	}
</style>
