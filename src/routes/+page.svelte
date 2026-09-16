<!--
	`/` — one person's week. The grid plus the sidebar, with the task, project,
	share and Excel dialogs. Prototype: always David, on fake in-memory data.
-->
<script lang="ts">
	import { browser } from '$app/environment';

	// Prototype only — fake data, no database yet.

	import {
		initialProjectsWithTasks,
		buildFakeMonthOfHours,
		toIsoDate,
		type ProjectWithTasks,
		projectColorPalette
	} from '$lib/fakeData';
	import WeekGrid from '$lib/components/WeekGrid.svelte';
	import PeriodToolbar from '$lib/components/PeriodToolbar.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import GridToolbar from '$lib/components/GridToolbar.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import ExcelModal, { type ExcelMode } from '$lib/components/ExcelModal.svelte';
	import { visibleDatesFor, type ViewMode } from '$lib/dates';
	import { vacationDatesOf } from '$lib/vacations.svelte';
	import { employeeById } from '$lib/studioData';
	import { studioProfile } from '$lib/studioProfile.svelte';

	let projectsWithTasks = $state<ProjectWithTasks[]>(initialProjectsWithTasks);


	// --- Settings modal ---

	type SettingsTab = 'account' | 'appearance' | 'workday' | 'data' | 'workspaces' | 'shortcuts';

	// Appearance
	let roundToQuarterHour = $state(true);
	let showWeekends = $state(true);
	let accentPreference = $state('system');

	let isSettingsOpen = $state(false);
	let settingsTab = $state<SettingsTab>('appearance');
	let appearanceFont = $state('Inter');
	let appearanceBaseFontSize = $state(16);
	let appearanceRowPadding = $state(8);

	function openSettingsAt(tab: SettingsTab) {
		settingsTab = tab;
		isSettingsOpen = true;
	}

	// --- Project edit modal ---

	let editingProjectId = $state<string | null>(null);
	let editingProjectName = $state('');
	let editingProjectColor = $state('');

	function openProjectEditor(project: ProjectWithTasks) {
		editingProjectId = project.projectId;
		editingProjectName = project.projectName;
		editingProjectColor = project.projectColor;
	}

	const editingProjectTaskCount = $derived(
		projectsWithTasks.find((project) => project.projectId === editingProjectId)?.tasks.length ?? 0
	);

	function deleteEditingProject() {
		if (editingProjectTaskCount > 0) return;
		projectsWithTasks = projectsWithTasks.filter(
			(project) => project.projectId !== editingProjectId
		);
		editingProjectId = null;
	}

	function saveProjectEdits() {
		const project = projectsWithTasks.find(
			(candidate) => candidate.projectId === editingProjectId
		);
		if (project && editingProjectName.trim()) {
			project.projectName = editingProjectName.trim();
			project.projectColor = editingProjectColor;
		}
		editingProjectId = null;
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

	// The modal can create the project it needs, so a first task never blocks.
	const newProjectOptionId = '__new-project__';
	let newTaskNewProjectName = $state('');

	function confirmNewTask() {
		let projectId = newTaskProjectId;
		if (projectId === newProjectOptionId) {
			const projectName = newTaskNewProjectName.trim();
			if (!projectName) return;
			projectId = `project-${Date.now()}`;
			projectsWithTasks = [
				...projectsWithTasks,
				{
					projectId,
					projectName,
					projectColor: projectColorPalette[projectsWithTasks.length % projectColorPalette.length],
					tasks: []
				}
			];
		}
		addTask(projectId, newTaskTitle);
		newTaskNewProjectName = '';
		isNewTaskModalOpen = false;
	}

	// --- Excel import/export: layout only, nothing is read or written yet ---
	let isExcelModalOpen = $state(false);
	let excelMode = $state<ExcelMode>('export');

	function openExcelModal(mode: ExcelMode) {
		excelMode = mode;
		isExcelModalOpen = true;
	}

	// Public share link — options live in the URL, no database yet.
	let isShareModalOpen = $state(false);
	let shareFromDate = $state('');
	let shareToDate = $state('');
	let shareProjectIds = $state<string[]>([]);
	let shareIncludeRate = $state(false);
	let shareHourlyRate = $state(2000);
	let shareShowDescriptions = $state(true);
	let isShareLinkCopied = $state(false);

	// The link starts from the period on screen; the modal can widen it.
	function openShareModal() {
		const periodDates =
			viewMode === 'year'
				? [new Date(selectedDate.getFullYear(), 0, 1), new Date(selectedDate.getFullYear(), 11, 31)]
				: visibleDatesFor(selectedDate, viewMode, true);
		shareFromDate = toIsoDate(periodDates[0] ?? selectedDate);
		shareToDate = toIsoDate(periodDates[periodDates.length - 1] ?? selectedDate);
		shareProjectIds = projectsWithTasks.map((project) => project.projectId);
		isShareLinkCopied = false;
		isShareModalOpen = true;
	}

	function toggleShareProject(projectId: string) {
		shareProjectIds = shareProjectIds.includes(projectId)
			? shareProjectIds.filter((id) => id !== projectId)
			: [...shareProjectIds, projectId];
	}

	const shareLinkPath = $derived.by(() => {
		const params = new URLSearchParams();
		params.set('from', shareFromDate);
		params.set('to', shareToDate);
		if (shareProjectIds.length !== projectsWithTasks.length) {
			params.set('projects', shareProjectIds.join(','));
		}
		if (shareIncludeRate) params.set('rate', String(shareHourlyRate));
		if (shareShowDescriptions) params.set('details', '1');
		return `/share?${params.toString()}`;
	});

	const shareLink = $derived(
		(browser ? window.location.origin : '') + shareLinkPath
	);

	async function copyShareLink() {
		await navigator.clipboard.writeText(shareLink);
		isShareLinkCopied = true;
	}

	function handleGlobalKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			openNewTaskModal();
		}
		if (event.key === 'Escape') {
			isNewTaskModalOpen = false;
			isSettingsOpen = false;
			isShareModalOpen = false;
			isExcelModalOpen = false;
			editingProjectId = null;
		}
	}

	// Hours keyed "taskId:YYYY-MM-DD" — real dates, so each week shows its own numbers.
	let hoursByTaskAndDate = $state<Record<string, string>>(buildFakeMonthOfHours());

	const workspaces = $derived([
		{ workspaceId: 'studio', workspaceName: studioProfile.studioName, workspaceColor: '#28D059' }
	]);
	let currentWorkspaceId = $state('studio');
	const currentWorkspace = $derived(
		workspaces.find((workspace) => workspace.workspaceId === currentWorkspaceId) ?? workspaces[0]
	);

	const interfaceLanguages = [
		{ code: 'ru', label: 'Русский' },
		{ code: 'en', label: 'English' }
	];
	let interfaceLanguage = $state('ru');

	let isSidebarOpen = $state(true);
	// Shared by the toolbar's search box and the grid's row filter.
	let searchQuery = $state('');
	let selectedDate = $state(new Date());
	let viewMode = $state<ViewMode>('week');

	// Which way the grid slides when the period changes; PeriodToolbar sets it.
	let slideDirection = $state(1);

	// --- Norms, editable in settings ---
	let targetHoursPerDay = $state(8);
	let minimumHoursPerDay = $state(6);
	let workDaysPerWeek = $state(5);
	let workDayStartHour = $state(9);
	let workDayEndHour = $state(17);

	// Prototype: this page is always David's week until auth lands.
	const currentEmployeeId = 'david';
	const currentUser = employeeById(currentEmployeeId)!;
	const vacationDates = $derived(vacationDatesOf(currentEmployeeId));

	const visibleDates = $derived(visibleDatesFor(selectedDate, viewMode, showWeekends));

	// The grid owns task creation — the modal just asks it to add one.
	let weekGrid = $state<ReturnType<typeof WeekGrid> | null>(null);
	let gridToolbar = $state<ReturnType<typeof GridToolbar> | null>(null);

	function addTask(projectId: string, taskTitle: string) {
		weekGrid?.addTask(projectId, taskTitle);
	}
