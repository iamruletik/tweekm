<!--
	Import/export dialog for Excel — layout only, the action button is inert.
	Export side: period, format, what to include, plus a live column preview.
	Import side: file pick, header row, column→field mapping, unknown projects.
	Needs: the rows and hours to preview, and the period on screen.
	Writes: nothing yet.
-->
<script lang="ts">
	import type { ProjectWithTasks } from '$lib/fakeData';
	import { formatHours, buildHoursByTaskId, type HoursByTaskAndDate } from '$lib/hours';
	import { toIsoDate } from '$lib/fakeData';

	export type ExcelMode = 'import' | 'export';

	let {
		isOpen = $bindable(false),
		mode = 'export' as ExcelMode,
		isStacked = false,
		projectsWithTasks = [] as ProjectWithTasks[],
		hoursByTaskAndDate = {} as HoursByTaskAndDate,
		periodFromDate = '',
		periodToDate = ''
	}: {
		isOpen: boolean;
		mode?: ExcelMode;
		// True when it opens on top of the settings dialog.
		isStacked?: boolean;
		projectsWithTasks?: ProjectWithTasks[];
		hoursByTaskAndDate?: HoursByTaskAndDate;
		periodFromDate?: string;
		periodToDate?: string;
	} = $props();

	// --- Export options ---
	let fromDate = $state('');
	let toDate = $state('');
	let fileFormat = $state<'xlsx' | 'csv'>('xlsx');
	let oneSheetPerPerson = $state(false);
	let includeDescriptions = $state(true);
	let includeEmptyDays = $state(false);
	let includeMoney = $state(false);

	// The dialog always opens on the period that is on screen.
	$effect(() => {
		if (!isOpen) return;
		fromDate = periodFromDate || toIsoDate(new Date());
		toDate = periodToDate || toIsoDate(new Date());
	});

	// --- Import options ---
	let pickedFileName = $state('');
	let firstRowIsHeader = $state(true);
	let unknownProjectAction = $state<'create' | 'skip'>('create');

	// Which spreadsheet column feeds which field. Letters only — this is a mock.
	const importColumns = [
		{ fieldLabel: 'Дата', columnLetter: 'A', hint: 'ДД.ММ.ГГГГ или 2026-09-13' },
		{ fieldLabel: 'Проект', columnLetter: 'B', hint: 'создастся, если такого нет' },
		{ fieldLabel: 'Задача', columnLetter: 'C', hint: 'название строки' },
		{ fieldLabel: 'Часы', columnLetter: 'D', hint: 'округлим до 15 минут' },
		{ fieldLabel: 'Сотрудник', columnLetter: 'E', hint: 'необязательно' }
	];

	const hoursByTaskId = $derived(buildHoursByTaskId(hoursByTaskAndDate));

	// Enough real rows to judge the shape of the file.
	const previewRows = $derived.by(() =>
		projectsWithTasks
			.flatMap((project) =>
				project.tasks.map((task) => ({
					projectName: project.projectName,
					taskTitle: task.taskTitle,
					taskDescription: task.taskDescription,
					hours: hoursByTaskId[task.taskId] ?? 0
				}))
			)
			.filter((row) => row.hours > 0)
			.slice(0, 5)
	);

	function pickFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		pickedFileName = input.files?.[0]?.name ?? '';
	}
</script>

