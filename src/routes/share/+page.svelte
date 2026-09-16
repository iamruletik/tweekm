<!--
	`/share` — the public report. Everything it shows comes from the URL: period,
	scope (one person or studio-wide), client, projects, employees, rate.
	The owner gets an edit bar (titles, body text, hours, drop rows, rate) that
	touches the report only, never the grid; a client sees a read-only sheet.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { initialProjectsWithTasks, buildFakeMonthOfHours, toIsoDate } from '$lib/fakeData';
	import { aggregateHours, formatHours } from '$lib/hours';
	import {
		studioProjects,
		studioTasks,
		buildStudioHours,
		clientById,
		employeeById,
		resolveProject,
		currencySymbols
	} from '$lib/studioData';
	import { studioProfile } from '$lib/studioProfile.svelte';

	// Public read-only report. Every option comes from the URL — no database yet.

	const monthNames = [
		'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
		'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
	];

	// Two sources: a person's own grid, or the whole studio for a client invoice.
	const isStudioScope = $derived(page.url.searchParams.get('scope') === 'studio');
	const reportClientId = $derived(page.url.searchParams.get('client') ?? '');
	const reportClient = $derived(reportClientId ? clientById(reportClientId) : undefined);
	const showWhoDidIt = $derived(page.url.searchParams.get('people') === '1');

	const personalHours = buildFakeMonthOfHours();
	const studioHours = buildStudioHours();
	const hoursByTaskAndDate = $derived(isStudioScope ? studioHours : personalHours);

	const reportOwnerName = 'David Gordov';
	const reportWorkspaceName = $derived(studioProfile.studioName);
	const signedInUser = {
		userName: 'David Gordov',
		userRole: 'Руководитель студии',
		avatarUrl: 'https://i.pravatar.cc/80?img=12'
	};

	const fromDate = $derived(page.url.searchParams.get('from') ?? '');
	const toDate = $derived(page.url.searchParams.get('to') ?? '');
	const hourlyRateFromLink = $derived(Number(page.url.searchParams.get('rate') ?? '0'));
	const showDescriptions = $derived(page.url.searchParams.get('details') === '1');

	function idsFromParam(paramName: string): string[] {
		return (page.url.searchParams.get(paramName) ?? '').split(',').filter(Boolean);
	}

	const selectedClientIds = $derived(
		reportClientId ? [reportClientId] : idsFromParam('clients')
	);
	const selectedEmployeeIds = $derived(idsFromParam('employees'));

	// Projects of the report: a client's projects, or whatever the link lists.
	const sourceProjects = $derived.by(() => {
		if (!isStudioScope) return initialProjectsWithTasks;
		const clientProjects = studioProjects.filter((project) => {
			if (project.mergedIntoProjectId) return false;
			if (selectedClientIds.length === 0) return true;
			const clientId = resolveProject(project.projectId, studioProjects).clientId;
			return Boolean(clientId && selectedClientIds.includes(clientId));
		});
		return clientProjects.map((project) => ({
			projectId: project.projectId,
			projectName: project.projectName,
			projectColor: project.projectColor,
			tasks: studioTasks.filter(
				(task) =>
					task.projectId === project.projectId &&
					(selectedEmployeeIds.length === 0 || selectedEmployeeIds.includes(task.employeeId))
			)
		}));
	});

	const selectedProjectIds = $derived.by(() => {
		const raw = page.url.searchParams.get('projects');
		if (!raw) return sourceProjects.map((project) => project.projectId);
		return raw.split(',').filter(Boolean);
	});

	// Fake session until auth lands: the owner edits, the client only reads.
	let isSignedInAsOwner = $state(true);
	let isPreviewingAsClient = $state(false);
	const canEditReport = $derived(isSignedInAsOwner && !isPreviewingAsClient);

	// Report-only edits — they never touch the grid.
	let titleOverrides = $state<Record<string, string>>({});
	let descriptionOverrides = $state<Record<string, string>>({});
	let hoursOverrides = $state<Record<string, number>>({});
	let excludedTaskIds = $state<string[]>([]);
	let hourlyRateOverride = $state<number | null>(null);
	let isReportLinkCopied = $state(false);

	// rate=0 in the link means "no money in this report" — not "fall back to the client".
	const isMoneyHidden = $derived(page.url.searchParams.get('rate') === '0');
	const hourlyRate = $derived(
		isMoneyHidden ? 0 : (hourlyRateOverride ?? (hourlyRateFromLink || reportClient?.hourlyRate || 0))
	);

	const currencySymbol = $derived(reportClient ? currencySymbols[reportClient.currency] : '₽');

	function excludeTaskFromReport(taskId: string) {
		excludedTaskIds = [...excludedTaskIds, taskId];
	}

	function restoreExcludedTasks() {
		excludedTaskIds = [];
	}

	async function copyReportLink() {
		await navigator.clipboard.writeText(page.url.href);
		isReportLinkCopied = true;
	}

	function formatMoney(amount: number): string {
		return new Intl.NumberFormat('ru-RU').format(Math.round(amount));
	}

	function formatReadableDate(isoDate: string): string {
		if (!isoDate) return '';
		const date = new Date(isoDate);
		return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
	}

	function isDateInRange(isoDate: string): boolean {
		if (fromDate && isoDate < fromDate) return false;
		if (toDate && isoDate > toDate) return false;
		return true;
	}

	// Hours per task inside the report period, aggregated once.
	const hoursInRangeByTaskId = $derived(
		aggregateHours(hoursByTaskAndDate, (taskId, isoDate) =>
			isDateInRange(isoDate) ? taskId : null
		)
	);

	function taskHoursInRange(taskId: string): number {
		return hoursInRangeByTaskId[taskId] ?? 0;
	}

	type ReportTask = { taskId: string; taskTitle: string; taskDescription: string; hours: number };
	type ReportProject = {
		projectId: string;
		projectName: string;
		projectColor: string;
		hours: number;
		tasks: ReportTask[];
	};

	// Only projects and tasks with hours inside the period end up in the report.
	const reportProjects = $derived.by<ReportProject[]>(() =>
		sourceProjects
			.filter((project) => selectedProjectIds.includes(project.projectId))
			.map((project) => {
				const tasks = project.tasks
					.filter((task) => !excludedTaskIds.includes(task.taskId))
					.map((task) => ({
						...task,
						taskTitle: titleOverrides[task.taskId] ?? task.taskTitle,
						taskDescription: descriptionOverrides[task.taskId] ?? task.taskDescription,
						hours: hoursOverrides[task.taskId] ?? taskHoursInRange(task.taskId)
					}))
					.filter((task) => task.hours > 0);
				return {
					projectId: project.projectId,
					projectName: project.projectName,
					projectColor: project.projectColor,
					tasks,
					hours: tasks.reduce((sum, task) => sum + task.hours, 0)
				};
			})
			.filter((project) => project.tasks.length > 0)
	);

	const totalHours = $derived(
		reportProjects.reduce((sum, project) => sum + project.hours, 0)
	);

	const totalTaskCount = $derived(
		reportProjects.reduce((sum, project) => sum + project.tasks.length, 0)
	);

	const generatedAt = formatReadableDate(toIsoDate(new Date()));

	function ownerOfTask(taskId: string): string {
		const task = studioTasks.find((candidate) => candidate.taskId === taskId);
		const owner = task ? employeeById(task.employeeId) : undefined;
		return owner?.employeeName ?? '';
	}