</script>

<svelte:head>
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family={appearanceFont.replace(
			' ',
			'+'
		)}:wght@400;500;600&display=swap"
	/>
</svelte:head>

<!-- Any click outside closes whatever menu the toolbar has open. -->
<svelte:window onclick={() => gridToolbar?.closeMenus()} onkeydown={handleGlobalKeydown} />

<div
	class="app-layout"
	class:is-sidebar-collapsed={!isSidebarOpen}
	style="font-family: '{appearanceFont}', ui-sans-serif, system-ui, sans-serif;
	       --row-padding: {appearanceRowPadding / 16}rem"
>
		<Sidebar
			employeeId={currentEmployeeId}
			userName={currentUser.employeeName}
			userRole={currentUser.employeeRole}
			userEmail={currentUser.employeeEmail}
			avatarUrl={currentUser.avatarUrl}
			bind:selectedDate
			bind:isSidebarOpen
			{hoursByTaskAndDate}
			{targetHoursPerDay}
			onRequestNewTask={() => openNewTaskModal()}
			onOpenSettings={(tab) => openSettingsAt(tab as SettingsTab)}
			workspaceName={currentWorkspace.workspaceName}
			workspaceColor={currentWorkspace.workspaceColor}
			bind:interfaceLanguage
			{interfaceLanguages}
			{workspaces}
			{currentWorkspaceId}
			onSwitchWorkspace={(workspaceId) => (currentWorkspaceId = workspaceId)}
		/>

	<main class="week-grid">
		<div class="toolbar">
			<div class="toolbar-group">
				<PeriodToolbar
					bind:selectedDate
					bind:viewMode
					bind:slideDirection
					{showWeekends}
				/>
			</div>

			<GridToolbar
				bind:this={gridToolbar}
				bind:viewMode
				{projectsWithTasks}
				bind:searchQuery
				onFitColumns={() => weekGrid?.fitColumns()}
				onOpenShare={openShareModal}
				onOpenExcel={openExcelModal}
			/>
		</div>

		<WeekGrid
			bind:this={weekGrid}
			bind:projectsWithTasks
			bind:hoursByTaskAndDate
			bind:selectedDate
			bind:viewMode
			{slideDirection}
			{showWeekends}
			{targetHoursPerDay}
			{minimumHoursPerDay}
			{roundToQuarterHour}
			onRequestNewTask={() => openNewTaskModal()}
			onEditProject={openProjectEditor}
			{vacationDates}
			{searchQuery}
			allowEntryMove
		/>

	</main>