{#if isOpen}
	<div
		class="modal-backdrop"
		class:is-stacked={isStacked}
		onclick={() => (isOpen = false)}
		role="presentation"
	>
		<div class="modal is-excel" onclick={(event) => event.stopPropagation()} role="presentation">
			<div class="excel-heading">
				<h2>{mode === 'export' ? 'Экспорт в Excel' : 'Импорт из Excel'}</h2>
				<span class="soon-tag">макет</span>
			</div>
			<p class="modal-hint">
				{mode === 'export'
					? 'Так будет выглядеть выгрузка. Сам файл пока не собирается.'
					: 'Так будет выглядеть перенос старой таблицы. Файл пока не читается.'}
			</p>

			{#if mode === 'export'}
				<div class="settings-row">
					<div class="settings-row-text">
						<strong>Период</strong>
						<span>По умолчанию — то, что на экране</span>
					</div>
					<div class="excel-dates">
						<input class="modal-input is-compact" type="date" bind:value={fromDate} />
						<input class="modal-input is-compact" type="date" bind:value={toDate} />
					</div>
				</div>

				<div class="settings-row">
					<div class="settings-row-text">
						<strong>Формат</strong>
						<span>xlsx — с оформлением, csv — только цифры</span>
					</div>
					<select class="modal-input is-compact" bind:value={fileFormat}>
						<option value="xlsx">.xlsx</option>
						<option value="csv">.csv</option>
					</select>
				</div>

				<div class="settings-row">
					<div class="settings-row-text">
						<strong>Лист на каждого сотрудника</strong>
						<span>Иначе все строки одним листом</span>
					</div>
					<input type="checkbox" class="settings-switch" bind:checked={oneSheetPerPerson} />
				</div>

				<div class="settings-row">
					<div class="settings-row-text">
						<strong>Описания задач</strong>
						<span>Текст под названием отдельной колонкой</span>
					</div>
					<input type="checkbox" class="settings-switch" bind:checked={includeDescriptions} />
				</div>

				<div class="settings-row">
					<div class="settings-row-text">
						<strong>Пустые дни</strong>
						<span>Дни без часов — нулями вместо пропуска</span>
					</div>
					<input type="checkbox" class="settings-switch" bind:checked={includeEmptyDays} />
				</div>

				<div class="settings-row">
					<div class="settings-row-text">
						<strong>Суммы по ставке</strong>
						<span>Колонка с деньгами клиента</span>
					</div>
					<input type="checkbox" class="settings-switch" bind:checked={includeMoney} />
				</div>

				<div class="excel-preview">
					<div class="excel-preview-title">Как лягут колонки</div>
					<div class="excel-table-scroll">
						<table class="excel-table">
							<thead>
								<tr>
									<th>Проект</th>
									<th>Задача</th>
									{#if includeDescriptions}<th>Описание</th>{/if}
									<th class="is-number">Часы</th>
									{#if includeMoney}<th class="is-number">Сумма</th>{/if}
								</tr>
							</thead>
							<tbody>
								{#each previewRows as row (row.taskTitle)}
									<tr>
										<td>{row.projectName}</td>
										<td>{row.taskTitle}</td>
										{#if includeDescriptions}
											<td class="is-quiet">{row.taskDescription || '—'}</td>
										{/if}
										<td class="is-number">{formatHours(row.hours)}</td>
										{#if includeMoney}<td class="is-number is-quiet">—</td>{/if}
									</tr>
								{:else}
									<tr>
										<td colspan="5" class="is-quiet">За этот период часов нет</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{:else}
				<label class="excel-drop">
					<input type="file" accept=".xlsx,.xls,.csv" onchange={pickFile} />
					<strong>{pickedFileName || 'Выберите файл или перетащите его сюда'}</strong>
					<span>.xlsx, .xls или .csv — как выгружает Google Таблицы</span>
				</label>

				<div class="settings-row">
					<div class="settings-row-text">
						<strong>Первая строка — заголовки</strong>
						<span>Не попадёт в часы</span>
					</div>
					<input type="checkbox" class="settings-switch" bind:checked={firstRowIsHeader} />
				</div>

				<div class="excel-preview">
					<div class="excel-preview-title">Какая колонка что значит</div>
					{#each importColumns as column (column.fieldLabel)}
						<div class="excel-mapping-row">
							<span class="excel-mapping-field">{column.fieldLabel}</span>
							<select class="modal-input is-compact" value={column.columnLetter}>
								{#each ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as letter (letter)}
									<option value={letter}>Колонка {letter}</option>
								{/each}
								<option value="">— нет в файле —</option>
							</select>
							<span class="excel-mapping-hint">{column.hint}</span>
						</div>
					{/each}
				</div>

				<div class="settings-row">
					<div class="settings-row-text">
						<strong>Незнакомый проект</strong>
						<span>Что делать со строкой, если проекта ещё нет</span>
					</div>
					<select class="modal-input is-compact" bind:value={unknownProjectAction}>
						<option value="create">Создать</option>
						<option value="skip">Пропустить строку</option>
					</select>
				</div>
			{/if}

			<div class="modal-actions">
				<button class="pill-button" onclick={() => (isOpen = false)}>Закрыть</button>
				<button class="pill-button is-dark" disabled title="Появится после подключения базы">
					{mode === 'export' ? 'Выгрузить' : 'Импортировать'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal.is-excel {
		width: min(94vw, 34rem);
		max-height: min(86vh, 42rem);
		overflow-y: auto;
	}

	.excel-heading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.modal-hint {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.excel-dates {
		display: flex;
		gap: 0.375rem;
	}

	.excel-preview {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.75rem;
		border-radius: 0.625rem;
		background: var(--color-cell-tint);
	}

	.excel-preview-title {
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
	}

	/* Wide previews scroll inside the card instead of stretching the dialog. */
	.excel-table-scroll {
		overflow-x: auto;
	}

	.excel-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.excel-table th,
	.excel-table td {
		border-bottom: 1px solid var(--color-border);
		padding: 0.3125rem 0.5rem;
		text-align: left;
	}

	.excel-table th {
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.excel-table .is-number {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.excel-table .is-quiet {
		color: var(--color-text-muted);
	}

	.excel-drop {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 1.25rem 1rem;
		border: 1px dashed #cfcfcf;
		border-radius: 0.625rem;
		background: #fafafa;
		text-align: center;
		cursor: pointer;
	}

	.excel-drop:hover {
		border-color: #a8a8a8;
	}

	.excel-drop strong {
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.excel-drop span {
		font-size: 0.6875rem;
		color: var(--color-text-muted);
	}

	.excel-drop input {
		display: none;
	}

	.excel-mapping-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.excel-mapping-field {
		width: 5.5rem;
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.excel-mapping-hint {
		flex: 1;
		min-width: 0;
		font-size: 0.6875rem;
		color: var(--color-text-muted);
	}

	.pill-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
