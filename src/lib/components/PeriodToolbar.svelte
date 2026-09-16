<!--
	Left half of the toolbar: today's date, the period stepper (‹ Неделя 2 ›) and
	the month/year picker. Steps by whatever the grid is showing.
	Needs: selected date, view mode, whether weekends are shown.
	Writes: selected date, and the slide direction the grid animates with.
-->
<script lang="ts">
	import { monthNames, toMondayOfWeek, addDays, isSameDay, visibleDatesFor, type ViewMode } from '$lib/dates';

	let {
		selectedDate = $bindable(),
		viewMode = $bindable(),
		slideDirection = $bindable(1),
		showWeekends = true
	}: {
		selectedDate: Date;
		viewMode: ViewMode;
		slideDirection?: number;
		showWeekends?: boolean;
	} = $props();

	let isPeriodPickerOpen = $state(false);

	// The week is named after the month it mostly falls in — its Thursday, the way
	// ISO weeks do it — so two weeks never share a number and none is skipped.
	const periodLabel = $derived.by(() => {
		if (viewMode === 'year') return String(selectedDate.getFullYear());
		if (viewMode === 'month') return monthNames[selectedDate.getMonth()];
		const thursday = addDays(toMondayOfWeek(selectedDate), 3);
		const firstThursday = addDays(toMondayOfWeek(new Date(thursday.getFullYear(), thursday.getMonth(), 1)), 3);
		const weeksApart = Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86400000));
		const weekNumber = weeksApart + (firstThursday.getMonth() === thursday.getMonth() ? 1 : 0);
		return `Неделя ${weekNumber}`;
	});

	const isViewingToday = $derived.by(() => {
		const today = new Date();
		if (viewMode === 'year') return today.getFullYear() === selectedDate.getFullYear();
		return visibleDatesFor(selectedDate, viewMode, showWeekends).some((visibleDate) =>
			isSameDay(visibleDate, today)
		);
	});

	const todayLabel = $derived.by(() => {
		const formatted = new Intl.DateTimeFormat('ru-RU', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		}).format(new Date());
		return formatted.charAt(0).toUpperCase() + formatted.slice(1);
	});

	function stepPeriod(step: number) {
		slideDirection = step;
		if (viewMode === 'week') selectedDate = addDays(selectedDate, step * 7);
		else if (viewMode === 'month')
			selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + step, 1);
		else selectedDate = new Date(selectedDate.getFullYear() + step, selectedDate.getMonth(), 1);
	}

	function goToPreviousPeriod() {
		stepPeriod(-1);
	}

	function goToNextPeriod() {
		stepPeriod(1);
	}

	function goToToday() {
		selectedDate = new Date();
	}
</script>

		<button
			class="today-button"
			class:is-away={!isViewingToday}
			onclick={goToToday}
			title={isViewingToday ? todayLabel : 'Вернуться к сегодня'}
		>
			{todayLabel}
			</button>

		<div class="period-stepper">
			<button class="icon-button-light" onclick={goToPreviousPeriod} aria-label="Назад">
				<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
					<path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6"
						stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
			<span class="period-label">{periodLabel}</span>
			<button class="icon-button-light" onclick={goToNextPeriod} aria-label="Вперёд">
				<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
					<path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"
						stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
		</div>

		<div class="dropdown">
			<button
				class="ghost-menu-button"
				onclick={(event) => {
					event.stopPropagation();
					isPeriodPickerOpen = !isPeriodPickerOpen;
				}}
			>
				{monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()} ▾
			</button>

			{#if isPeriodPickerOpen}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div class="dropdown-panel" onclick={(event) => event.stopPropagation()}>
					<div class="year-switcher">
						<button
							class="icon-button-light"
							onclick={() =>
								(selectedDate = new Date(
									selectedDate.getFullYear() - 1,
									selectedDate.getMonth(),
									1
								))}>‹</button
						>
						<strong>{selectedDate.getFullYear()}</strong>
						<button
							class="icon-button-light"
							onclick={() =>
								(selectedDate = new Date(
									selectedDate.getFullYear() + 1,
									selectedDate.getMonth(),
									1
								))}>›</button
						>
					</div>

					<div class="month-picker-grid">
						{#each monthNames as monthName, monthIndex}
							<button
								class="month-picker-cell"
								class:is-selected={selectedDate.getMonth() === monthIndex}
								onclick={() => {
									selectedDate = new Date(selectedDate.getFullYear(), monthIndex, 1);
									isPeriodPickerOpen = false;
								}}
							>
								{monthName.slice(0, 3)}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

<style>

	.today-button {
		height: 1.875rem;
		padding: 0 0.75rem;
		border: 0;
		border-radius: 0.5rem;
		background: var(--color-shell);
		color: var(--color-panel);
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: opacity 0.12s ease;
	}

	.today-button:hover {
		opacity: 0.85;
	}

	.period-stepper {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-left: 0.375rem;
	}

	.period-label {
		min-width: 5.375rem;
		text-align: center;
		font-size: 0.8125rem;
	}

	.today-button {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.4375rem;
	}

	.today-button.is-away {
		background: none;
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.year-switcher {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.month-picker-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.25rem;
	}

	.month-picker-cell {
		border: 0;
		background: none;
		border-radius: 0.5rem;
		padding: 0.4375rem 0;
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		transition: background 0.12s ease;
	}

	.month-picker-cell:hover {
		background: #f1f1f1;
	}

	.month-picker-cell.is-selected {
		background: var(--color-shell);
		color: var(--color-panel);
	}
</style>