</div>


{#if editingProjectId}
	<div class="modal-backdrop" onclick={() => (editingProjectId = null)} role="presentation">
		<div class="modal" onclick={(event) => event.stopPropagation()} role="presentation">
			<h2>Проект</h2>

			<!-- svelte-ignore a11y_autofocus -->
			<input class="modal-input" bind:value={editingProjectName} autofocus />

			<div class="color-swatches">
				{#each projectColorPalette as paletteColor}
					<button
						class="color-swatch"
						class:is-selected={editingProjectColor === paletteColor}
						style="background: {paletteColor}"
						aria-label={paletteColor}
						onclick={() => (editingProjectColor = paletteColor)}
					></button>
				{/each}
			</div>

			{#if editingProjectTaskCount > 0}
				<p class="modal-hint">
					В проекте {editingProjectTaskCount} задач — сначала перенесите или удалите их,
					иначе часы останутся без проекта.
				</p>
			{/if}

			<div class="modal-actions">
				<button
					class="pill-button is-danger"
					disabled={editingProjectTaskCount > 0}
					title={editingProjectTaskCount > 0 ? 'Сначала уберите задачи из проекта' : 'Удалить проект'}
					onclick={deleteEditingProject}
				>
					Удалить
				</button>
				<button class="pill-button" onclick={() => (editingProjectId = null)}>Отмена</button>
				<button class="pill-button is-dark" onclick={saveProjectEdits}>Сохранить</button>
			</div>
		</div>
	</div>
{/if}

<ExcelModal
	bind:isOpen={isExcelModalOpen}
	mode={excelMode}
	isStacked={isSettingsOpen}
	{projectsWithTasks}
	{hoursByTaskAndDate}
	periodFromDate={toIsoDate(visibleDates[0] ?? selectedDate)}
	periodToDate={toIsoDate(visibleDates[visibleDates.length - 1] ?? selectedDate)}
/>

{#if isSettingsOpen}
	<SettingsModal
		bind:isSettingsOpen
		bind:settingsTab
		{projectsWithTasks}
		bind:targetHoursPerDay
		bind:minimumHoursPerDay
		bind:workDaysPerWeek
		bind:workDayStartHour
		bind:workDayEndHour
		bind:roundToQuarterHour
		bind:showWeekends
		bind:accentPreference
		bind:appearanceFont
		bind:appearanceBaseFontSize
		bind:appearanceRowPadding
		bind:interfaceLanguage
		{interfaceLanguages}
		{workspaces}
		bind:currentWorkspaceId
		userName={currentUser.employeeName}
		userRole={currentUser.employeeRole}
		userEmail={currentUser.employeeEmail}
		avatarUrl={currentUser.avatarUrl}
		onOpenExcel={openExcelModal}
	/>
{/if}

{#if isShareModalOpen}
	<div class="modal-backdrop" onclick={() => (isShareModalOpen = false)} role="presentation">
		<div class="modal is-share" onclick={(event) => event.stopPropagation()} role="presentation">
			<h2>Публичная ссылка на отчёт</h2>

			<div class="settings-row">
				<div class="settings-row-text">
					<strong>Период</strong>
					<span>Какие дни попадут в отчёт</span>
				</div>
				<div class="share-dates">
					<input class="modal-input is-compact" type="date" bind:value={shareFromDate} />
					<input class="modal-input is-compact" type="date" bind:value={shareToDate} />
				</div>
			</div>

			<div class="settings-row is-stacked">
				<div class="settings-row-text">
					<strong>Проекты</strong>
					<span>Выбрано: {shareProjectIds.length} из {projectsWithTasks.length}</span>
				</div>
				<div class="share-projects">
					{#each projectsWithTasks as project (project.projectId)}
						<label class="share-project">
							<input
								type="checkbox"
								checked={shareProjectIds.includes(project.projectId)}
								onchange={() => toggleShareProject(project.projectId)}
							/>
							<span class="share-project-dot" style:background={project.projectColor}></span>
							{project.projectName}
						</label>
					{/each}
				</div>
			</div>

			<div class="settings-row">
				<div class="settings-row-text">
					<strong>Стоимость часа</strong>
					<span>Показать сумму в отчёте</span>
				</div>
				<div class="share-rate">
					{#if shareIncludeRate}
						<input
							class="modal-input is-tiny"
							type="number"
							min="0"
							step="100"
							bind:value={shareHourlyRate}
						/>
					{/if}
					<input type="checkbox" class="settings-switch" bind:checked={shareIncludeRate} />
				</div>
			</div>

			<div class="settings-row">
				<div class="settings-row-text">
					<strong>Описания задач</strong>
					<span>Показывать текст под названием</span>
				</div>
				<input type="checkbox" class="settings-switch" bind:checked={shareShowDescriptions} />
			</div>

			<div class="share-link-row">
				<input class="modal-input is-compact share-link-input" readonly value={shareLink} />
				<button class="pill-button" onclick={copyShareLink}>
					{isShareLinkCopied ? 'Скопировано' : 'Копировать'}
				</button>
			</div>

			<div class="modal-actions">
				<button class="pill-button" onclick={() => (isShareModalOpen = false)}>Закрыть</button>
				<a class="pill-button is-dark" href={shareLinkPath} target="_blank" rel="noreferrer">
					Открыть отчёт
				</a>
			</div>
		</div>
	</div>
{/if}

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
				<option value={newProjectOptionId}>+ Новый проект…</option>
			</select>

			{#if newTaskProjectId === newProjectOptionId}
				<input
					class="modal-input"
					placeholder="Название нового проекта"
					bind:value={newTaskNewProjectName}
					onkeydown={(event) => {
						if (event.key === 'Enter') confirmNewTask();
					}}
				/>
			{/if}

			<div class="modal-actions">
				<button class="pill-button" onclick={() => (isNewTaskModalOpen = false)}>Отмена</button>
				<button class="pill-button is-dark" onclick={confirmNewTask}>Создать</button>
			</div>
		</div>
	</div>
{/if}

<style>	/* Sidebar sits on the right, grid on the left. */
	.app-layout {
		display: grid;
		/* Sidebar breathes with the viewport instead of being pinned to 264px. */
		grid-template-columns: 1fr clamp(15rem, 18vw, 20rem);
		height: 100dvh;
		overflow: hidden;
		transition: grid-template-columns 0.15s ease;
	}
	.app-layout.is-sidebar-collapsed {
		grid-template-columns: 1fr 3.5rem;
	}
	.pill-button.is-dark {
		background: var(--color-shell);
		color: var(--color-panel);
	}
	.pill-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.modal-hint {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.4;
		color: var(--color-text-muted);
	}
	.week-grid {
		order: 1;
		/* Lets the panel shrink instead of pushing the page wider than the screen. */
		min-width: 0;
		display: flex;
		flex-direction: column;
		background: var(--color-panel);
		border-radius: 0.875rem;
		margin: 0.625rem 0 0.625rem 0.625rem;
		overflow: hidden;
	}
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-border);
	}

@keyframes panel-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
	}
	.color-swatches {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}
	.color-swatch {
		width: 1.625rem;
		height: 1.625rem;
		border: 0;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: transform 0.14s cubic-bezier(0.33, 1, 0.68, 1);
	}
	.color-swatch:hover {
		transform: scale(1.12);
	}
	.color-swatch.is-selected {
		outline: 2px solid var(--color-shell);
		outline-offset: 2px;
	}
	/* One setting per row: label + explanation on the left, control on the right. */
	.settings-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.6875rem 0;
		border-bottom: 1px solid var(--color-border);
	}
	.settings-row:last-of-type {
		border-bottom: 0;
	}
	.settings-row-text {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}
	.settings-row-text strong {
		font-size: 0.8125rem;
		font-weight: 500;
	}
	.settings-row-text span {
		font-size: 0.6875rem;
		color: var(--color-text-muted);
	}
	/* Tinted square holding the ring, like the reference widget. */
	.modal.is-share {
		width: min(94vw, 30rem);
	}
	.settings-row.is-stacked {
		flex-direction: column;
		align-items: stretch;
		gap: 0.5rem;
	}
	.share-dates {
		display: flex;
		gap: 0.375rem;
	}
	.share-projects {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem 0.75rem;
	}
	.share-project {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.8125rem;
	}
	.share-project-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
	}
	.share-rate {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.share-link-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}
	.share-link-input {
		flex: 1;
		min-width: 0;
		color: var(--color-text-muted);
	}
</style>
