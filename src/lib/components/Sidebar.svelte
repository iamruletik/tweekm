<!--
	The right-hand rail of both app screens: week/month load gauges, the scrolling
	calendar, the vacation counter with its request form, notifications, and the
	user menu (settings, language, workspace, logout).
	Needs: the signed-in person, their hours map, the daily norm, selected date.
	Writes: selected date, sidebar open state, language, vacation requests.
-->
<script lang="ts">
	import { toIsoDate } from '$lib/fakeData';
	import {
		monthNames,
		weekDayNames,
		addDays,
		toMondayOfWeek,
		isSameDay,
		datesOfWeek,
		datesOfMonth,
		isWeekend
	} from '$lib/dates';
	import {
		notificationsFor,
		unreadCountFor,
		markNotificationsRead
	} from '$lib/notifications.svelte';
	import {
		formatHours,
		buildHoursByDate,
		sumHoursOnDates,
		dayFillColor as dayFillColorFor,
		expectedHoursFor,
		type HoursByTaskAndDate
	} from '$lib/hours';
	import {
		vacationDatesOf,
		nextVacationOf,
		requestVacation
	} from '$lib/vacations.svelte';

	let {
		selectedDate = $bindable(),
		isSidebarOpen = $bindable(true),
		hoursByTaskAndDate,
		targetHoursPerDay = 8,
		employeeId = 'david',
		userName = 'David Gordov',
		userRole = 'Дизайнер',
		userEmail = 'david@studio.com',
		avatarUrl = 'https://i.pravatar.cc/80?img=12',
		workspaceName = '',
		workspaceColor = '#28D059',
		interfaceLanguage = $bindable('ru'),
		workspaces = [] as { workspaceId: string; workspaceName: string; workspaceColor: string }[],
		currentWorkspaceId = '',
		onSwitchWorkspace = (_workspaceId: string) => {},
		interfaceLanguages = [] as { code: string; label: string }[],
		onRequestNewTask = () => {},
		onOpenSettings = (_tab: string) => {}
	}: {
		selectedDate: Date;
		isSidebarOpen?: boolean;
		hoursByTaskAndDate: HoursByTaskAndDate;
		targetHoursPerDay?: number;
		employeeId?: string;
		userName?: string;
		userRole?: string;
		userEmail?: string;
		avatarUrl?: string;
		workspaceName?: string;
		workspaceColor?: string;
		interfaceLanguage?: string;
		interfaceLanguages?: { code: string; label: string }[];
		workspaces?: { workspaceId: string; workspaceName: string; workspaceColor: string }[];
		currentWorkspaceId?: string;
		onSwitchWorkspace?: (workspaceId: string) => void;
		onRequestNewTask?: () => void;
		onOpenSettings?: (tab: string) => void;
	} = $props();

	const vacationDates = $derived(vacationDatesOf(employeeId));

	const hoursByDate = $derived(buildHoursByDate(hoursByTaskAndDate));

	function hoursLoggedOn(date: Date): number {
		return hoursByDate[toIsoDate(date)] ?? 0;
	}

	function isVacationDay(date: Date): boolean {
		return Boolean(vacationDates[toIsoDate(date)]);
	}

	function isPendingVacationDay(date: Date): boolean {
		return vacationDates[toIsoDate(date)] === 'pending';
	}

	function isWorkedVacationDay(date: Date): boolean {
		return isVacationDay(date) && hoursLoggedOn(date) > 0;
	}

	function dayFillColor(date: Date): string {
		return dayFillColorFor(hoursLoggedOn(date), targetHoursPerDay);
	}

	const weekDates = $derived(datesOfWeek(selectedDate));

	const totalHoursForWeek = $derived(sumHoursOnDates(hoursByTaskAndDate, weekDates));

	const expectedWeekHours = $derived(expectedHoursFor(weekDates, targetHoursPerDay));

	let isNotificationsOpen = $state(false);

	const unreadNotificationCount = $derived(unreadCountFor(employeeId));
	const myNotifications = $derived(notificationsFor(employeeId));

	function relativeTime(createdAt: string): string {
		const minutes = Math.round((Date.now() - new Date(createdAt).getTime()) / 60000);
		if (minutes < 60) return `${Math.max(minutes, 1)} мин назад`;
		if (minutes < 60 * 24) return `${Math.round(minutes / 60)} ч назад`;
		return `${Math.round(minutes / (60 * 24))} дн назад`;
	}

	function toggleNotifications() {
		isNotificationsOpen = !isNotificationsOpen;
		if (isNotificationsOpen) markNotificationsRead(employeeId);
	}

	function openNewTaskModal() {
		onRequestNewTask();
	}

	function openSettingsAt(tab: string) {
		isUserMenuOpen = false;
		onOpenSettings(tab);
	}

	// Workspaces — only one for now, but the shape is here for later.
	let isUserMenuOpen = $state(false);

	const nextVacation = $derived(nextVacationOf(employeeId));

	const daysUntilVacation = $derived.by(() => {
		if (!nextVacation) return null;
		const startsOn = new Date(`${nextVacation.fromDate}T00:00:00`);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return Math.max(Math.round((startsOn.getTime() - today.getTime()) / 86400000), 0);
	});

	// --- Asking for time off ---

	let isVacationFormOpen = $state(false);
	let vacationFromDate = $state('');
	let vacationToDate = $state('');

	function submitVacationRequest() {
		requestVacation(employeeId, vacationFromDate, vacationToDate);
		isVacationFormOpen = false;
		vacationFromDate = '';
		vacationToDate = '';
	}

	// The calendar scrolls through a range of months around the selected one.
	const calendarMonthsBeforeAndAfter = 6;

	const calendarMonths = $derived.by(() => {
		const anchorMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
		return Array.from({ length: calendarMonthsBeforeAndAfter * 2 + 1 }, (_, offsetIndex) => {
			const monthStart = new Date(
				anchorMonth.getFullYear(),
				anchorMonth.getMonth() + offsetIndex - calendarMonthsBeforeAndAfter,
				1
			);
			const gridStart = toMondayOfWeek(monthStart);
			return {
				monthStart,
				monthKey: `${monthStart.getFullYear()}-${monthStart.getMonth()}`,
				dates: Array.from({ length: 42 }, (_, cellIndex) => addDays(gridStart, cellIndex))
			};
		});
	});

	let calendarScrollElement = $state<HTMLDivElement | null>(null);

	function scrollCalendarToSelectedMonth() {
		const monthKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}`;
		const monthElement = calendarScrollElement?.querySelector(`[data-month-key="${monthKey}"]`);
		monthElement?.scrollIntoView({ block: 'start', behavior: 'smooth' });
	}

	// Keep the scrolled calendar showing the month that is selected.
	let lastScrolledMonthKey = '';

	$effect(() => {
		const monthKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}`;
		if (monthKey === lastScrolledMonthKey || !calendarScrollElement) return;
		lastScrolledMonthKey = monthKey;
		scrollCalendarToSelectedMonth();
	});

	function goToPreviousMonth() {
		selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
	}

	function goToNextMonth() {
		selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
	}

	const gaugeArcPath = 'M 8 52 A 42 42 0 0 1 92 52';
	const gaugeArcLength = Math.PI * 42;

	function gaugeFillOffset(logged: number, expected: number): number {
		const ratio = expected === 0 ? 0 : Math.min(logged / expected, 1);
		return gaugeArcLength * (1 - ratio);
	}

	// Hours past the quota stack as darker layers, same idea as the day bars.
	function gaugeOvertimeOffsets(logged: number, expected: number): number[] {
		if (expected === 0) return [];
		return [1, 2]
			.map((layerIndex) => Math.min(Math.max(logged - expected * layerIndex, 0) / expected, 1))
			.filter((layerRatio) => layerRatio > 0)
			.map((layerRatio) => gaugeArcLength * (1 - layerRatio));
	}

	function gaugeColor(logged: number, expected: number): string {
		if (expected === 0) return '#d0d0d0';
		const ratio = logged / expected;
		if (ratio >= 1) return '#28d059';
		if (ratio >= 0.75) return '#ffd73b';
		return '#e46f86';
	}

	const loggedMonthHours = $derived.by(() => {
		const monthPrefix = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-`;
		return Object.entries(hoursByDate)
			.filter(([isoDate]) => isoDate.startsWith(monthPrefix))
			.reduce((sum, [, hours]) => sum + hours, 0);
	});

	const expectedMonthHours = $derived(
		expectedHoursFor(datesOfMonth(selectedDate), targetHoursPerDay)
	);

	// Same norm, but only up to today — "am I behind right now".
	const expectedHoursUntilToday = $derived.by(() => {
		const today = new Date();
		const daysSoFar = datesOfMonth(selectedDate).filter((date) => date <= today);
		return expectedHoursFor(daysSoFar, targetHoursPerDay);
	});

	function dayFillRatio(date: Date): number {
		return Math.min(hoursLoggedOn(date) / targetHoursPerDay, 1);
	}
</script>

<aside class="sidebar">
	<div class="sidebar-header">
		<button class="icon-button" onclick={() => (isSidebarOpen = !isSidebarOpen)} title="Меню">
			<span class="menu-icon"></span>
		</button>

		<button class="sidebar-add-task-button" onclick={() => openNewTaskModal()}>
			<span class="add-task-label">+ Новая задача</span>
			<span class="keystroke-hint">⌘K</span>
		</button>

		<div class="notifications-anchor">
			<button
				class="icon-button"
				title="Уведомления"
				onclick={(event) => {
					event.stopPropagation();
					toggleNotifications();
				}}
			>
				<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
					<path
						d="M4 6.5a4 4 0 0 1 8 0c0 3 1 4 1 4H3s1-1 1-4Z"
						fill="none"
						stroke="currentColor"
						stroke-width="1.4"
						stroke-linejoin="round"
					/>
					<path d="M6.5 13a1.6 1.6 0 0 0 3 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
				</svg>
				{#if unreadNotificationCount > 0}
					<span class="notifications-badge">{unreadNotificationCount}</span>
				{/if}
			</button>

			{#if isNotificationsOpen}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div class="notifications-panel" onclick={(event) => event.stopPropagation()}>
					{#each myNotifications as notification (notification.notificationId)}
						<div class="notification-item" class:is-unread={!notification.isRead}>
							<span class="notification-text">{notification.notificationText}</span>
							<span class="notification-time">{relativeTime(notification.createdAt)}</span>
						</div>
					{:else}
						<div class="notification-empty">Пока ничего нового</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#snippet loadGauge(title: string, logged: number, expected: number)}
		<div class="load-gauge">
			<svg viewBox="0 0 100 60" aria-hidden="true">
				<path d={gaugeArcPath} class="gauge-track" />
				<path
					d={gaugeArcPath}
					class="gauge-fill"
					style="stroke: {gaugeColor(logged, expected)};
					       stroke-dasharray: {gaugeArcLength};
					       stroke-dashoffset: {gaugeFillOffset(logged, expected)}"
				/>
				{#each gaugeOvertimeOffsets(logged, expected) as layerOffset}
					<path
						d={gaugeArcPath}
						class="gauge-overtime"
						style="stroke-dasharray: {gaugeArcLength}; stroke-dashoffset: {layerOffset}"
					/>
				{/each}
			</svg>

			<div class="load-gauge-value">
				<strong>{formatHours(logged)}</strong>
				<span>из {formatHours(expected)} ч</span>
			</div>
			<div class="load-gauge-title">{title}</div>
		</div>
	{/snippet}

	<div class="month-load">
		<div class="load-gauges">
			{@render loadGauge('Неделя', totalHoursForWeek, expectedWeekHours)}
			{@render loadGauge('Месяц', loggedMonthHours, expectedMonthHours)}
		</div>

		<div class="month-load-caption">
			К сегодня ожидается {expectedHoursUntilToday} ч
		</div>
	</div>

	<div class="sidebar-card calendar-card">
		<div class="calendar-header">
			<button class="icon-button" onclick={goToPreviousMonth} title="Прошлый месяц">‹</button>
			<button
				class="calendar-month-name"
				title="К текущему месяцу"
				onclick={scrollCalendarToSelectedMonth}
			>
				{monthNames[selectedDate.getMonth()]}
				<span class="calendar-year">{selectedDate.getFullYear()}</span>
			</button>
			<button class="icon-button" onclick={goToNextMonth} title="Следующий месяц">›</button>
		</div>

		<div class="calendar-weekdays">
			{#each weekDayNames as weekDayName, weekDayIndex}
				<div class="calendar-weekday" class:is-weekend={weekDayIndex >= 5}>{weekDayName}</div>
			{/each}
		</div>

		<div class="calendar-block">
			<div class="calendar-scroll" bind:this={calendarScrollElement}>
				{#each calendarMonths as calendarMonth (calendarMonth.monthKey)}
					<div class="calendar-month" data-month-key={calendarMonth.monthKey}>
						<div class="calendar-month-label">
							{monthNames[calendarMonth.monthStart.getMonth()]}
							{calendarMonth.monthStart.getFullYear()}
						</div>
					<div class="calendar-grid">
						{#each calendarMonth.dates as monthDate}
							{#if monthDate.getMonth() === calendarMonth.monthStart.getMonth()}
								<button
									class="calendar-day"
									class:is-weekend={isWeekend(monthDate)}
									class:is-empty={hoursLoggedOn(monthDate) === 0}
									class:is-vacation={isVacationDay(monthDate)}
									class:is-vacation-pending={isPendingVacationDay(monthDate)}
									class:is-worked-vacation={isWorkedVacationDay(monthDate)}
									class:is-selected={isSameDay(monthDate, selectedDate)}
									class:is-today={isSameDay(monthDate, new Date())}
									class:is-full={hoursLoggedOn(monthDate) >= targetHoursPerDay}
									class:is-partial={hoursLoggedOn(monthDate) > 0 &&
										hoursLoggedOn(monthDate) < targetHoursPerDay}
									onclick={() => (selectedDate = monthDate)}
								>
									<span
										class="calendar-day-fill"
										style="height: {dayFillRatio(monthDate) * 100}%; background: {dayFillColor(monthDate)}"
									></span>
									<span class="calendar-day-number">{monthDate.getDate()}</span>
								</button>
							{:else}
								<span class="calendar-day-blank"></span>
							{/if}
						{/each}
					</div>
					</div>
			{/each}
			</div>
		</div>

		<div class="vacation-counter">
			<span class="vacation-dot" class:is-pending={nextVacation?.status === 'pending'}></span>
			{#if daysUntilVacation === null}
				<span>Отпуск не запланирован</span>
			{:else if daysUntilVacation === 0}
				<span>Отпуск {nextVacation?.status === 'pending' ? 'запрошен с сегодня' : 'начинается сегодня'}</span>
			{:else}
				<span>
					{nextVacation?.status === 'pending' ? 'Заявка на отпуск через' : 'До отпуска'}
					<strong>{daysUntilVacation}</strong> дн.
				</span>
			{/if}
			<button
				class="vacation-request-button"
				title="Запросить отпуск"
				onclick={() => (isVacationFormOpen = !isVacationFormOpen)}
			>
				{isVacationFormOpen ? '×' : '+'}
			</button>
		</div>

		{#if isVacationFormOpen}
			<div class="vacation-form">
				<input class="vacation-date-input" type="date" bind:value={vacationFromDate} />
				<input class="vacation-date-input" type="date" bind:value={vacationToDate} />
				<button
					class="vacation-submit-button"
					disabled={!vacationFromDate || !vacationToDate || vacationToDate < vacationFromDate}
					onclick={submitVacationRequest}
				>
					Запросить
				</button>
			</div>
		{/if}

	</div>
	<div class="user-area">
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			class="sidebar-footer"
			class:is-open={isUserMenuOpen}
			onclick={(event) => {
				event.stopPropagation();
				isUserMenuOpen = !isUserMenuOpen;
			}}
		>
			<img class="avatar" src={avatarUrl} alt={userName} />
			<div class="user-details">
				<span class="user-name">{userName}</span>
				<span class="user-workspace">
					<span class="project-dot" style="background: {workspaceColor}"></span>
					{workspaceName}
				</span>
			</div>
			<span class="user-caret" class:is-open={isUserMenuOpen}>
				<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
					<path d="M4 6.5 8 10.5l4-4" fill="none" stroke="currentColor" stroke-width="1.7"
						stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</span>
		</div>

		{#if isUserMenuOpen}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div class="user-menu" onclick={(event) => event.stopPropagation()}>
				<div class="user-menu-header">
					<img class="avatar" src={avatarUrl} alt="" />
					<div class="user-details">
						<span class="user-name">{userName}</span>
						<span class="user-role">{userEmail}</span>
					</div>
				</div>

				<div class="user-menu-section">
					<button onclick={() => openSettingsAt('account')}>
						<span class="user-menu-icon">☺</span> Аккаунт
					</button>
					<button onclick={() => openSettingsAt('appearance')}>
						<span class="user-menu-icon">◐</span> Оформление
					</button>
					<button onclick={() => openSettingsAt('workspaces')}>
						<span class="user-menu-icon">▦</span> Пространства
					</button>
				</div>

				<div class="user-menu-section">
					<div class="user-menu-label">Язык <span class="soon-tag">позже</span></div>
					<div class="language-switch">
						{#each interfaceLanguages as language}
							<button
								class:is-active={interfaceLanguage === language.code}
								onclick={() => (interfaceLanguage = language.code)}
							>
								{language.label}
							</button>
						{/each}
					</div>
				</div>

				{#if workspaces.length > 1}
					<div class="user-menu-section">
						<div class="user-menu-label">Пространство</div>
						{#each workspaces as workspace (workspace.workspaceId)}
							<button onclick={() => onSwitchWorkspace(workspace.workspaceId)}>
								<span class="project-dot" style="background: {workspace.workspaceColor}"></span>
								{workspace.workspaceName}
							</button>
						{/each}
					</div>
				{/if}

				<div class="user-menu-section">
					<a class="is-quiet user-menu-link" href="/login">Выйти</a>
				</div>
			</div>
		{/if}
	</div>
</aside>

<style>





	.notifications-anchor {
		position: relative;
	}

	.notifications-badge {
		position: absolute;
		top: -0.25rem;
		right: -0.25rem;
		min-width: 1rem;
		height: 1rem;
		padding: 0 0.1875rem;
		border-radius: 999px;
		background: var(--color-weekend);
		color: #ffffff;
		font-size: 0.625rem;
		display: grid;
		place-items: center;
	}

	.notifications-panel {
		position: absolute;
		top: calc(100% + 0.375rem);
		right: 0;
		z-index: 40;
		width: 15rem;
		max-height: 16rem;
		overflow-y: auto;
		padding: 0.375rem;
		border-radius: 0.625rem;
		background: var(--color-panel);
		color: var(--color-text);
		box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 0.25);
	}

	.notification-item,
	.notification-empty {
		padding: 0.4375rem 0.5rem;
		font-size: 0.75rem;
		line-height: 1.35;
	}

	.notification-item {
		display: flex;
		flex-direction: column;
		gap: 0.1875rem;
	}

	.notification-item.is-unread .notification-text {
		font-weight: 500;
	}

	.notification-item.is-unread {
		background: var(--color-cell-tint);
		border-radius: 0.375rem;
	}

	.notification-time {
		color: var(--color-text-muted);
		font-size: 0.6875rem;
	}

	.notification-item + .notification-item {
		border-top: 1px solid var(--color-border);
	}

	.notification-empty {
		color: var(--color-text-muted);
	}


	:global(.is-sidebar-collapsed) .sidebar > *:not(.sidebar-header) {
		display: none;
	}

	/* Collapsed sidebar keeps the menu and the add button, nothing else. */

	:global(.is-sidebar-collapsed) .sidebar-header {
		flex-direction: column;
		gap: 0.5rem;
	}

	:global(.is-sidebar-collapsed) .sidebar-header .add-task-label,
	:global(.is-sidebar-collapsed) .sidebar-header .keystroke-hint {
		display: none;
	}

	:global(.is-sidebar-collapsed) .sidebar-header .sidebar-add-task-button {
		flex: none;
		width: 1.875rem;
		height: 1.875rem;
		padding: 0;
		justify-content: center;
	}

	:global(.is-sidebar-collapsed) .sidebar-header .sidebar-add-task-button::after {
		content: '+';
		font-size: 1rem;
	}
	.sidebar {
		position: relative;
		order: 2;
		overflow-y: auto;
		scrollbar-width: none;
		display: flex;
		flex-direction: column;
		gap: 1.125rem;
		padding: 0.875rem;
		color: var(--color-text-on-shell);
		overflow: hidden;
	}
	.sidebar-header,
	.sidebar-footer {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.sidebar-header {
		justify-content: space-between;
	}
	.sidebar-footer {
		margin-top: auto;
	}
	.menu-icon,
	.menu-icon::before,
	.menu-icon::after {
		display: block;
		width: 0.875rem;
		height: 1.5px;
		background: currentColor;
	}
	.menu-icon::before,
	.menu-icon::after {
		content: '';
		position: relative;
		top: -0.3125rem;
	}
	.menu-icon::after {
		top: 0.2188rem;
	}
	.calendar-header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}
	.calendar-month-name {
		flex: 1;
		text-align: center;
		font-size: 0.8125rem;
		border: 0;
		background: none;
		color: inherit;
		font-family: inherit;
		/* same box as the arrow buttons next to it */
		height: 1.875rem;
		padding: 0 0.375rem;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background 0.12s ease;
	}
	.calendar-month-name:hover {
		background: #1c1c1c;
	}
	.calendar-year {
		color: var(--color-text-muted);
		margin-left: 0.25rem;
	}
	.calendar-weekdays,
	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}
	.calendar-weekday {
		text-align: center;
		font-size: 0.6875rem;
		color: #6b6b6b;
		padding-bottom: 2px;
	}
	/* Months scroll inside the sidebar; the selected one is scrolled into view. */
	.calendar-scroll {
		max-height: clamp(7rem, 17vh, 12rem);
		overflow-y: auto;
		scrollbar-width: none;
		scroll-behavior: smooth;
		padding-bottom: 0.5rem;
	}
	.calendar-scroll::-webkit-scrollbar {
		display: none;
	}
	.calendar-month + .calendar-month {
		margin-top: 0.625rem;
	}
	.calendar-month-label {
		font-size: 0.6875rem;
		color: var(--color-text-muted);
		padding: 0.25rem 0 0.375rem;
	}
	.calendar-day {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		/* Fixed square so no day is taller than its neighbours. */
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		line-height: 1;
		border: 0;
		background: transparent;
		color: var(--color-text-on-shell);
		border-radius: 0.4375rem;
		padding: 0;
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		transition: background 0.12s ease;
	}
	/* Fill grows from the bottom: how much of the 8 hours is logged. */
	.calendar-day-fill {
		position: absolute;
		inset: auto 0 0 0;
		z-index: -1;
		transition: height 0.18s ease;
	}
	.calendar-day-number {
		position: relative;
	}
	.calendar-day.is-full .calendar-day-number {
		color: var(--color-day-full-text);
	}
	.calendar-day.is-partial .calendar-day-number {
		color: var(--color-day-partial-text);
	}
	.calendar-day:hover {
		background: #1c1c1c;
	}
	/* Weekends are quiet grey, not an alarm. */
	.calendar-day.is-weekend .calendar-day-number {
		color: #7a7a7a;
	}
	.calendar-day.is-today {
		outline: 1.5px solid #f0f0f0;
		outline-offset: -1.5px;
	}
	.calendar-day.is-selected {
		background: var(--color-panel);
	}
	.calendar-day.is-selected .calendar-day-number {
		color: var(--color-text);
	}
	.avatar {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: #3a3a3a;
		object-fit: cover;
		flex: none;
	}
	.user-details {
		display: flex;
		flex-direction: column;
		line-height: 1.25;
		min-width: 0;
	}
	.user-name {
		font-size: 0.8125rem;
	}
	.user-role {
		font-size: 0.6875rem;
		color: var(--color-text-muted);
	}
	/* A day with nothing logged reads as a day off, in every view. */
	.calendar-day.is-empty .calendar-day-number {
		opacity: 0.4;
	}
	/* Vacation */
	.calendar-day.is-vacation {
		background: var(--color-vacation);
	}
	.calendar-day.is-vacation .calendar-day-number {
		color: var(--color-panel);
		opacity: 1;
	}
	/* Worked during vacation — outlined so it stands out. */
	.calendar-day.is-worked-vacation {
		outline: 1.5px solid var(--color-day-full-text);
		outline-offset: -1.5px;
	}
	.vacation-counter {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		margin-top: -0.5rem;
		font-size: 0.6875rem;
		color: var(--color-text-muted);
	}
	/* Striped while the boss has not answered yet — same language as the team grid. */
	.calendar-day.is-vacation-pending {
		background: repeating-linear-gradient(
			45deg,
			var(--color-vacation) 0 0.25rem,
			transparent 0.25rem 0.5rem
		);
	}
	.vacation-request-button {
		margin-left: auto;
		border: 0;
		border-radius: 0.375rem;
		background: none;
		color: inherit;
		padding: 0 0.25rem;
		font: inherit;
		font-size: 0.875rem;
		line-height: 1;
		cursor: pointer;
	}
	.vacation-request-button:hover {
		background: #1c1c1c;
	}
	.vacation-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: -0.25rem;
	}
	.vacation-date-input {
		flex: 1;
		min-width: 6.5rem;
		border: 1px solid #2a2a2a;
		border-radius: 0.4375rem;
		background: #101010;
		color: var(--color-text-on-shell);
		padding: 0.25rem 0.375rem;
		font: inherit;
		font-size: 0.6875rem;
	}
	.vacation-submit-button {
		width: 100%;
		border: 0;
		border-radius: 0.4375rem;
		background: var(--color-panel);
		color: var(--color-text);
		padding: 0.3125rem;
		font: inherit;
		font-size: 0.6875rem;
		cursor: pointer;
	}
	.vacation-submit-button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.vacation-dot.is-pending {
		background: none;
		box-shadow: inset 0 0 0 1.5px var(--color-vacation-strong);
	}
	.vacation-dot {
		width: 0.4375rem;
		height: 0.4375rem;
		border-radius: 50%;
		background: var(--color-vacation-strong);
		flex: none;
	}
	.calendar-day-blank {
		aspect-ratio: 1;
	}
	/* One easing everywhere, so interactions feel like one system. */
	.icon-button:hover,
	.sidebar-add-task-button:hover {
		background: #363636;
	}
	/* Sidebar header holds the menu and the add button. */
	.sidebar-header {
		align-items: center;
	}
	.sidebar-header .sidebar-add-task-button {
		flex: 1;
	}
	/* User area */
	.user-area {
		position: relative;
		margin-top: auto;
	}
	.sidebar-footer {
		width: 100%;
		padding: 0.5rem;
		border-radius: 0.625rem;
		cursor: pointer;
		transition: background 0.14s cubic-bezier(0.33, 1, 0.68, 1);
	}
	.sidebar-footer:hover,
	.sidebar-footer.is-open {
		background: #1c1c1c;
	}
	.user-workspace {
		display: flex;
		align-items: center;
		gap: 0.3125rem;
		font-size: 0.6875rem;
		color: var(--color-text-muted);
	}
	.user-caret {
		margin-left: auto;
		color: var(--color-text-muted);
		transition: transform 0.16s cubic-bezier(0.33, 1, 0.68, 1);
	}
	.user-caret.is-open {
		transform: rotate(180deg);
	}
	.user-menu {
		position: absolute;
		bottom: calc(100% + 0.5rem);
		left: 0;
		right: 0;
		z-index: 60;
		background: #262626;
		border: 1px solid #363636;
		border-radius: 0.875rem;
		padding: 0.375rem;
		box-shadow: 0 1rem 2.5rem rgb(0 0 0 / 0.45);
		animation: panel-in 0.16s cubic-bezier(0.33, 1, 0.68, 1);
	}
	.user-menu-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
	}
	.user-menu-section {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 0.25rem 0;
		border-top: 1px solid #363636;
	}
	.user-menu-label {
		padding: 0.375rem 0.5rem 0.25rem;
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #7a7a7a;
	}
	.user-menu-section .user-menu-link,
	.user-menu-section button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border: 0;
		background: none;
		color: var(--color-text-on-shell);
		padding: 0.5rem;
		border-radius: 0.5rem;
		font: inherit;
		font-size: 0.8125rem;
		text-align: left;
		cursor: pointer;
		transition: background 0.12s ease;
	}
	.user-menu-link {
		text-decoration: none;
	}
	.user-menu-section button:hover:not(:disabled),
	.user-menu-link:hover {
		background: #333333;
	}
	.user-menu-section button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	/* Dark chrome needs its own tag colours. */
	.user-menu-label .soon-tag {
		border-color: #3a3a3a;
		background: #1f1f1f;
		color: #8f8f8f;
	}
	.user-menu-section .is-quiet {
		color: #9a9a9a;
	}
	.user-menu-icon {
		width: 1rem;
		text-align: center;
		color: #9a9a9a;
	}
	.language-switch {
		display: flex;
		gap: 0.25rem;
		padding: 0 0.25rem 0.25rem;
	}
	.language-switch button {
		flex: 1;
		justify-content: center;
		background: #1f1f1f;
	}
	.language-switch button.is-active {
		background: var(--color-panel);
		color: var(--color-text);
	}
	.sidebar::-webkit-scrollbar {
		display: none;
	}
	/* The dial's heat gradient, turned on its side along the sidebar edge. */
	/* Elapsed time fills the notch band rather than drawing a line of its own. */
	.calendar-block {
		position: relative;
	}
	/* Each sidebar block is its own card rather than a line-separated section. */
	.sidebar-card,
	.month-load {
		background: #171717;
		border-radius: 0.875rem;
		padding: 0.75rem;
	}
	.sidebar-card {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.sidebar-footer {
		background: #171717;
	}
	/* Hovering any cell lights the whole day column. */
	/* Column hover is a whisper; the cell itself gets the accent. */
	.month-load {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	/* Grey marker = what should be done by today, green = what is done. */
	/* Two half-ellipse gauges: the week on the left, the month on the right. */
	.load-gauges {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.load-gauge {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.load-gauge svg {
		width: 100%;
		height: auto;
	}
	.gauge-track,
	.gauge-fill,
	.gauge-overtime {
		fill: none;
		stroke-width: 9;
		stroke-linecap: round;
	}
	.gauge-track {
		stroke: #242424;
	}
	.gauge-fill {
		transition: stroke-dashoffset 0.3s cubic-bezier(0.33, 1, 0.68, 1);
	}
	/* Each layer past the quota darkens what is already there. */
	.gauge-overtime {
		stroke: rgb(0 0 0 / 0.4);
	}
	.load-gauge-value {
		position: absolute;
		top: 48%;
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.1;
	}
	.load-gauge-value strong {
		font-size: 1.0625rem;
		color: var(--color-text-on-shell);
		font-variant-numeric: tabular-nums;
	}
	.load-gauge-value span {
		font-size: 0.625rem;
		color: var(--color-text-muted);
	}
	.load-gauge-title {
		margin-top: 0.375rem;
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
	}
	.month-load-caption {
		text-align: center;
		font-size: 0.6875rem;
		color: var(--color-text-muted);
	}
	.sidebar-add-task-button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border: 0;
		border-radius: 0.5625rem;
		background: #1c1c1c;
		color: var(--color-text-on-shell);
		padding: 0.5rem 0.625rem;
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
	}
	.keystroke-hint {
		color: #7a7a7a;
		font-size: 0.6875rem;
	}
</style>
