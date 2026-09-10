<script lang="ts">
	// Prototype only — fake data, no database yet.

	type Task = { taskId: string; taskTitle: string; taskDescription: string };
	type ProjectWithTasks = {
		projectId: string;
		projectName: string;
		projectColor: string;
		tasks: Task[];
	};

	const weekDayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
	const monthNames = [
		'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
		'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
	];

	let projectsWithTasks = $state<ProjectWithTasks[]>([
		{
			projectId: 'qqbet',
			projectName: 'QQbet',
			projectColor: '#28D059',
			tasks: [
				{ taskId: 'logo', taskTitle: 'Создание логотипа для нового продукта', taskDescription: '' },
				{ taskId: 'ui', taskTitle: 'Разработка пользовательского интерфейса', taskDescription: '' },
				{
					taskId: 'spin-assets',
					taskTitle: 'Собрать ассеты для Жени в Spin Wheel',
					taskDescription: '– Подготовить изображения для Spin Wheel page\n– Изображения для pop-up'
				},
				{
					taskId: 'jackpot',
					taskTitle: 'Jackpot landing page',
					taskDescription: '– Сделать правки на 2 страницах'
				}
			]
		},
		{
			projectId: 'back-office',
			projectName: 'Back Office',
			projectColor: '#8A38F5',
			tasks: [
				{
					taskId: 'notifications',
					taskTitle: 'Переработка таблицы Notification',
					taskDescription: '– Создание упрощённой итерации на основе компонентов'
				},
				{ taskId: 'daily', taskTitle: 'Созвон – Daily QQ.bet', taskDescription: '' }
			]
		},
		{
			projectId: 'cyberus',
			projectName: 'Сайберус',
			projectColor: '#E46F86',
			tasks: [
				{
					taskId: 'bonus-iterations',
					taskTitle: 'Bonus Iterations (повторение бонусных кампаний)',
					taskDescription: '– Проработка 3х итераций настройки\n– Презентация решения, обсуждение'
				}
			]
		},
		{
			projectId: 'radiance',
			projectName: 'Radiance',
			projectColor: '#FFD73B',
			tasks: [{ taskId: 'call-nastya', taskTitle: 'Созвон – Настя + Давид', taskDescription: '' }]
		},
		{ projectId: 'otoswap', projectName: 'Otoswap', projectColor: '#3C65E7', tasks: [] },
		{ projectId: 'lead-junkies', projectName: 'Lead Junkies', projectColor: '#DC3FB2', tasks: [] }
	]);

	const projectColorPalette = [
		'#28D059',
		'#8A38F5',
		'#E46F86',
		'#FFD73B',
		'#3C65E7',
		'#DC3FB2',
		'#B1B1B1'
	];

	// --- Editing tasks and projects ---

	let editingTaskId = $state<string | null>(null);

	// A task cell is one block of text: first line is the title, the rest is content.
	function taskFullText(task: Task): string {
		return task.taskDescription ? `${task.taskTitle}\n${task.taskDescription}` : task.taskTitle;
	}

	function setTaskFullText(task: Task, fullText: string) {
		const [firstLine, ...restLines] = fullText.split('\n');
		task.taskTitle = firstLine;
		task.taskDescription = restLines.join('\n');
	}

	// --- Dragging a task into another project ---

	let draggedTaskId = $state<string | null>(null);
	let dragOverProjectId = $state<string | null>(null);

	function handleTaskDrop(targetProjectId: string) {
		if (draggedTaskId) moveTaskToProject(draggedTaskId, targetProjectId);
		draggedTaskId = null;
		dragOverProjectId = null;
	}

	// Day column the pointer is over, so the whole column can light up.
	let hoveredDayIndex = $state<number | null>(null);

	function addTask(projectId: string, taskTitle: string) {
		const project = projectsWithTasks.find((candidate) => candidate.projectId === projectId);
		if (!project || !taskTitle.trim()) return;
		project.tasks.push({
			taskId: crypto.randomUUID(),
			taskTitle: taskTitle.trim(),
			taskDescription: ''
		});
	}

	function moveTaskToProject(taskId: string, targetProjectId: string) {
		const sourceProject = projectsWithTasks.find((project) =>
			project.tasks.some((task) => task.taskId === taskId)
		);
		const targetProject = projectsWithTasks.find(
			(project) => project.projectId === targetProjectId
		);
		if (!sourceProject || !targetProject || sourceProject === targetProject) return;

		const taskIndex = sourceProject.tasks.findIndex((task) => task.taskId === taskId);
		const [movedTask] = sourceProject.tasks.splice(taskIndex, 1);
		targetProject.tasks.push(movedTask);
	}

	function projectIdOfTask(taskId: string): string {
		return (
			projectsWithTasks.find((project) => project.tasks.some((task) => task.taskId === taskId))
				?.projectId ?? ''
		);
	}

	let newProjectName = $state('');
	let isAddingProject = $state(false);

	function addProject() {
		if (!newProjectName.trim()) return;
		projectsWithTasks.push({
			projectId: crypto.randomUUID(),
			projectName: newProjectName.trim(),
			projectColor: projectColorPalette[projectsWithTasks.length % projectColorPalette.length],
			tasks: []
		});
		newProjectName = '';
		isAddingProject = false;
	}

	function removeProject(projectId: string) {
		projectsWithTasks = projectsWithTasks.filter((project) => project.projectId !== projectId);
	}

	// Inline "+ Задача" row: which project is currently typing a new task.
	let addingTaskProjectId = $state<string | null>(null);
	let inlineNewTaskTitle = $state('');

	function confirmInlineNewTask(projectId: string) {
		addTask(projectId, inlineNewTaskTitle);
		inlineNewTaskTitle = '';
	}

	// --- New task modal (Cmd/Ctrl+K) ---

	let isNewTaskModalOpen = $state(false);
	let newTaskTitle = $state('');
	let newTaskProjectId = $state('');

	function openNewTaskModal(projectId?: string) {
		newTaskProjectId = projectId ?? projectsWithTasks[0]?.projectId ?? '';
		newTaskTitle = '';
		isNewTaskModalOpen = true;
	}

	function confirmNewTask() {
		addTask(newTaskProjectId, newTaskTitle);
		isNewTaskModalOpen = false;
	}

	function handleGlobalKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			openNewTaskModal();
		}
		if (event.key === 'Escape') isNewTaskModalOpen = false;
	}

	// Hours per cell, keyed "taskId:dayIndex". Empty string = nothing logged.
	let hoursByCell = $state<Record<string, string>>({
		'logo:2': '2',
		'bonus-iterations:0': '5',
		'bonus-iterations:1': '2,5',
		'spin-assets:1': '1',
		'notifications:1': '2,5',
		'jackpot:0': '3',
		'call-nastya:0': '1'
	});

	let isSidebarOpen = $state(true);
	let isTableMenuOpen = $state(false);
	let selectedDate = $state(new Date(2025, 6, 14));

	function toMondayOfWeek(date: Date): Date {
		const monday = new Date(date);
		const weekDayStartingMonday = (date.getDay() + 6) % 7;
		monday.setDate(date.getDate() - weekDayStartingMonday);
		return monday;
	}

	function addDays(date: Date, dayCount: number): Date {
		const shifted = new Date(date);
		shifted.setDate(date.getDate() + dayCount);
		return shifted;
	}

	function isSameDay(first: Date, second: Date): boolean {
		return first.toDateString() === second.toDateString();
	}

	function isInSelectedWeek(date: Date): boolean {
		return isSameDay(toMondayOfWeek(date), toMondayOfWeek(selectedDate));
	}

	function isWeekend(date: Date): boolean {
		return date.getDay() === 0 || date.getDay() === 6;
	}

	// Fake: days that already have logged hours, shown as a dot in the calendar.
	const datesWithLoggedHours = ['2025-07-14', '2025-07-15', '2025-07-16', '2025-07-09', '2025-07-22'];

	function toIsoDate(date: Date): string {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	}

	function hasLoggedHours(date: Date): boolean {
		return datesWithLoggedHours.includes(toIsoDate(date));
	}

	// "Июль Н3" — month of the week's Monday plus its week number inside that month.
	const selectedWeekLabel = $derived.by(() => {
		const monday = toMondayOfWeek(selectedDate);
		const weekNumberInMonth = Math.ceil(monday.getDate() / 7);
		return `${monthNames[monday.getMonth()]} Н${weekNumberInMonth}`;
	});

	const visibleWeekDates = $derived(
		Array.from({ length: 7 }, (_, dayIndex) => addDays(toMondayOfWeek(selectedDate), dayIndex))
	);

	// Month grid for the sidebar calendar, always 6 rows starting on Monday.
	const visibleMonthDates = $derived.by(() => {
		const firstOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
		const gridStart = toMondayOfWeek(firstOfMonth);
		return Array.from({ length: 42 }, (_, cellIndex) => addDays(gridStart, cellIndex));
	});

	function goToPreviousWeek() {
		selectedDate = addDays(selectedDate, -7);
	}

	function goToNextWeek() {
		selectedDate = addDays(selectedDate, 7);
	}

	function goToToday() {
		selectedDate = new Date();
	}

	// --- Clock in the toolbar ---

	let currentTime = $state(new Date());

	$effect(() => {
		const tick = setInterval(() => (currentTime = new Date()), 1000);
		return () => clearInterval(tick);
	});

	const todayLabel = $derived(
		new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(
			currentTime
		)
	);

	const currentTimeLabel = $derived(
		new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(currentTime)
	);

	// getTimezoneOffset counts minutes behind UTC, so the sign is flipped.
	const timeZoneLabel = $derived.by(() => {
		const offsetMinutes = -currentTime.getTimezoneOffset();
		const sign = offsetMinutes < 0 ? '−' : '+';
		const hours = Math.floor(Math.abs(offsetMinutes) / 60);
		const minutes = Math.abs(offsetMinutes) % 60;
		return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
	});

	// --- Collapsible project groups ---

	let collapsedProjectIds = $state<string[]>([]);

	function toggleProjectCollapsed(projectId: string) {
		collapsedProjectIds = collapsedProjectIds.includes(projectId)
			? collapsedProjectIds.filter((id) => id !== projectId)
			: [...collapsedProjectIds, projectId];
	}

	// --- Resizable columns (widths in pixels, shared by both tables) ---

	let taskColumnWidth = $state(440);
	let dayColumnWidths = $state(Array(7).fill(96));

	const minimumTaskColumnWidth = 200;
	const minimumDayColumnWidth = 56;

	// The grid's own horizontal scrollbar is hidden. A strip under the hour columns
	// carries a real scrollbar instead, and the three elements share scrollLeft.
	let tableScrollElement = $state<HTMLDivElement | null>(null);
	let totalsScrollElement = $state<HTMLDivElement | null>(null);
	let scrollbarStripElement = $state<HTMLDivElement | null>(null);

	const totalDayColumnsWidth = $derived(
		dayColumnWidths.reduce((sum, columnWidth) => sum + columnWidth, 0)
	);

	// The strip is the only element that really scrolls sideways. The grid and the
	// totals are moved by it, so nothing can scroll back and fight it.
	function syncHorizontalScrollFromStrip() {
		if (!scrollbarStripElement) return;
		const scrollLeft = scrollbarStripElement.scrollLeft;
		if (tableScrollElement) tableScrollElement.scrollLeft = scrollLeft;
		if (totalsScrollElement) totalsScrollElement.scrollLeft = scrollLeft;
	}

	// Sideways wheel/trackpad over the grid is handed to the strip.
	function forwardHorizontalWheelToStrip(event: WheelEvent) {
		if (!scrollbarStripElement || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
		event.preventDefault();
		scrollbarStripElement.scrollLeft += event.deltaX;
	}

	function startColumnResize(event: PointerEvent, resizedColumn: 'task' | number) {
		event.preventDefault();
		const startPointerX = event.clientX;
		const isTaskColumn = resizedColumn === 'task';
		const startWidth = isTaskColumn ? taskColumnWidth : dayColumnWidths[resizedColumn as number];
		const minimumWidth = isTaskColumn ? minimumTaskColumnWidth : minimumDayColumnWidth;

		function handlePointerMove(moveEvent: PointerEvent) {
			const nextWidth = Math.max(minimumWidth, startWidth + moveEvent.clientX - startPointerX);
			if (isTaskColumn) taskColumnWidth = nextWidth;
			else dayColumnWidths[resizedColumn as number] = nextWidth;
		}

		function handlePointerUp() {
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerup', handlePointerUp);
		}

		window.addEventListener('pointermove', handlePointerMove);
		window.addEventListener('pointerup', handlePointerUp);
	}

	function parseHours(rawValue: string): number {
		return Number(rawValue.replace(',', '.')) || 0;
	}

	const totalsPerDay = $derived(
		weekDayNames.map((_, dayIndex) =>
			Object.entries(hoursByCell)
				.filter(([cellKey]) => cellKey.endsWith(`:${dayIndex}`))
				.reduce((sum, [, value]) => sum + parseHours(value), 0)
		)
	);

	const totalHoursForWeek = $derived(totalsPerDay.reduce((sum, dayTotal) => sum + dayTotal, 0));

	// Fake: hours logged in this month before the week on screen.
	const loggedHoursEarlierInMonth = 74;

	const loggedMonthHours = $derived(loggedHoursEarlierInMonth + totalHoursForWeek);

	const targetHoursPerDay = 8;

	// Expected load for the whole month: every weekday counts as a full day.
	function countWeekdaysBetween(fromDate: Date, toDate: Date): number {
		let weekdayCount = 0;
		for (let day = new Date(fromDate); day <= toDate; day.setDate(day.getDate() + 1)) {
			if (!isWeekend(day)) weekdayCount += 1;
		}
		return weekdayCount;
	}

	const expectedMonthHours = $derived.by(() => {
		const firstOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
		const lastOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
		return countWeekdaysBetween(firstOfMonth, lastOfMonth) * targetHoursPerDay;
	});

	const expectedHoursUntilToday = $derived.by(() => {
		const firstOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
		const today = new Date();
		if (today < firstOfMonth) return 0;
		const lastOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
		return countWeekdaysBetween(firstOfMonth, today < lastOfMonth ? today : lastOfMonth) * targetHoursPerDay;
	});

	const minimumHoursPerDay = 6;
	const workDaysPerWeek = 5;

	// Overtime stacks in 8-hour layers on top of the filled bar, 3 layers max (24h).
	const maxProgressLayers = 3;

	function overtimeLayerWidths(dayTotal: number): number[] {
		return Array.from({ length: maxProgressLayers - 1 }, (_, layerIndex) =>
			Math.min(
				Math.max(dayTotal - targetHoursPerDay * (layerIndex + 1), 0) / targetHoursPerDay,
				1
			)
		).filter((layerWidth) => layerWidth > 0);
	}

	// Red below the minimum, yellow between minimum and target, green at target.
	function progressColorForDay(dayTotal: number): string {
		if (dayTotal >= targetHoursPerDay) return '#28d059';
		if (dayTotal >= minimumHoursPerDay) return '#ffd73b';
		return '#e46f86';
	}
</script>

<svelte:window onclick={() => (isTableMenuOpen = false)} onkeydown={handleGlobalKeydown} />

<div class="app-layout" class:is-sidebar-collapsed={!isSidebarOpen}>
	<aside class="sidebar">
		<div class="sidebar-header">
			<button class="icon-button" onclick={() => (isSidebarOpen = !isSidebarOpen)} title="Меню">
				<span class="menu-icon"></span>
			</button>
			<span class="year-badge">{selectedDate.getFullYear()}</span>
		</div>

		<div class="calendar">
			{#each weekDayNames as weekDayName, weekDayIndex}
				<div class="calendar-weekday" class:is-weekend={weekDayIndex >= 5}>{weekDayName}</div>
			{/each}
			{#each visibleMonthDates as monthDate}
				<button
					class="calendar-day"
					class:is-outside-month={monthDate.getMonth() !== selectedDate.getMonth()}
					class:is-weekend={isWeekend(monthDate)}
					class:is-in-selected-week={isInSelectedWeek(monthDate)}
					class:is-selected={isSameDay(monthDate, selectedDate)}
					onclick={() => (selectedDate = monthDate)}
				>
					{monthDate.getDate()}
					{#if hasLoggedHours(monthDate)}
						<span class="logged-hours-dot"></span>
					{/if}
				</button>
			{/each}
		</div>

		<div class="sidebar-section-title">
			Проекты
			<button class="add-project-button" onclick={() => (isAddingProject = true)}>+</button>
		</div>

		<ul class="project-list">
			{#each projectsWithTasks as project (project.projectId)}
				<li class="project-chip" style="background: {project.projectColor}">
					{project.projectName}
					{#if project.tasks.length === 0}
						<button
							class="remove-project-button"
							title="Удалить проект"
							onclick={() => removeProject(project.projectId)}>×</button
						>
					{/if}
				</li>
			{/each}
		</ul>

		{#if isAddingProject}
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="new-project-input"
				placeholder="Название проекта"
				bind:value={newProjectName}
				autofocus
				onkeydown={(event) => {
					if (event.key === 'Enter') addProject();
					if (event.key === 'Escape') isAddingProject = false;
				}}
				onblur={addProject}
			/>
		{/if}

		<button class="sidebar-add-task-button" onclick={() => openNewTaskModal()}>
			+ Новая задача <span class="keystroke-hint">⌘K</span>
		</button>

		<div class="month-load">
			<div class="sidebar-section-title">Нагрузка за месяц</div>
			<div class="month-load-numbers">
				<strong>{loggedMonthHours}</strong>
				<span>из {expectedMonthHours} ч</span>
			</div>
			<div class="month-load-track">
				<div
					class="month-load-expected"
					style="width: {Math.min(expectedHoursUntilToday / expectedMonthHours, 1) * 100}%"
				></div>
				<div
					class="month-load-done"
					style="width: {Math.min(loggedMonthHours / expectedMonthHours, 1) * 100}%"
				></div>
			</div>
			<div class="month-load-caption">
				К сегодня ожидается {expectedHoursUntilToday} ч
			</div>
		</div>

		<div class="sidebar-footer">
			<img class="avatar" src="https://i.pravatar.cc/80?img=12" alt="David Gordov" />
			<div class="user-details">
				<span class="user-name">David Gordov</span>
				<span class="user-role">Дизайнер</span>
			</div>
			<button class="icon-button" title="Настройки">⚙</button>
		</div>
	</aside>

	<main class="week-grid">
		<div class="toolbar">
			<h1 class="today-heading">
				<span class="today-date">{todayLabel}</span>
				<span class="current-time">{currentTimeLabel}</span>
				<span class="time-zone-capsule">{timeZoneLabel}</span>
			</h1>

			<div class="week-switcher">
				<button class="icon-button-light" onclick={goToPreviousWeek}>‹</button>
				<span class="month-name">{selectedWeekLabel}</span>
				<button class="icon-button-light" onclick={goToNextWeek}>›</button>
				<button class="pill-button is-dark" onclick={goToToday}>Сегодня</button>
			</div>

			<div class="table-menu">
				<button
					class="pill-button"
					onclick={(event) => {
						event.stopPropagation();
						isTableMenuOpen = !isTableMenuOpen;
					}}
				>
					Таблица ▾
				</button>
				{#if isTableMenuOpen}
					<div class="table-menu-dropdown">
						<button>Импорт из Excel</button>
						<button>Экспорт в Excel</button>
					</div>
				{/if}
			</div>
		</div>

		{#snippet columnWidths()}
			<colgroup>
				<col style="width: {taskColumnWidth}px" />
				{#each dayColumnWidths as dayColumnWidth}
					<col style="width: {dayColumnWidth}px" />
				{/each}
			</colgroup>
		{/snippet}

		<div
			class="table-scroll-area"
			bind:this={tableScrollElement}
			onwheel={forwardHorizontalWheelToStrip}
		>
		<table>
			{@render columnWidths()}
			<thead>
				<tr>
					<th class="task-column">
						Задача
						<button
							class="column-resize-handle"
							aria-label="Изменить ширину колонки"
							onpointerdown={(event) => startColumnResize(event, 'task')}
						></button>
					</th>
					{#each visibleWeekDates as weekDate, dayIndex}
						<th
							class="day-column"
							class:is-selected-day={isSameDay(weekDate, selectedDate)}
							class:is-today={isSameDay(weekDate, new Date())}
							class:is-hovered={hoveredDayIndex === dayIndex}
							onmouseenter={() => (hoveredDayIndex = dayIndex)}
							onmouseleave={() => (hoveredDayIndex = null)}
						>
							{weekDayNames[dayIndex]}<span class="day-number">{weekDate.getDate()}</span>
							<button
								class="column-resize-handle"
								aria-label="Изменить ширину колонки"
								onpointerdown={(event) => startColumnResize(event, dayIndex)}
							></button>
						</th>
					{/each}
				</tr>
			</thead>

			<tbody>
				{#each projectsWithTasks as project (project.projectId)}
					<tr
						class="project-row"
						class:is-drop-target={dragOverProjectId === project.projectId}
						ondragover={(event) => {
							event.preventDefault();
							dragOverProjectId = project.projectId;
						}}
						ondragleave={() => (dragOverProjectId = null)}
						ondrop={() => handleTaskDrop(project.projectId)}
					>
						<td
							colspan={weekDayNames.length + 1}
							style="background: color-mix(in srgb, {project.projectColor} 14%, white)"
						>
							<button
								class="project-toggle"
								onclick={() => toggleProjectCollapsed(project.projectId)}
							>
								<span
									class="project-chevron"
									class:is-collapsed={collapsedProjectIds.includes(project.projectId)}>▾</span
								>
								<span class="project-dot" style="background: {project.projectColor}"></span>
								{project.projectName}
								<span class="project-task-count">{project.tasks.length}</span>
							</button>
						</td>
					</tr>

					{#each collapsedProjectIds.includes(project.projectId) ? [] : project.tasks as task (task.taskId)}
						<tr
							class:is-dragging={draggedTaskId === task.taskId}
							class:is-drop-target={dragOverProjectId === project.projectId}
							ondragover={(event) => {
								event.preventDefault();
								dragOverProjectId = project.projectId;
							}}
							ondrop={() => handleTaskDrop(project.projectId)}
						>
							<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
							<td
								class="task-column is-clickable"
								onclick={() => (editingTaskId = task.taskId)}
							>
								{#if editingTaskId === task.taskId}
									<div
										class="task-editor"
										onfocusout={(event) => {
											if (!event.currentTarget.contains(event.relatedTarget as Node)) editingTaskId = null;
										}}
									>
										<!-- svelte-ignore a11y_autofocus -->
										<textarea
											class="task-title-input"
											rows={Math.max(2, taskFullText(task).split('\n').length + 1)}
											value={taskFullText(task)}
											autofocus
											oninput={(event) => setTaskFullText(task, event.currentTarget.value)}
											onkeydown={(event) => {
												if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey)))
													editingTaskId = null;
											}}
										></textarea>
										<div class="task-editor-floating">
											<select
												class="task-project-select"
												value={projectIdOfTask(task.taskId)}
												onchange={(event) => moveTaskToProject(task.taskId, event.currentTarget.value)}
											>
												{#each projectsWithTasks as projectOption (projectOption.projectId)}
													<option value={projectOption.projectId}>{projectOption.projectName}</option>
												{/each}
											</select>
											<button class="task-editor-confirm" title="Готово" onclick={() => (editingTaskId = null)}>
												✓
											</button>
										</div>
									</div>
								{:else}
									<div class="task-row-content">
										<span
											class="task-drag-handle"
											role="button"
											tabindex="0"
											title="Перетащить в другой проект"
											draggable="true"
											ondragstart={() => (draggedTaskId = task.taskId)}
											ondragend={() => {
												draggedTaskId = null;
												dragOverProjectId = null;
											}}
										>⠿</span>
										<button class="task-title-button" onclick={() => (editingTaskId = task.taskId)}>
											<span class="task-title-line">{task.taskTitle}</span>
											{#if task.taskDescription}
												<span class="task-description">{task.taskDescription}</span>
											{/if}
										</button>
									</div>
								{/if}
							</td>
							{#each visibleWeekDates as weekDate, dayIndex}
								<td
									class="day-column"
									class:is-selected-day={isSameDay(weekDate, selectedDate)}
									class:is-today={isSameDay(weekDate, new Date())}
									class:is-hovered={hoveredDayIndex === dayIndex}
									onmouseenter={() => (hoveredDayIndex = dayIndex)}
									onmouseleave={() => (hoveredDayIndex = null)}
								>
									<input
										class="hours-input"
										inputmode="decimal"
										bind:value={
											() => hoursByCell[`${task.taskId}:${dayIndex}`] ?? '',
											(newValue) => (hoursByCell[`${task.taskId}:${dayIndex}`] = newValue)
										}
									/>
								</td>
							{/each}
						</tr>
					{/each}

					{#if !collapsedProjectIds.includes(project.projectId)}
						<tr class="add-task-row">
							<td class="task-column" colspan={weekDayNames.length + 1}>
								{#if addingTaskProjectId === project.projectId}
									<!-- svelte-ignore a11y_autofocus -->
									<input
										class="task-title-input"
										placeholder="Название задачи"
										bind:value={inlineNewTaskTitle}
										autofocus
										onkeydown={(event) => {
											if (event.key === 'Enter') confirmInlineNewTask(project.projectId);
											if (event.key === 'Escape') addingTaskProjectId = null;
										}}
										onblur={() => {
											confirmInlineNewTask(project.projectId);
											addingTaskProjectId = null;
										}}
									/>
								{:else}
									<button
										class="add-task-button"
										onclick={() => {
											inlineNewTaskTitle = '';
											addingTaskProjectId = project.projectId;
										}}
									>
										+ Добавить
									</button>
								{/if}
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
		</div>

		<!-- Real scrollbar, but only as wide as the hour columns. -->
		<div class="scrollbar-strip">
			<div class="scrollbar-strip-spacer" style="width: {taskColumnWidth}px"></div>
			<div
				class="scrollbar-strip-track"
				bind:this={scrollbarStripElement}
				onscroll={syncHorizontalScrollFromStrip}
			>
				<div style="width: {totalDayColumnsWidth}px; height: 1px" aria-hidden="true"></div>
			</div>
		</div>

		<!-- Separate table so the totals sit at the bottom of the panel, not after the list. -->
		<div class="totals-scroll-area" bind:this={totalsScrollElement}>
		<table class="totals-table">
			{@render columnWidths()}
			<tbody>
				<tr>
					<td class="task-column">
						Всего часов — {totalHoursForWeek} из {targetHoursPerDay * workDaysPerWeek}
					</td>
					{#each totalsPerDay as dayTotal, dayIndex}
						<td
							class="day-column"
							class:is-selected-day={isSameDay(visibleWeekDates[dayIndex], selectedDate)}
							class:is-today={isSameDay(visibleWeekDates[dayIndex], new Date())}
						>
							<div class="day-total">
								{Math.min(dayTotal, targetHoursPerDay)}
								{#if dayTotal > targetHoursPerDay}
									<span class="overtime-badge">+{dayTotal - targetHoursPerDay}</span>
								{/if}
							</div>

							<div class="day-progress-track">
								<div
									class="day-progress-fill"
									style="width: {Math.min(dayTotal / targetHoursPerDay, 1) * 100}%;
									       background: {progressColorForDay(dayTotal)}"
								></div>

								{#each overtimeLayerWidths(dayTotal) as layerWidth}
									<div class="day-progress-overtime-layer" style="width: {layerWidth * 100}%"></div>
								{/each}
							</div>
						</td>
					{/each}
				</tr>
			</tbody>
		</table>
		</div>
	</main>
</div>

{#if isNewTaskModalOpen}
	<div class="modal-backdrop" onclick={() => (isNewTaskModalOpen = false)} role="presentation">
		<div class="modal" onclick={(event) => event.stopPropagation()} role="presentation">
			<h2>Новая задача</h2>

			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="modal-input"
				placeholder="Название задачи"
				bind:value={newTaskTitle}
				autofocus
				onkeydown={(event) => {
					if (event.key === 'Enter') confirmNewTask();
				}}
			/>

			<select class="modal-input" bind:value={newTaskProjectId}>
				{#each projectsWithTasks as projectOption (projectOption.projectId)}
					<option value={projectOption.projectId}>{projectOption.projectName}</option>
				{/each}
			</select>

			<div class="modal-actions">
				<button class="pill-button" onclick={() => (isNewTaskModalOpen = false)}>Отмена</button>
				<button class="pill-button is-dark" onclick={confirmNewTask}>Создать</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(:root) {
		--color-shell: #1d1d1d;
		--color-panel: #ffffff;
		--color-cell-tint: #f4f4f4;
		--color-border: #ededed;
		--color-text: #10161f;
		--color-text-on-shell: #d4d4d4;
		--color-text-muted: #6b6b6b;
		--color-weekend: #e46f86;
		--color-overtime: #8a38f5;
	}

	:global(body) {
		margin: 0;
		background: var(--color-shell);
		font-family: ui-sans-serif, system-ui, sans-serif;
		color: var(--color-text);
	}

	/* Sidebar sits on the right, grid on the left. */
	.app-layout {
		display: grid;
		grid-template-columns: 1fr 264px;
		height: 100vh;
		overflow: hidden;
		transition: grid-template-columns 0.15s ease;
	}

	.app-layout.is-sidebar-collapsed {
		grid-template-columns: 1fr 56px;
	}

	.sidebar {
		order: 2;
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 14px;
		color: var(--color-text-on-shell);
		overflow: hidden;
	}

	.is-sidebar-collapsed .sidebar > *:not(.sidebar-header) {
		display: none;
	}

	.sidebar-header,
	.sidebar-footer {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.sidebar-header {
		justify-content: space-between;
	}

	.sidebar-footer {
		margin-top: auto;
	}

	.icon-button {
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 8px;
		background: #2a2a2a;
		color: var(--color-text-on-shell);
		font-size: 15px;
		cursor: pointer;
	}

	.menu-icon,
	.menu-icon::before,
	.menu-icon::after {
		display: block;
		width: 14px;
		height: 1.5px;
		background: currentColor;
	}

	.menu-icon::before,
	.menu-icon::after {
		content: '';
		position: relative;
		top: -5px;
	}

	.menu-icon::after {
		top: 3.5px;
	}

	.pill-button {
		border: 0;
		border-radius: 8px;
		background: var(--color-panel);
		color: var(--color-text);
		padding: 6px 12px;
		font: inherit;
		font-size: 13px;
		cursor: pointer;
	}

	.pill-button.is-dark {
		background: var(--color-shell);
		color: var(--color-panel);
	}

	.week-switcher {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.icon-button-light {
		width: 28px;
		height: 28px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-panel);
		font-size: 15px;
		cursor: pointer;
	}

	.month-name {
		font-size: 13px;
		min-width: 76px;
		text-align: center;
	}

	.year-badge {
		background: #2a2a2a;
		border-radius: 8px;
		padding: 4px 8px;
		font-size: 12px;
	}

	.calendar {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}

	.calendar-weekday {
		text-align: center;
		font-size: 11px;
		color: #6b6b6b;
		padding-bottom: 4px;
	}

	.calendar-day {
		position: relative;
		border: 0;
		background: transparent;
		color: var(--color-text-on-shell);
		border-radius: 7px;
		padding: 6px 0 9px;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}

	.calendar-weekday.is-weekend,
	.calendar-day.is-weekend {
		color: var(--color-weekend);
	}

	.logged-hours-dot {
		position: absolute;
		bottom: 3px;
		left: 50%;
		transform: translateX(-50%);
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: currentColor;
	}

	.calendar-day:hover {
		background: #2a2a2a;
	}

	.calendar-day.is-outside-month {
		color: #4a4a4a;
	}

	.calendar-day.is-in-selected-week {
		background: #333333;
	}

	.calendar-day.is-selected {
		background: var(--color-panel);
		color: var(--color-text);
	}

	.sidebar-section-title {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
	}

	.project-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.project-chip {
		border-radius: 7px;
		padding: 4px 9px;
		font-size: 12px;
		color: #10161f;
	}

	.avatar {
		width: 32px;
		height: 32px;
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
		font-size: 13px;
	}

	.user-role {
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.sidebar-footer .icon-button {
		margin-left: auto;
	}

	.week-grid {
		order: 1;
		/* Lets the panel shrink instead of pushing the page wider than the screen. */
		min-width: 0;
		display: flex;
		flex-direction: column;
		background: var(--color-panel);
		border-radius: 14px;
		margin: 10px 0 10px 10px;
		overflow: hidden;
	}

	/* Never scrolls sideways on its own — the strip below drives it. */
	.table-scroll-area {
		flex: 1;
		overflow-x: hidden;
		overflow-y: auto;
	}

	.scrollbar-strip {
		display: flex;
	}

	.scrollbar-strip-spacer {
		flex: none;
	}

	.scrollbar-strip-track {
		flex: 1;
		min-width: 0;
		height: 14px;
		overflow-x: auto;
		overflow-y: hidden;
	}

	.scrollbar-strip-track::-webkit-scrollbar {
		height: 8px;
	}

	.scrollbar-strip-track::-webkit-scrollbar-thumb {
		background: #c9c9c9;
		border-radius: 4px;
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
	}

	.toolbar h1 {
		margin: 0;
		font-size: 15px;
	}

	.today-heading {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
	}

	.today-date::first-letter {
		text-transform: uppercase;
	}

	.current-time {
		font-variant-numeric: tabular-nums;
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.time-zone-capsule {
		background: var(--color-cell-tint);
		border-radius: 999px;
		padding: 3px 9px;
		font-size: 11px;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.table-menu {
		position: relative;
	}

	.table-menu .pill-button {
		border: 1px solid var(--color-border);
	}

	.table-menu-dropdown {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		background: var(--color-panel);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.12);
		display: flex;
		flex-direction: column;
		min-width: 170px;
		overflow: hidden;
		z-index: 10;
	}

	.table-menu-dropdown button {
		border: 0;
		background: none;
		padding: 9px 12px;
		text-align: left;
		font: inherit;
		font-size: 13px;
		cursor: pointer;
	}

	.table-menu-dropdown button:hover {
		background: #f5f5f5;
	}

	/* Fixed layout so the totals table lines up with the scrolling one. */
	table {
		width: max-content;
		min-width: 100%;
		table-layout: fixed;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 13px;
	}

	.totals-scroll-area {
		overflow: hidden;
	}

	/* Header row stays pinned while the task list scrolls. */
	thead th {
		position: sticky;
		top: 0;
		z-index: 5;
	}

	thead th.task-column {
		z-index: 6;
	}

	/* Task column never scrolls away sideways. */
	.task-column {
		position: sticky;
		left: 0;
		z-index: 2;
		background: var(--color-panel);
	}

	.column-resize-handle {
		position: absolute;
		top: 0;
		right: -3px;
		width: 7px;
		height: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: col-resize;
		z-index: 3;
	}

	.column-resize-handle:hover {
		background: rgb(0 0 0 / 0.08);
	}

	th {
		position: relative;
	}

	th.task-column {
		z-index: 4;
	}

	.project-toggle {
		position: sticky;
		left: 10px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border: 0;
		background: none;
		padding: 0;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.project-chevron {
		display: inline-block;
		transition: transform 0.12s ease;
	}

	.project-chevron.is-collapsed {
		transform: rotate(-90deg);
	}

	.project-task-count {
		color: var(--color-text-muted);
		font-weight: 500;
		margin-left: 4px;
	}

	th,
	td {
		border-bottom: 1px solid var(--color-border);
		border-right: 1px solid var(--color-border);
		padding: 8px 10px;
		text-align: left;
		vertical-align: top;
	}

	.day-column {
		text-align: center;
		padding: 0;
		background: var(--color-panel);
	}

	th.day-column {
		padding: 8px 6px;
		text-align: center;
		font-weight: 500;
		background: var(--color-panel);
	}

	/* Selected day: grey header, column stays white. */
	th.day-column.is-selected-day {
		background: var(--color-cell-tint);
	}

	/* Today: black header, whole column slightly grey. Wins over selected. */
	th.day-column.is-today {
		background: var(--color-shell);
		color: var(--color-panel);
	}

	.day-column.is-today {
		background: var(--color-cell-tint);
	}

	.day-number {
		margin-left: 6px;
		color: #aaa;
	}

	.project-row td {
		background: var(--color-panel);
		font-weight: 600;
	}

	.project-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin-right: 7px;
	}

	/* Editing fills the whole cell; the project picker floats over the rows below. */
	.task-column:has(.task-editor) {
		padding: 0;
	}

	.task-editor {
		position: relative;
	}

	.task-title-input {
		width: 100%;
		box-sizing: border-box;
		min-height: 48px;
		border: 0;
		outline: 2px solid var(--color-shell);
		outline-offset: -2px;
		/* room on the right for the floating project picker */
		padding: 8px 190px 8px 10px;
		font: inherit;
		resize: none;
		line-height: 1.45;
	}

	.task-editor-floating {
		position: absolute;
		top: 4px;
		right: 4px;
		z-index: 30;
		display: flex;
		gap: 6px;
		background: var(--color-panel);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 6px;
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.12);
	}

	.task-editor-confirm {
		border: 0;
		border-radius: 7px;
		background: var(--color-shell);
		color: var(--color-panel);
		width: 30px;
		cursor: pointer;
		font-size: 13px;
	}

	/* Hovering any cell lights the whole day column. */
	.day-column.is-hovered {
		background: var(--color-cell-tint);
	}

	.month-load {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.month-load-numbers {
		display: flex;
		align-items: baseline;
		gap: 6px;
		color: var(--color-text-on-shell);
		font-size: 13px;
	}

	.month-load-numbers strong {
		font-size: 18px;
	}

	.month-load-track {
		position: relative;
		height: 6px;
		border-radius: 3px;
		background: #2a2a2a;
		overflow: hidden;
	}

	/* Grey marker = what should be done by today, green = what is done. */
	.month-load-expected,
	.month-load-done {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 3px;
	}

	.month-load-expected {
		background: #4a4a4a;
	}

	.month-load-done {
		background: #28d059;
	}

	.month-load-caption {
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.task-column.is-clickable {
		cursor: text;
	}

	.task-row-content {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}

	.task-drag-handle {
		color: #c4c4c4;
		cursor: grab;
		font-size: 12px;
		user-select: none;
	}

	.task-drag-handle:active {
		cursor: grabbing;
	}

	tr.is-dragging {
		opacity: 0.4;
	}

	tr.is-drop-target td {
		box-shadow: inset 0 2px 0 var(--color-shell);
	}

	.task-title-button {
		display: block;
		width: 100%;
		border: 0;
		background: none;
		padding: 0;
		text-align: left;
		font: inherit;
		font-weight: 500;
		cursor: text;
	}

	.task-editor {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.task-project-select,
	.new-project-input {
		border: 1px solid var(--color-border);
		border-radius: 7px;
		padding: 5px 8px;
		font: inherit;
		font-size: 12px;
		background: var(--color-panel);
	}

	.add-task-row td {
		background: var(--color-panel);
	}

	.add-task-button {
		border: 0;
		background: none;
		padding: 2px 0;
		font: inherit;
		font-size: 12px;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.add-task-button:hover {
		color: var(--color-text);
	}

	.add-project-button,
	.remove-project-button {
		border: 0;
		background: none;
		padding: 0 2px;
		font: inherit;
		cursor: pointer;
		color: inherit;
	}

	.add-project-button {
		margin-left: auto;
		font-size: 14px;
	}

	.remove-project-button {
		margin-left: 5px;
		opacity: 0.55;
	}

	.new-project-input {
		width: 100%;
		box-sizing: border-box;
	}

	.sidebar-add-task-button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border: 0;
		border-radius: 9px;
		background: #2a2a2a;
		color: var(--color-text-on-shell);
		padding: 8px 10px;
		font: inherit;
		font-size: 13px;
		cursor: pointer;
	}

	.keystroke-hint {
		color: #7a7a7a;
		font-size: 11px;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgb(0 0 0 / 0.45);
		display: grid;
		place-items: center;
		z-index: 50;
	}

	.modal {
		background: var(--color-panel);
		border-radius: 14px;
		padding: 18px;
		width: 380px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.modal h2 {
		margin: 0;
		font-size: 15px;
	}

	.modal-input {
		border: 1px solid var(--color-border);
		border-radius: 9px;
		padding: 9px 10px;
		font: inherit;
		font-size: 13px;
		background: var(--color-panel);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 4px;
	}

	.task-title-line {
		display: block;
		font-weight: 500;
	}

	.task-description {
		display: block;
		color: var(--color-text-muted);
		white-space: pre-line;
		margin-top: 2px;
	}

	.hours-input {
		width: 100%;
		height: 38px;
		border: 0;
		background: transparent;
		text-align: center;
		font: inherit;
		outline-offset: -2px;
	}

	.totals-table td {
		font-weight: 600;
		background: var(--color-panel);
		border-top: 1px solid var(--color-border);
		border-bottom: 0;
		padding: 8px 10px;
	}

	.day-total {
		text-align: center;
	}

	.overtime-badge {
		color: var(--color-overtime);
	}

	.day-progress-track {
		position: relative;
		height: 5px;
		margin-top: 5px;
		border-radius: 3px;
		background: #ececec;
		overflow: hidden;
	}

	.day-progress-overtime-layer {
		position: absolute;
		inset: 0 auto 0 0;
		background: rgb(0 0 0 / 0.35);
	}

	.day-progress-fill {
		height: 100%;
		border-radius: 2px;
	}
</style>