</script>

<svelte:head>
	<title>Отчёт по часам — {reportWorkspaceName}</title>
</svelte:head>

<main class="report-shell">
	{#if isSignedInAsOwner}
		<div class="owner-bar">
			<div class="owner-bar-who">
				<img class="owner-avatar" src={signedInUser.avatarUrl} alt="" />
				<div class="owner-identity">
					<span class="owner-identity-name">{signedInUser.userName}</span>
					<span class="owner-identity-role">{signedInUser.userRole}</span>
				</div>
				<span class="owner-mode-tag" class:is-client={isPreviewingAsClient}>
					{isPreviewingAsClient ? 'Просмотр как клиент' : 'Режим редактирования'}
				</span>
			</div>
			{#if excludedTaskIds.length > 0 && !isPreviewingAsClient}
				<button class="owner-bar-button" onclick={restoreExcludedTasks}>
					Вернуть скрытые ({excludedTaskIds.length})
				</button>
			{/if}
			<button
				class="owner-bar-button"
				onclick={() => (isPreviewingAsClient = !isPreviewingAsClient)}
			>
				{isPreviewingAsClient ? 'Вернуться к редактированию' : 'Смотреть как клиент'}
			</button>
			<button
				class="owner-bar-button is-primary"
				title="Правки живут только в этой вкладке, пока нет базы"
				onclick={copyReportLink}
			>
				{isReportLinkCopied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
			</button>
		</div>
	{/if}

	<article class="report-sheet">
		<header class="report-header">
			<div class="report-header-text">
				{#if studioProfile.logoDataUrl}
					<img class="report-logo" src={studioProfile.logoDataUrl} alt={reportWorkspaceName} />
				{/if}
				<h1>Отчёт по часам</h1>
				<p class="report-period">
					{formatReadableDate(fromDate)} — {formatReadableDate(toDate)}
				</p>
			</div>
			<div class="report-owner">
				<strong>{reportClient ? reportClient.clientName : reportOwnerName}</strong>
				<span>{reportWorkspaceName}</span>
			</div>
		</header>

		<section class="report-summary">
			<div class="summary-card">
				<span class="summary-label">Всего часов</span>
				<strong class="summary-value">{formatHours(totalHours)} ч</strong>
			</div>
			<div class="summary-card">
				<span class="summary-label">Задач</span>
				<strong class="summary-value">{totalTaskCount}</strong>
			</div>
			{#if hourlyRate > 0}
				<div class="summary-card">
					<span class="summary-label">Ставка</span>
					{#if canEditReport}
						<input
							class="summary-value editable-field is-rate"
							type="number"
							min="0"
							step="100"
							value={hourlyRate}
							oninput={(event) => (hourlyRateOverride = Number(event.currentTarget.value))}
						/>
					{:else}
						<strong class="summary-value">{formatMoney(hourlyRate)} {currencySymbol}/ч</strong>
					{/if}
				</div>
				<div class="summary-card is-total">
					<span class="summary-label">К оплате</span>
					<strong class="summary-value">{formatMoney(totalHours * hourlyRate)} {currencySymbol}</strong>
				</div>
			{/if}
		</section>

		{#if reportProjects.length === 0}
			<p class="report-empty">За выбранный период часов нет.</p>
		{:else}
			{#each reportProjects as project (project.projectId)}
				<section class="report-project">
					<div class="report-project-header">
						<span class="report-project-dot" style:background={project.projectColor}></span>
						<strong class="report-project-name">{project.projectName}</strong>
						<span class="report-project-hours">{formatHours(project.hours)} ч</span>
						{#if hourlyRate > 0}
							<span class="report-project-money">
								{formatMoney(project.hours * hourlyRate)} {currencySymbol}
							</span>
						{/if}
					</div>

					{#each project.tasks as task (task.taskId)}
						<div
							class="report-task-row"
							class:has-money={hourlyRate > 0}
							class:is-editable={canEditReport}
						>
							<div class="report-task-text">
								{#if canEditReport}
									<input
										class="report-task-title editable-field"
										value={task.taskTitle}
										oninput={(event) =>
											(titleOverrides[task.taskId] = event.currentTarget.value)}
									/>
								{:else}
									<span class="report-task-title">{task.taskTitle}</span>
								{/if}
								{#if showWhoDidIt && isStudioScope}
									<span class="report-task-owner">{ownerOfTask(task.taskId)}</span>
								{/if}
								{#if canEditReport && showDescriptions}
									<textarea
										class="report-task-description editable-field is-body"
										rows="1"
										placeholder="Описание работы для клиента"
										value={task.taskDescription}
										oninput={(event) => {
											descriptionOverrides[task.taskId] = event.currentTarget.value;
											event.currentTarget.style.height = 'auto';
											event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
										}}
									></textarea>
								{:else if showDescriptions && task.taskDescription}
									<span class="report-task-description">{task.taskDescription}</span>
								{/if}
							</div>

							{#if canEditReport}
								<span class="report-task-hours">
									<input
										class="editable-field is-hours"
										type="number"
										min="0"
										step="0.25"
										value={task.hours}
										oninput={(event) =>
											(hoursOverrides[task.taskId] = Number(event.currentTarget.value))}
									/> ч
								</span>
							{:else}
								<span class="report-task-hours">{formatHours(task.hours)} ч</span>
							{/if}

							{#if hourlyRate > 0}
								<span class="report-task-money">{formatMoney(task.hours * hourlyRate)} {currencySymbol}</span>
							{/if}

							{#if canEditReport}
								<button
									class="report-task-remove"
									title="Убрать из отчёта"
									onclick={() => excludeTaskFromReport(task.taskId)}>✕</button
								>
							{/if}
						</div>
					{/each}
				</section>
			{/each}
		{/if}

		<footer class="report-footer">
			<span>Только для просмотра · сформирован {generatedAt}</span>
			<span>Tweekm</span>
		</footer>
	</article>
</main>

<style>
	.report-shell {
		min-height: 100dvh;
		padding: 2.5rem 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--color-shell);
	}

	.report-sheet {
		width: min(100%, 48rem);
		height: fit-content;
		background: var(--color-panel);
		border-radius: 0.875rem;
		padding: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.report-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid var(--color-border);
	}

	/* Whatever the studio uploaded, sized so a wide or tall logo both behave. */
	.report-logo {
		display: block;
		max-width: 11rem;
		max-height: 2.75rem;
		object-fit: contain;
		margin-bottom: 0.625rem;
	}

	.report-header h1 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.report-period {
		margin: 0.25rem 0 0;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.report-owner {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.125rem;
		font-size: 0.8125rem;
	}

	.report-owner span {
		color: var(--color-text-muted);
	}

	.report-summary {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 0.5rem;
	}

	.summary-card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem 0.875rem;
		border-radius: 0.625rem;
		background: var(--color-cell-tint);
	}

	.summary-card.is-total {
		background: var(--color-shell);
		color: #ffffff;
	}

	.summary-label {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.summary-card.is-total .summary-label {
		color: var(--color-text-on-shell);
	}

	.summary-value {
		font-size: 1.0625rem;
		font-weight: 600;
	}

	.report-project {
		display: flex;
		flex-direction: column;
	}

	.report-project-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		border-radius: 0.5rem;
		background: var(--color-cell-tint);
		font-size: 0.8125rem;
	}

	.report-project-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
	}

	.report-project-name {
		font-weight: 500;
		margin-right: auto;
	}

	.report-project-hours,
	.report-project-money {
		min-width: 5.5rem;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.report-task-row {
		display: grid;
		grid-template-columns: 1fr 5.5rem;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		border-bottom: 1px solid var(--color-border);
		font-size: 0.8125rem;
	}

	.report-task-row.has-money {
		grid-template-columns: 1fr 5.5rem 5.5rem;
	}

	.report-task-text {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.report-task-owner {
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}

	.report-task-description {
		color: var(--color-text-muted);
		white-space: pre-line;
	}

	.report-task-hours,
	.report-task-money {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.owner-bar {
		width: min(100%, 48rem);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		font-size: 0.75rem;
		color: var(--color-text-on-shell);
	}

	.owner-bar-who {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-right: auto;
		min-width: 0;
	}

	.owner-avatar {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		background: #3a3a3a;
		object-fit: cover;
		flex: none;
	}

	.owner-identity {
		display: flex;
		flex-direction: column;
		line-height: 1.25;
		min-width: 0;
	}

	.owner-identity-name {
		color: #ffffff;
	}

	.owner-identity-role {
		color: var(--color-text-muted);
	}

	.owner-mode-tag {
		border: 1px solid rgb(255 255 255 / 0.18);
		border-radius: 999px;
		padding: 0.1875rem 0.5rem;
		color: var(--color-day-full-text);
	}

	.owner-mode-tag.is-client {
		color: var(--color-day-partial-text);
	}

	.owner-bar-button {
		border: 1px solid rgb(255 255 255 / 0.18);
		background: transparent;
		color: var(--color-text-on-shell);
		border-radius: 999px;
		padding: 0.3125rem 0.6875rem;
		font: inherit;
		cursor: pointer;
	}

	.owner-bar-button.is-primary {
		background: var(--color-panel);
		color: var(--color-text);
		border-color: transparent;
	}

	.editable-field {
		font: inherit;
		color: inherit;
		border: 1px solid transparent;
		border-radius: 0.375rem;
		padding: 0.125rem 0.25rem;
		margin: -0.125rem -0.25rem;
		background: transparent;
		width: 100%;
	}

	.editable-field:hover {
		border-color: var(--color-border);
	}

	.editable-field:focus {
		outline: none;
		border-color: var(--color-text);
		background: var(--color-panel);
	}

	.editable-field.is-body {
		resize: vertical;
		overflow: hidden;
		font-size: 0.8125rem;
		line-height: 1.35;
		color: var(--color-text-muted);
		margin-top: 0.125rem;
	}

	.editable-field.is-hours {
		width: 3.5rem;
		text-align: right;
	}

	.editable-field.is-rate {
		width: 100%;
	}

	.report-task-row.is-editable {
		grid-template-columns: 1fr 5.5rem 1.5rem;
	}

	.report-task-row.is-editable.has-money {
		grid-template-columns: 1fr 5.5rem 5.5rem 1.5rem;
	}

	.report-task-remove {
		border: 0;
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0;
	}

	.report-task-remove:hover {
		color: var(--color-weekend);
	}

	.report-empty {
		margin: 0;
		padding: 2rem 0;
		text-align: center;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}

	.report-footer {
		display: flex;
		justify-content: space-between;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}
</style>
