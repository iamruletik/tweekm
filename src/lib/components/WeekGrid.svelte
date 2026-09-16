<!--
	The hours table. Rows are tasks grouped by whatever the caller grouped them by,
	columns are the days of the visible period; week, month and year views.
	Owns: cell editing, the hour stepper, task drag & drop, entry drag (opt-in),
	column resize, the fake scrollbar, per-day totals.
	Needs: grouped rows, the hours map, selected date, view mode, norms, and the
	away-days of the person these rows belong to.
	Writes: hours (bound map) and task titles/order (bound rows).
-->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { type Task, type ProjectWithTasks, toIsoDate, projectColorPalette } from '$lib/fakeData';
	import {
		weekDayNames,
		monthNames,
		isSameDay,
		toMondayOfWeek,
		addDays,
		visibleDatesFor,
		type ViewMode
	} from '$lib/dates';
	import {
		parseHours,
		formatHours,
		sanitizeHoursInput,
		roundToQuarter,
		maximumHoursPerDay,
		aggregateHours,
		expectedHoursFor,
		dayFillColor as dayFillColorFor,
		type HoursByTaskAndDate
	} from '$lib/hours';

	let {
		projectsWithTasks = $bindable(),
		hoursByTaskAndDate = $bindable(),
		selectedDate = $bindable(),
		viewMode = $bindable(),
		slideDirection = 1,
		showWeekends = true,
		targetHoursPerDay = 8,
		minimumHoursPerDay = 6,
		roundToQuarterHour = true,
		onRequestNewTask = () => {},
		taskBadgeOf = null,
		allowEntryMove = false,
		onTaskOwnerClick = null,
		onAddProject = null,
		onEditProject = null,
		vacationDates = {},
		searchQuery = '',
		emptyHintText = ''
	}: {
		// A group can carry an avatar when the rows are grouped by person.
		projectsWithTasks: (ProjectWithTasks & { groupAvatarUrl?: string })[];
		hoursByTaskAndDate: HoursByTaskAndDate;
		selectedDate: Date;
		viewMode: ViewMode;
		slideDirection?: number;
		showWeekends?: boolean;
		targetHoursPerDay?: number;
		minimumHoursPerDay?: number;
		roundToQuarterHour?: boolean;
		onRequestNewTask?: () => void;
		// Studio view labels every row with the person who logged it.
		// Row label for whatever dimension is not being grouped on.
		taskBadgeOf?:
			| ((taskId: string) => { badgeLabel: string; avatarUrl?: string; badgeColor?: string } | null)
			| null;
		// Boss only: hours can be dragged onto another day or another row.
		allowEntryMove?: boolean;
		onTaskOwnerClick?: ((taskId: string, anchor: HTMLElement) => void) | null;
		// Screens that build their groups themselves handle project creation and
		// answer with the id of the project they made.
		onAddProject?: ((projectName: string) => string | void) | null;
		// Screens that own a project editor get a "⋯" on the group row.
		onEditProject?: ((project: ProjectWithTasks) => void) | null;
		// Days the person whose rows these are is away, by status. Studio-wide
		// views pass nothing: a row there can belong to anyone.
		vacationDates?: Record<string, 'pending' | 'approved' | 'declined'>;
		// Typing in the toolbar's search narrows the rows, not just its dropdown.
		searchQuery?: string;
		// Screens that filter the rows themselves explain their own empty result.
		emptyHintText?: string;
	} = $props();

	let draggedEntryKey = $state<string | null>(null);
	let entryDropTargetKey = $state<string | null>(null);

	function startEntryDrag(event: DragEvent, cellKey: string) {
		if (!allowEntryMove || !hoursByTaskAndDate[cellKey]) return;
		draggedEntryKey = cellKey;
		event.dataTransfer?.setData('text/plain', cellKey);
	}

	// Dropping onto a filled cell adds the hours instead of losing them.
	function dropEntryOn(targetKey: string) {
		if (!draggedEntryKey || draggedEntryKey === targetKey) return;
		const movedHours = parseHours(hoursByTaskAndDate[draggedEntryKey] ?? '');
		const existingHours = parseHours(hoursByTaskAndDate[targetKey] ?? '');
		delete hoursByTaskAndDate[draggedEntryKey];
		hoursByTaskAndDate[targetKey] = formatHours(movedHours + existingHours);
		draggedEntryKey = null;
		entryDropTargetKey = null;
	}

	const visibleDates = $derived(visibleDatesFor(selectedDate, viewMode, showWeekends));
	const visibleIsoDates = $derived(visibleDates.map((date) => toIsoDate(date)));

	// Only the rows this grid is showing count towards its totals — the map it is
	// handed can hold the whole studio.
	const visibleTaskIds = $derived(
		new Set(projectsWithTasks.flatMap((project) => project.tasks.map((task) => task.taskId)))
	);

	const hoursByDate = $derived(
		aggregateHours(hoursByTaskAndDate, (taskId, isoDate) =>
			visibleTaskIds.has(taskId) ? isoDate : null
		)
	);

	function hoursLoggedOn(date: Date): number {
		return hoursByDate[toIsoDate(date)] ?? 0;
	}

	function isVacationDay(date: Date): boolean {
		return Boolean(vacationDates[toIsoDate(date)]);
	}

	function isPendingVacationDay(date: Date): boolean {
		return vacationDates[toIsoDate(date)] === 'pending';
	}

	// Worked during vacation — worth seeing.
	function isWorkedVacationDay(date: Date): boolean {
		return isVacationDay(date) && hoursLoggedOn(date) > 0;
	}

	function dayFillColor(date: Date): string {
		return dayFillColorFor(hoursLoggedOn(date), targetHoursPerDay);
	}

	// Lets the parent snap all day columns back into view.
	export function fitColumns() {
		fitColumnsToContainer();
	}

	// The new-task modal lives on the page; creation itself stays here.
	export function addTask(projectId: string, taskTitle: string) {
		addTaskToProject(projectId, taskTitle);
	}

	let isAddingProjectInTable = $state(false);
	let newProjectNameInTable = $state('');
	// Empty groups are hidden, so a freshly made project stays pinned until it
	// has its first task.
	let pinnedProjectIds = $state<string[]>([]);

	function confirmNewProjectInTable() {
		const projectName = newProjectNameInTable.trim();
		isAddingProjectInTable = false;
		newProjectNameInTable = '';
		if (!projectName) return;

		if (onAddProject) {
			const createdProjectId = onAddProject(projectName);
			if (createdProjectId) pinnedProjectIds = [...pinnedProjectIds, createdProjectId];
			return;
		}

		const projectId = `project-${Date.now()}`;
		projectsWithTasks = [
			...projectsWithTasks,
			{
				projectId,
				projectName,
				projectColor: projectColorPalette[projectsWithTasks.length % projectColorPalette.length],
				tasks: []
			}
		];
		pinnedProjectIds = [...pinnedProjectIds, projectId];
	}

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

	// --- Dragging a task between and inside projects ---

	let draggedTaskId = $state<string | null>(null);
	let draggedTaskTitle = $state('');
	let dropTargetProjectId = $state<string | null>(null);
	// Task the dragged one would land in front of; null means "at the end".
	let dropBeforeTaskId = $state<string | null>(null);
	let dragGhostPosition = $state<{ x: number; y: number } | null>(null);

	function startTaskDrag(event: DragEvent, task: Task) {
		draggedTaskId = task.taskId;
		draggedTaskTitle = task.taskTitle;
		// Hide the browser's own snapshot — we draw our own ghost.
		const emptyImage = new Image();
		emptyImage.src =
			'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
		event.dataTransfer?.setDragImage(emptyImage, 0, 0);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	function endTaskDrag() {
		draggedTaskId = null;
		dropTargetProjectId = null;
		dropBeforeTaskId = null;
		dragGhostPosition = null;
	}

	// Above a row's middle means "insert before it", below means "after it".
	function updateDropTarget(event: DragEvent, projectId: string, task: Task | null) {
		event.preventDefault();
		dragGhostPosition = { x: event.clientX, y: event.clientY };
		dropTargetProjectId = projectId;

		if (!task) {
			dropBeforeTaskId = null;
			return;
		}

		const rowBounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const isAboveMiddle = event.clientY < rowBounds.top + rowBounds.height / 2;
		if (isAboveMiddle) {
			dropBeforeTaskId = task.taskId;
			return;
		}

		const project = projectsWithTasks.find((candidate) => candidate.projectId === projectId);
		const tasksShown = project ? visibleTasksOf(project) : [];
		const nextTask = tasksShown[tasksShown.findIndex((shown) => shown.taskId === task.taskId) + 1];
		dropBeforeTaskId = nextTask ? nextTask.taskId : null;
	}

	function dropDraggedTask() {
		const targetProjectId = dropTargetProjectId;
		const beforeTaskId = dropBeforeTaskId;
		const movedTaskId = draggedTaskId;
		endTaskDrag();
		if (!movedTaskId || !targetProjectId) return;

		const sourceProject = projectsWithTasks.find((project) =>
			project.tasks.some((task) => task.taskId === movedTaskId)
		);
		const targetProject = projectsWithTasks.find(
			(project) => project.projectId === targetProjectId
		);
		if (!sourceProject || !targetProject) return;

		const [movedTask] = sourceProject.tasks.splice(
			sourceProject.tasks.findIndex((task) => task.taskId === movedTaskId),
			1
		);

		const insertIndex = beforeTaskId
			? targetProject.tasks.findIndex((task) => task.taskId === beforeTaskId)
			: targetProject.tasks.length;
		targetProject.tasks.splice(insertIndex === -1 ? targetProject.tasks.length : insertIndex, 0, movedTask);

		// A task dragged into a week it had no hours in still has to show up there.
		const weekKey = weekKeyOf(selectedDate);
		if (!(taskIdsAddedPerWeek[weekKey] ?? []).includes(movedTaskId)) {
			taskIdsAddedPerWeek[weekKey] = [...(taskIdsAddedPerWeek[weekKey] ?? []), movedTaskId];
		}
	}

	// A task appears in a week if it has hours that week, or was added there by hand.
	let taskIdsAddedPerWeek = $state<Record<string, string[]>>({});

	function weekKeyOf(date: Date): string {
		return toIsoDate(toMondayOfWeek(date));
	}

	function taskHasHoursThisWeek(taskId: string): boolean {
		return visibleDates.some(
			(weekDate) => (hoursByTaskAndDate[`${taskId}:${toIsoDate(weekDate)}`] ?? '') !== ''
		);
	}

	function matchesSearch(task: Task): boolean {
		const query = searchQuery.trim().toLowerCase();
		if (!query) return true;
		return (
			task.taskTitle.toLowerCase().includes(query) ||
			task.taskDescription.toLowerCase().includes(query)
		);
	}

	function visibleTasksOf(project: ProjectWithTasks): Task[] {
		const addedThisWeek = taskIdsAddedPerWeek[weekKeyOf(selectedDate)] ?? [];
		return project.tasks.filter(
			(task) =>
				matchesSearch(task) &&
				(taskHasHoursThisWeek(task.taskId) || addedThisWeek.includes(task.taskId))
		);
	}

	// Hours logged in this project across the period on screen.
	function projectHoursInView(project: ProjectWithTasks): number {
		return visibleTasksOf(project).reduce(
			(projectTotal, task) =>
				projectTotal +
				visibleIsoDates.reduce(
					(taskTotal, isoDate) =>
						taskTotal + parseHours(hoursByTaskAndDate[`${task.taskId}:${isoDate}`] ?? ''),
					0
				),
			0
		);
	}

	const visibleTaskCount = $derived(
		projectsWithTasks.reduce((count, project) => count + visibleTasksOf(project).length, 0)
	);

	// Day column the pointer is over, so the whole column can light up.
	let hoveredDayIndex = $state<number | null>(null);
	let hoveredCellKey = $state<string | null>(null);

	// Floating stepper shown next to a focused hour cell.
	let activeHoursCellKey = $state<string | null>(null);

	// Only the cell that still owns the stepper may close it — otherwise the old
	// cell's blur timer wipes the stepper the next cell just opened.
	function roundCellToQuarterHour(cellKey: string) {
		if (!roundToQuarterHour) return;
		const value = parseHours(hoursByTaskAndDate[cellKey] ?? '');
		if (value === 0) return;
		hoursByTaskAndDate[cellKey] = formatHours(roundToQuarter(value));
	}

	function closeHoursStepper(cellKey: string) {
		roundCellToQuarterHour(cellKey);
		setTimeout(() => {
			if (activeHoursCellKey === cellKey) activeHoursCellKey = null;
		}, 120);
	}

	// Whole hours by default; a quarter step with Alt held, the unit we bill in.
	function stepHours(cellKey: string, step: number) {
		const current = parseHours(hoursByTaskAndDate[cellKey] ?? '');
		const next = Math.min(maximumHoursPerDay, Math.max(0, roundToQuarter(current + step)));
		hoursByTaskAndDate[cellKey] = next === 0 ? '' : formatHours(next);
	}

	function addTaskToProject(projectId: string, taskTitle: string) {
		const project = projectsWithTasks.find((candidate) => candidate.projectId === projectId);
		if (!project || !taskTitle.trim()) return;
		const newTaskId = crypto.randomUUID();
		project.tasks.push({ taskId: newTaskId, taskTitle: taskTitle.trim(), taskDescription: '' });

		const weekKey = weekKeyOf(selectedDate);
		taskIdsAddedPerWeek[weekKey] = [...(taskIdsAddedPerWeek[weekKey] ?? []), newTaskId];
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

	// Inline "+ Задача" row: which project is currently typing a new task.
	let addingTaskProjectId = $state<string | null>(null);
	let inlineNewTaskTitle = $state('');

	function confirmInlineNewTask(projectId: string) {
		addTask(projectId, inlineNewTaskTitle);
		inlineNewTaskTitle = '';
	}

	// Months of the selected year, each as a 42-cell grid, for the year view.
	const monthsOfSelectedYear = $derived.by(() =>
		Array.from({ length: 12 }, (_, monthIndex) => {
			const monthStart = new Date(selectedDate.getFullYear(), monthIndex, 1);
			const gridStart = toMondayOfWeek(monthStart);
			return {
				monthIndex,
				monthStart,
				dates: Array.from({ length: 42 }, (_, cellIndex) => addDays(gridStart, cellIndex))
			};
		})
	);

	const periodKey = $derived(
		viewMode === 'year'
			? `year-${selectedDate.getFullYear()}`
			: `${viewMode}-${toIsoDate(visibleDates[0])}`
	);

	// --- Collapsible project groups ---

	let collapsedProjectIds = $state<string[]>([]);

	function toggleProjectCollapsed(projectId: string) {
		collapsedProjectIds = collapsedProjectIds.includes(projectId)
			? collapsedProjectIds.filter((id) => id !== projectId)
			: [...collapsedProjectIds, projectId];
	}

	// --- Resizable columns (widths in rem, shared by both grids) ---

	let taskColumnWidth = $state(27.5);
	let dayColumnWidths = $state(Array(7).fill(6));

	const minimumTaskColumnWidth = 12.5;
	const minimumDayColumnWidth = 3.5;
	function currentPixelsPerRem(): number {
		if (typeof document === 'undefined') return 16;
		return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
	}

	const monthViewDayColumnWidth = 3.25;

	// Week columns are individually resizable; month columns share one narrow width.
	const visibleColumnWidths = $derived(
		viewMode === 'week' ? dayColumnWidths : visibleDates.map(() => monthViewDayColumnWidth)
	);

	let tableScrollElement = $state<HTMLDivElement | null>(null);
	let totalsScrollElement = $state<HTMLDivElement | null>(null);
	let scrollbarStripElement = $state<HTMLDivElement | null>(null);

	const totalDayColumnsWidth = $derived(
		visibleColumnWidths.reduce((sum, columnWidth) => sum + columnWidth, 0)
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
			const nextWidth = Math.max(
				minimumWidth,
				startWidth + (moveEvent.clientX - startPointerX) / currentPixelsPerRem()
			);
			// Day columns stay equal — resizing one resizes all of them.
			if (isTaskColumn) taskColumnWidth = nextWidth;
			else dayColumnWidths = dayColumnWidths.map(() => nextWidth);
		}

		function handlePointerUp() {
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerup', handlePointerUp);
		}

		window.addEventListener('pointermove', handlePointerMove);
		window.addEventListener('pointerup', handlePointerUp);
	}

	// Shrink the day columns until the whole week fits the panel with no scrolling.
	function fitColumnsToContainer() {
		if (!tableScrollElement) return;
		// Day columns share the room left after the task column; never wider than that.
		// Two pixels go to the outer cell borders, which sit inside the tracks.
		const containerRem = (tableScrollElement.clientWidth - 2) / currentPixelsPerRem();
		const availableRem = containerRem - taskColumnWidth;
		const perColumn = Math.max(minimumDayColumnWidth, availableRem / visibleDates.length);
		dayColumnWidths = dayColumnWidths.map(() => perColumn);
		// Shrink the task column instead of overflowing when the days need the room.
		if (perColumn * visibleDates.length > availableRem) {
			taskColumnWidth = Math.max(
				minimumTaskColumnWidth,
				containerRem - perColumn * visibleDates.length
			);
		}
	}

	const totalsPerDay = $derived(visibleDates.map((weekDate) => hoursLoggedOn(weekDate)));

	const totalHoursForWeek = $derived(totalsPerDay.reduce((sum, dayTotal) => sum + dayTotal, 0));

	// Weekends never add to the norm, so the month view stops comparing to a week.
	const expectedPeriodHours = $derived(expectedHoursFor(visibleDates, targetHoursPerDay));

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

	{#if viewMode === 'year'}
		{#key periodKey}
			<div
				class="year-view"
				in:fly={{ x: slideDirection * 40, duration: 200, easing: cubicOut }}
			>
				{#each monthsOfSelectedYear as yearMonth (yearMonth.monthIndex)}
					<div class="year-month">
						<button
							class="year-month-name"
							onclick={() => {
								selectedDate = yearMonth.monthStart;
								viewMode = 'month';
							}}
						>
							{monthNames[yearMonth.monthIndex]}
						</button>
						<div class="year-month-grid">
							{#each yearMonth.dates as yearDate}
								{#if yearDate.getMonth() === yearMonth.monthIndex}
									<button
										class="year-day"
										class:is-empty={hoursLoggedOn(yearDate) === 0}
									class:is-today={isSameDay(yearDate, new Date())}
										class:is-vacation={isVacationDay(yearDate)}
										class:is-worked-vacation={isWorkedVacationDay(yearDate)}
										title="{toIsoDate(yearDate)} — {hoursLoggedOn(yearDate)} ч"
										style="background: {isVacationDay(yearDate)
											? 'var(--color-vacation)'
											: hoursLoggedOn(yearDate) === 0
												? 'transparent'
												: dayFillColor(yearDate)}"
										onclick={() => {
											selectedDate = yearDate;
											viewMode = 'week';
										}}
									>
										{yearDate.getDate()}
									</button>
								{:else}
									<span class="year-day-blank"></span>
								{/if}
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/key}
	{:else}
	<!-- minmax lets the day columns absorb leftover width instead of ending short -->
	{@const gridColumns = `${taskColumnWidth}rem ${visibleColumnWidths
		.map((columnWidth) => `minmax(${columnWidth}rem, 1fr)`)
		.join(' ')}`}

	<div
		class="grid-scroll-area"
		bind:this={tableScrollElement}
		onwheel={forwardHorizontalWheelToStrip}
	>
		{#key periodKey}
			<div
				class="grid"
				style="grid-template-columns: {gridColumns}"
				in:fly={{ x: slideDirection * 60, duration: 200, easing: cubicOut }}
			>
				<div class="grid-row is-header">
					<div class="grid-cell task-cell">
						Задача
						<button
							class="column-resize-handle"
							aria-label="Изменить ширину колонки"
							onpointerdown={(event) => startColumnResize(event, 'task')}
						></button>
					</div>

					{#each visibleDates as weekDate, dayIndex}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="grid-cell day-cell is-day-header"
							class:is-selected-day={isSameDay(weekDate, selectedDate)}
							class:is-today={isSameDay(weekDate, new Date())}
							class:is-hovered={hoveredDayIndex === dayIndex}
							class:is-empty={hoursLoggedOn(weekDate) === 0}
							class:is-vacation={isVacationDay(weekDate)}
							class:is-vacation-pending={isPendingVacationDay(weekDate)}
							onmouseenter={() => (hoveredDayIndex = dayIndex)}
							onmouseleave={() => (hoveredDayIndex = null)}
						>
							{#if viewMode === 'week'}
								{weekDayNames[(weekDate.getDay() + 6) % 7]}<span class="day-number"
									>{weekDate.getDate()}</span
								>
							{:else}
								{weekDate.getDate()}
							{/if}
							<button
								class="column-resize-handle"
								aria-label="Изменить ширину колонки"
								onpointerdown={(event) => startColumnResize(event, dayIndex)}
							></button>
						</div>
					{/each}
				</div>

				{#each projectsWithTasks.filter(
					(project) =>
						visibleTasksOf(project).length > 0 || pinnedProjectIds.includes(project.projectId)
				) as project (project.projectId)}
					<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
					<div
						class="grid-row project-row"
						class:is-drop-into={dropTargetProjectId === project.projectId && draggedTaskId}
						onclick={() => toggleProjectCollapsed(project.projectId)}
						style="background: color-mix(in srgb, {project.projectColor} 14%, white)"
						ondragover={(event) =>
							updateDropTarget(event, project.projectId, visibleTasksOf(project)[0] ?? null)}
						ondrop={dropDraggedTask}
					>
						<div class="grid-cell is-full-span">
							<span class="project-toggle">
								<span
									class="project-chevron"
									class:is-collapsed={collapsedProjectIds.includes(project.projectId)}
								>
									<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
										<path d="M4 6.5 8 10.5l4-4" fill="none" stroke="currentColor" stroke-width="1.8"
											stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								</span>
								{#if project.groupAvatarUrl}
									<img class="project-group-avatar" src={project.groupAvatarUrl} alt="" />
								{:else}
									<span class="project-dot" style="background: {project.projectColor}"></span>
								{/if}
								{project.projectName}
								<span class="project-task-count">{formatHours(projectHoursInView(project))} ч</span>
								{#if onEditProject}
									<button
										class="project-edit-button"
										title="Настройки проекта"
										onclick={(event) => {
											event.stopPropagation();
											onEditProject(project);
										}}
									>
										⋯
									</button>
								{/if}
							</span>
						</div>
					</div>

					{#each collapsedProjectIds.includes(project.projectId) ? [] : visibleTasksOf(project) as task (task.taskId)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="grid-row task-row"
							class:is-dragging={draggedTaskId === task.taskId}
							class:is-drop-before={draggedTaskId && dropBeforeTaskId === task.taskId}
							ondragover={(event) => updateDropTarget(event, project.projectId, task)}
							ondrop={dropDraggedTask}
						>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div
								class="grid-cell task-cell is-clickable"
								onclick={() => (editingTaskId = task.taskId)}
							>
								{#if editingTaskId === task.taskId}
									<div
										class="task-editor"
										onfocusout={(event) => {
											if (!event.currentTarget.contains(event.relatedTarget as Node))
												editingTaskId = null;
										}}
									>
										<!-- svelte-ignore a11y_autofocus -->
										<textarea
											class="task-title-input"
											rows={Math.max(1, taskFullText(task).split('\n').length)}
											value={taskFullText(task)}
											autofocus
											oninput={(event) => setTaskFullText(task, event.currentTarget.value)}
											onkeydown={(event) => {
												if (
													event.key === 'Escape' ||
													(event.key === 'Enter' && (event.metaKey || event.ctrlKey))
												)
													editingTaskId = null;
											}}
										></textarea>

										<div class="task-editor-floating">
											<select
												class="task-project-select"
												value={projectIdOfTask(task.taskId)}
												onclick={(event) => event.stopPropagation()}
												onchange={(event) => moveTaskToProject(task.taskId, event.currentTarget.value)}
											>
												{#each projectsWithTasks as projectOption (projectOption.projectId)}
													<option value={projectOption.projectId}>{projectOption.projectName}</option>
												{/each}
											</select>
											<button
												class="task-editor-confirm"
												title="Готово"
												onclick={(event) => {
													// otherwise the cell click below re-opens the editor
													event.stopPropagation();
													editingTaskId = null;
												}}
											>
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
											ondragstart={(event) => startTaskDrag(event, task)}
											ondragend={endTaskDrag}
										>⠿</span>
										<button class="task-title-button" onclick={() => (editingTaskId = task.taskId)}>
											{#if taskBadgeOf}
												{@const badge = taskBadgeOf(task.taskId)}
												{#if badge}
													<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
													<span
														class="task-owner"
														class:is-clickable={Boolean(onTaskOwnerClick)}
														onclick={(event) => {
															if (!onTaskOwnerClick) return;
															event.stopPropagation();
															onTaskOwnerClick(task.taskId, event.currentTarget);
														}}
													>
														{#if badge.avatarUrl}
															<img class="task-owner-avatar" src={badge.avatarUrl} alt="" />
														{:else if badge.badgeColor}
															<span class="task-owner-dot" style="background: {badge.badgeColor}"></span>
														{/if}
														{badge.badgeLabel}
													</span>
												{/if}
											{/if}
											<span class="task-title-line">{task.taskTitle}</span>
											{#if task.taskDescription}
												<span class="task-description">{task.taskDescription}</span>
											{/if}
										</button>
									</div>
								{/if}
							</div>

							{#each visibleDates as weekDate, dayIndex}
								<div
									class="grid-cell day-cell"
									class:is-selected-day={isSameDay(weekDate, selectedDate)}
									class:is-today={isSameDay(weekDate, new Date())}
									class:is-hovered={hoveredDayIndex === dayIndex}
									class:is-cell-hovered={hoveredCellKey === `${task.taskId}:${toIsoDate(weekDate)}`}
									class:is-vacation={isVacationDay(weekDate)}
									class:is-vacation-pending={isPendingVacationDay(weekDate)}
									class:is-entry-dragging={draggedEntryKey === `${task.taskId}:${toIsoDate(weekDate)}`}
									class:is-entry-drop-target={entryDropTargetKey ===
										`${task.taskId}:${toIsoDate(weekDate)}`}
									draggable={allowEntryMove &&
										Boolean(hoursByTaskAndDate[`${task.taskId}:${toIsoDate(weekDate)}`])}
									ondragstart={(event) =>
										startEntryDrag(event, `${task.taskId}:${toIsoDate(weekDate)}`)}
									ondragend={() => {
										draggedEntryKey = null;
										entryDropTargetKey = null;
									}}
									ondragover={(event) => {
										if (!draggedEntryKey) return;
										event.preventDefault();
										entryDropTargetKey = `${task.taskId}:${toIsoDate(weekDate)}`;
									}}
									ondrop={(event) => {
										if (!draggedEntryKey) return;
										event.preventDefault();
										dropEntryOn(`${task.taskId}:${toIsoDate(weekDate)}`);
									}}
									onmouseenter={() => {
										hoveredDayIndex = dayIndex;
										hoveredCellKey = `${task.taskId}:${toIsoDate(weekDate)}`;
									}}
									onmouseleave={() => {
										hoveredDayIndex = null;
										hoveredCellKey = null;
									}}
								>
									<input
										class="hours-input"
										inputmode="decimal"
										onfocus={(event) => {
											activeHoursCellKey = `${task.taskId}:${toIsoDate(weekDate)}`;
											// Typing replaces what is there instead of appending to it.
											event.currentTarget.select();
										}}
										onblur={() => closeHoursStepper(`${task.taskId}:${toIsoDate(weekDate)}`)}
										bind:value={
											() => hoursByTaskAndDate[`${task.taskId}:${toIsoDate(weekDate)}`] ?? '',
											(newValue) =>
												(hoursByTaskAndDate[`${task.taskId}:${toIsoDate(weekDate)}`] =
													sanitizeHoursInput(newValue))
										}
									/>

									{#if activeHoursCellKey === `${task.taskId}:${toIsoDate(weekDate)}`}
						<div class="hours-stepper">
							<button
								aria-label="Прибавить час"
								title="+1 ч · с Alt +15 мин"
								onmousedown={(event) => {
									event.preventDefault();
									stepHours(`${task.taskId}:${toIsoDate(weekDate)}`, event.altKey ? 0.25 : 1);
								}}
							>
								<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
									<path d="M4 10 8 6l4 4" fill="none" stroke="currentColor" stroke-width="1.8"
										stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</button>
							<button
								aria-label="Убавить час"
								title="−1 ч · с Alt −15 мин"
								onmousedown={(event) => {
									event.preventDefault();
									stepHours(`${task.taskId}:${toIsoDate(weekDate)}`, event.altKey ? -0.25 : -1);
								}}
							>
								<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
									<path d="M4 6 8 10l4-4" fill="none" stroke="currentColor" stroke-width="1.8"
										stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</button>
						</div>
					{/if}
								</div>
							{/each}
						</div>
					{/each}

					{#if !collapsedProjectIds.includes(project.projectId)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="grid-row add-task-row"
							class:is-drop-before={draggedTaskId &&
								dropTargetProjectId === project.projectId &&
								dropBeforeTaskId === null}
							ondragover={(event) => updateDropTarget(event, project.projectId, null)}
							ondrop={dropDraggedTask}
						>
							<div class="grid-cell is-full-span">
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
							</div>
						</div>
					{/if}
				{/each}

				<div class="grid-row add-project-row">
					<div class="grid-cell is-full-span">
						{#if isAddingProjectInTable}
							<!-- svelte-ignore a11y_autofocus -->
							<input
								class="task-title-input"
								placeholder="Название проекта"
								bind:value={newProjectNameInTable}
								autofocus
								onkeydown={(event) => {
									if (event.key === 'Enter') confirmNewProjectInTable();
									if (event.key === 'Escape') isAddingProjectInTable = false;
								}}
								onblur={confirmNewProjectInTable}
							/>
						{:else}
							<button
								class="add-task-button"
								onclick={() => {
									newProjectNameInTable = '';
									isAddingProjectInTable = true;
								}}
							>
								+ Новый проект
							</button>
						{/if}
					</div>
				</div>

				{#if visibleTaskCount === 0}
					<div class="grid-row">
						<div class="grid-cell is-full-span">
							<div class="empty-week">
								{#if searchQuery.trim()}
									<strong>Ничего не найдено по «{searchQuery.trim()}»</strong>
									<span>Поиск смотрит по названию и описанию задачи внутри этого периода.</span>
								{:else if emptyHintText}
									<strong>Ничего не подошло</strong>
									<span>{emptyHintText}</span>
								{:else}
									<strong>
										{viewMode === 'week' ? 'На этой неделе задач нет' : 'В этом месяце задач нет'}
									</strong>
									<button class="pill-button is-dark" onclick={() => onRequestNewTask()}>
										+ Добавить
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/key}
	</div>

	<!-- Real scrollbar, but only as wide as the hour columns. -->
	<div class="scrollbar-strip">
		<div class="scrollbar-strip-spacer" style="width: {taskColumnWidth}rem"></div>
		<div
			class="scrollbar-strip-track"
			bind:this={scrollbarStripElement}
			onscroll={syncHorizontalScrollFromStrip}
		>
			<div style="width: {totalDayColumnsWidth}rem; height: 1px" aria-hidden="true"></div>
		</div>
	</div>

	<!-- Totals live outside the scroller so they sit at the bottom of the panel. -->
	<div class="totals-scroll-area" bind:this={totalsScrollElement}>
		<div class="grid totals-grid" style="grid-template-columns: {gridColumns}">
			<div class="grid-row">
				<div class="grid-cell task-cell">
					Всего часов — {formatHours(totalHoursForWeek)} из {formatHours(expectedPeriodHours)}
				</div>

				{#each totalsPerDay as dayTotal, dayIndex}
					<div
						class="grid-cell day-cell is-total"
						class:is-selected-day={isSameDay(visibleDates[dayIndex], selectedDate)}
						class:is-today={isSameDay(visibleDates[dayIndex], new Date())}
					>
						<div class="day-total">
							{formatHours(Math.min(dayTotal, targetHoursPerDay))}
							{#if dayTotal > targetHoursPerDay}
								<span class="overtime-badge">+{formatHours(dayTotal - targetHoursPerDay)}</span>
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
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

{#if draggedTaskId && dragGhostPosition}
<div class="drag-ghost" style="left: {dragGhostPosition.x + 12}px; top: {dragGhostPosition.y + 12}px">
	{draggedTaskTitle}
</div>
{/if}

<style>
	.project-group-avatar {
		width: 1.125rem;
		height: 1.125rem;
		border-radius: 50%;
		object-fit: cover;
	}

	.day-cell.is-entry-dragging {
		opacity: 0.4;
	}

	.day-cell.is-entry-drop-target {
		box-shadow: inset 0 0 0 2px var(--color-vacation-strong);
	}

	.task-owner {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		margin-right: 0.375rem;
		padding: 0.0625rem 0.3125rem 0.0625rem 0.0625rem;
		border-radius: 999px;
		background: var(--color-cell-tint);
		color: var(--color-text-muted);
		font-size: 0.6875rem;
		vertical-align: middle;
	}

	.task-owner.is-clickable:hover {
		background: var(--color-cell-hover-tint);
		color: var(--color-text);
	}

	.task-owner-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		margin-left: 0.25rem;
	}

	.task-owner-avatar {
		width: 0.875rem;
		height: 0.875rem;
		border-radius: 50%;
		object-fit: cover;
	}

	.pill-button {
		border: 0;
		border-radius: 0.5rem;
		background: var(--color-panel);
		color: var(--color-text);
		padding: 0.375rem 0.75rem;
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.pill-button.is-dark {
		background: var(--color-shell);
		color: var(--color-panel);
	}

	/* Never scrolls sideways on its own — the strip below drives it. */
	.scrollbar-strip {
		display: flex;
	}

	.scrollbar-strip-spacer {
		flex: none;
	}

	.scrollbar-strip-track {
		flex: 1;
		min-width: 0;
		height: 0.875rem;
		overflow-x: auto;
		overflow-y: hidden;
	}

	.scrollbar-strip-track::-webkit-scrollbar {
		height: 0.5rem;
	}

	.scrollbar-strip-track::-webkit-scrollbar-thumb {
		background: #c9c9c9;
		border-radius: 0.25rem;
	}

	.year-view {
		flex: 1;
		overflow: auto;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr));
		gap: 1.125rem;
		padding: 1rem;
	}

	.year-month-name {
		border: 0;
		background: none;
		padding: 2px 0.25rem;
		margin-bottom: 0.375rem;
		border-radius: 0.375rem;
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.12s ease;
	}

	.year-month-name:hover {
		background: #f1f1f1;
	}

	.year-month-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}

	.year-day {
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 0.25rem;
		background: #f0f0f0;
		font: inherit;
		font-size: 0.5625rem;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: transform 0.12s ease;
	}

	.year-day:hover {
		transform: scale(1.25);
	}

	.year-day.is-today {
		outline: 2px solid var(--color-shell);
		outline-offset: 1px;
	}

	.year-day.is-empty {
		background: #f4f4f4;
		color: #bdbdbd;
	}

	.year-day.is-vacation {
		color: var(--color-panel);
		opacity: 1;
	}

	/* Worked during vacation — outlined so it stands out. */
	.year-day.is-worked-vacation {
		outline: 1.5px solid var(--color-day-full-text);
		outline-offset: -1.5px;
	}

	.year-day-blank {
		aspect-ratio: 1;
	}

	/* One easing everywhere, so interactions feel like one system. */
	.pill-button,
	.project-toggle,
	.add-task-button,
	.task-drag-handle,
	.task-editor-confirm,
	.year-day {
		transition:
			background 0.14s cubic-bezier(0.33, 1, 0.68, 1),
			color 0.14s cubic-bezier(0.33, 1, 0.68, 1),
			opacity 0.14s cubic-bezier(0.33, 1, 0.68, 1),
			transform 0.14s cubic-bezier(0.33, 1, 0.68, 1);
	}

	.pill-button:hover,
	.task-editor-confirm:hover {
		opacity: 0.85;
	}

	.project-toggle:hover {
		opacity: 0.75;
	}

	.task-drag-handle:hover {
		color: #8f8f8f;
	}

	.task-title-button:hover .task-title-line {
		text-decoration: underline;
		text-decoration-color: #d8d8d8;
		text-underline-offset: 3px;
	}

	.hours-stepper,
	.task-editor-floating {
		animation: panel-in 0.16s cubic-bezier(0.33, 1, 0.68, 1);
	}

	.task-editor-floating {
		transform-origin: top right;
	}

	/* --- The grid. Rows are subgrids so every row shares the same columns. --- */
	.grid-scroll-area {
		flex: 1;
		overflow-x: hidden;
		overflow-y: auto;
		min-height: 0;
	}

	.grid {
		display: grid;
		/* Fills the panel; tracks never shrink below their rem minimum, so the
		   scroll area takes over once the columns genuinely need more room. */
		width: 100%;
		font-size: 0.8125rem;
	}

	.grid-row {
		display: grid;
		grid-template-columns: subgrid;
		grid-column: 1 / -1;
	}

	.grid-cell {
		position: relative;
		/* visible, so the floating hour stepper is never clipped */
		overflow: visible;
		min-width: 0;
		padding: var(--row-padding, 0.5rem) 0.625rem;
		border-bottom: 1px solid var(--color-border);
		border-right: 1px solid var(--color-border);
		background: var(--color-panel);
		transition: background 0.12s ease;
	}

	.grid-cell.is-full-span {
		grid-column: 1 / -1;
		background: none;
	}

	/* Task column stays put while the days scroll sideways. */
	.task-cell {
		position: sticky;
		left: 0;
		z-index: 2;
	}

	.is-header {
		position: sticky;
		top: 0;
		z-index: 5;
	}

	.is-header .task-cell {
		z-index: 6;
	}

	.day-cell {
		padding: 0;
		text-align: center;
	}

	.day-cell.is-day-header {
		padding: var(--row-padding, 0.5rem) 0.375rem;
		font-weight: 500;
	}

	.day-cell.is-day-header.is-selected-day {
		background: var(--color-cell-tint);
	}

	/* Declared last so today beats the selected-day tint. */
	.day-cell.is-day-header.is-today {
		background: var(--color-shell);
		color: var(--color-panel);
	}

	.day-cell.is-day-header.is-empty {
		color: #b0b0b0;
	}

	.day-cell.is-day-header.is-vacation {
		box-shadow: inset 0 -3px 0 var(--color-vacation-strong);
	}

	/* Dashes instead of a solid line while the request is unanswered. */
	.day-cell.is-day-header.is-vacation-pending {
		box-shadow: none;
		border-bottom: 3px dashed var(--color-vacation-strong);
	}

	.day-cell.is-today {
		background: var(--color-cell-tint);
	}

	/* Column hover is a whisper; the cell itself gets the accent. */
	.day-cell.is-hovered {
		background: var(--color-hover-tint);
	}

	.day-cell.is-cell-hovered {
		background: var(--color-cell-hover-tint);
		box-shadow: inset 0 0 0 1px #e2e2e2;
	}

	.task-row:hover .task-cell {
		background: var(--color-hover-tint);
	}

	.task-cell.is-clickable {
		cursor: text;
	}

	.project-row .grid-cell {
		font-weight: 600;
	}

	.add-task-row .grid-cell,
	.add-project-row .grid-cell {
		background: var(--color-panel);
	}

	.add-project-row .grid-cell {
		border-top: 1px solid var(--color-border);
	}

	.column-resize-handle {
		position: absolute;
		top: 0;
		right: -0.1875rem;
		width: 0.4375rem;
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

	.totals-scroll-area {
		overflow: hidden;
	}

	.totals-grid .grid-cell {
		font-weight: 600;
		border-top: 1px solid var(--color-border);
		border-bottom: 0;
		padding: var(--row-padding, 0.5rem) 0.625rem;
	}

	/* Drag feedback */
	.grid-row.is-dragging {
		opacity: 0.4;
	}

	.grid-row.is-drop-before .grid-cell {
		box-shadow: inset 0 2px 0 var(--color-vacation-strong);
	}

	.grid-row.is-drop-into .grid-cell {
		box-shadow: inset 0 -2px 0 var(--color-vacation-strong);
	}

	/* Editing fills the whole cell — no height tricks needed with grid. */
	.task-cell:has(.task-editor) {
		padding: 0;
	}

	/* Stepper floats beside the focused cell, above everything. */
	.hours-stepper {
		position: absolute;
		top: 50%;
		right: 0.125rem;
		transform: translateY(-50%);
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 2px;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		background: var(--color-panel);
		box-shadow: 0 0.25rem 0.75rem rgb(0 0 0 / 0.14);
	}

	.hours-stepper button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.25rem;
		padding: 0;
		line-height: 0;
		border: 0;
		border-radius: 0.3125rem;
		background: none;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background 0.1s ease, color 0.1s ease;
	}

	.hours-stepper button svg {
		display: block;
	}

	.hours-stepper button:hover {
		background: #f0f0f0;
		color: var(--color-text);
	}

	.project-row {
		cursor: pointer;
	}

	.project-row:hover .grid-cell {
		background: rgb(0 0 0 / 0.035);
	}

	/* Stays put while the day columns scroll sideways. */
	.project-toggle {
		position: sticky;
		left: 0.625rem;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		border: 0;
		background: none;
		padding: 0;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.project-chevron {
		display: inline-flex;
		align-items: center;
		color: var(--color-text-muted);
		transition: transform 0.18s cubic-bezier(0.33, 1, 0.68, 1);
	}

	.project-chevron.is-collapsed {
		transform: rotate(-90deg);
	}

	.project-task-count {
		color: var(--color-text-muted);
		font-weight: 500;
		margin-left: 0.25rem;
	}

	/* Only shows on the row the pointer is on, so the header stays quiet. */
	.project-edit-button {
		margin-left: 0.375rem;
		border: 0;
		border-radius: 0.375rem;
		background: none;
		padding: 0 0.25rem;
		font: inherit;
		line-height: 1;
		color: var(--color-text-muted);
		cursor: pointer;
		opacity: 0;
	}

	.project-row:hover .project-edit-button {
		opacity: 1;
	}

	.project-edit-button:hover {
		background: rgb(0 0 0 / 0.06);
		color: var(--color-text);
	}

	/* Selected day: grey header, column stays white. */
	/* Today: black header, whole column slightly grey. Wins over selected. */
	.day-number {
		margin-left: 0.375rem;
		color: #aaa;
	}

	.project-dot {
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		margin-right: 0.4375rem;
	}

	/* Editing fills the whole cell; the project picker floats over the rows below. */
	/* height:1px is the table trick — the cell still fills the row, but now a
	   child's height:100% resolves against the row instead of collapsing. */
	/* Flex + stretch makes the field fill the row height, whatever the row is. */
	.task-editor {
		position: relative;
		display: flex;
		align-items: center;
		min-height: 2.375rem;
		height: 100%;
		gap: 0.375rem;
	}

	.task-title-input {
		flex: 1;
		width: 100%;
		box-sizing: border-box;
		/* fills the cell, not a smaller box inside it */
		height: 100%;
		border: 1px solid #d5d5d5;
		border-radius: 0.25rem;
		background: #fafafa;
		outline: 0;
		padding: 0.5rem 7.375rem 0.5rem 0.5625rem;
		font: inherit;
		resize: none;
		line-height: 1.45;
		transition: border-color 0.12s ease, background 0.12s ease;
	}

	.task-title-input:focus {
		border-color: #b4b4b4;
		background: var(--color-panel);
	}

	.task-editor-floating {
		position: absolute;
		top: 0.1875rem;
		right: 0.1875rem;
		z-index: 30;
		display: flex;
		gap: 0.375rem;
		background: var(--color-panel);
		border: 1px solid var(--color-border);
		border-radius: 0.625rem;
		padding: 0.375rem;
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.12);
	}

	.task-editor-confirm {
		border: 0;
		border-radius: 0.4375rem;
		background: var(--color-shell);
		color: var(--color-panel);
		width: 1.875rem;
		cursor: pointer;
		font-size: 0.8125rem;
	}

	.empty-week {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.625rem;
		padding: 1.75rem 0.25rem;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}

	.empty-week strong {
		color: var(--color-text);
		font-size: 0.875rem;
	}

	.task-row-content {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
	}

	.task-drag-handle {
		color: #c4c4c4;
		cursor: grab;
		font-size: 0.75rem;
		user-select: none;
	}

	.task-drag-handle:active {
		cursor: grabbing;
	}

	/* Accent line showing exactly where the task will land. */
	.drag-ghost {
		position: fixed;
		z-index: 100;
		pointer-events: none;
		max-width: 16.25rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 0.4375rem 0.6875rem;
		border-radius: 0.5625rem;
		background: var(--color-shell);
		color: var(--color-panel);
		font-size: 0.75rem;
		box-shadow: 0 8px 22px rgb(0 0 0 / 0.28);
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

	.task-project-select {
		max-width: 6rem;
		border: 1px solid var(--color-border);
		border-radius: 0.4375rem;
		padding: 0.3125rem 0.5rem;
		font: inherit;
		font-size: 0.75rem;
		background: var(--color-panel);
	}

	.add-task-button {
		border: 0;
		background: none;
		padding: 2px 0;
		font: inherit;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.add-task-button:hover {
		color: var(--color-text);
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
		height: 100%;
		min-height: 2.375rem;
		display: block;
		border: 0;
		background: transparent;
		text-align: center;
		font: inherit;
		outline-offset: -2px;
	}

	.day-total {
		text-align: center;
	}

	.overtime-badge {
		color: var(--color-overtime);
	}

	.day-progress-track {
		position: relative;
		height: 0.3125rem;
		margin-top: 0.3125rem;
		border-radius: 0.1875rem;
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
