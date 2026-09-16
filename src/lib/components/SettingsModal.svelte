<!--
	Settings dialog: icon rail plus one pane per tab — account, appearance,
	workday norms, data (Excel), studio (name + logo), shortcuts.
	Needs: every setting as a bindable prop, plus the signed-in person.
	Writes: all of those settings, and the studio profile store.
-->
<script lang="ts">
	import type { ProjectWithTasks } from '$lib/fakeData';
	import { studioProfile, readLogoFile, removeLogo } from '$lib/studioProfile.svelte';

	export type SettingsTab =
		| 'account'
		| 'appearance'
		| 'workday'
		| 'data'
		| 'workspaces'
		| 'shortcuts';

	let {
		isSettingsOpen = $bindable(false),
		settingsTab = $bindable('appearance' as SettingsTab),
		projectsWithTasks = [] as ProjectWithTasks[],
		targetHoursPerDay = $bindable(8),
		minimumHoursPerDay = $bindable(6),
		workDaysPerWeek = $bindable(5),
		workDayStartHour = $bindable(9),
		workDayEndHour = $bindable(17),
		roundToQuarterHour = $bindable(true),
		showWeekends = $bindable(true),
		accentPreference = $bindable('system'),
		appearanceFont = $bindable('Inter'),
		appearanceBaseFontSize = $bindable(16),
		appearanceRowPadding = $bindable(8),
		interfaceLanguage = $bindable('ru'),
		interfaceLanguages = [] as { code: string; label: string }[],
		workspaces = [] as { workspaceId: string; workspaceName: string; workspaceColor: string }[],
		currentWorkspaceId = $bindable(''),
		userName = 'David Gordov',
		userRole = 'Дизайнер',
		userEmail = 'david@studio.com',
		avatarUrl = 'https://i.pravatar.cc/120?img=12',
		onOpenExcel = (_mode: 'import' | 'export') => {}
	}: {
		isSettingsOpen: boolean;
		settingsTab: SettingsTab;
		projectsWithTasks?: ProjectWithTasks[];
		targetHoursPerDay?: number;
		minimumHoursPerDay?: number;
		workDaysPerWeek?: number;
		workDayStartHour?: number;
		workDayEndHour?: number;
		roundToQuarterHour?: boolean;
		showWeekends?: boolean;
		accentPreference?: string;
		appearanceFont?: string;
		appearanceBaseFontSize?: number;
		appearanceRowPadding?: number;
		interfaceLanguage?: string;
		interfaceLanguages?: { code: string; label: string }[];
		workspaces?: { workspaceId: string; workspaceName: string; workspaceColor: string }[];
		currentWorkspaceId?: string;
		userName?: string;
		userRole?: string;
		userEmail?: string;
		avatarUrl?: string;
		onOpenExcel?: (mode: 'import' | 'export') => void;
	} = $props();

	const settingsTabs: { tabId: SettingsTab; label: string; icon: string }[] = [
		{ tabId: 'account', label: 'Аккаунт', icon: '👤' },
		{ tabId: 'appearance', label: 'Внешний вид', icon: '🎨' },
		{ tabId: 'workday', label: 'Рабочий день', icon: '🕘' },
		{ tabId: 'data', label: 'Данные', icon: '📦' },
		{ tabId: 'workspaces', label: 'Пространства', icon: '🏢' },
		{ tabId: 'shortcuts', label: 'Горячие клавиши', icon: '⌨️' }
	];

	const googleFontOptions = ['Inter', 'Manrope', 'IBM Plex Sans', 'Roboto', 'Space Grotesk'];

	const keyboardShortcuts = [
		{ keys: '⌘K', description: 'Новая задача', isReady: true },
		{ keys: '⌘↩', description: 'Закончить редактирование задачи', isReady: true },
		{ keys: 'Esc', description: 'Закрыть окно или отменить ввод', isReady: true },
		{ keys: '↑ ↓ ← →', description: 'Переход между ячейками часов', isReady: false },
		{ keys: 'Enter', description: 'Сохранить и перейти на строку ниже', isReady: false }
	];

	// --- Studio logo, the one the client sees on a report ---
	let logoErrorText = $state('');

	async function pickLogo(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		logoErrorText = (await readLogoFile(file)).errorText;
		// Let the same file be picked again after an error.
		input.value = '';
	}

	// Everything is sized in rem, so this one value scales the whole layout.
	// The default is left alone entirely, so the responsive clamp() in the layout
	// keeps working until someone actually moves the slider.
	const defaultBaseFontSize = 16;

	$effect(() => {
		const root = document.documentElement;
		if (appearanceBaseFontSize === defaultBaseFontSize) {
			root.style.removeProperty('font-size');
			return;
		}
		root.style.fontSize = `${appearanceBaseFontSize}px`;
	});
</script>

{#if isSettingsOpen}
	<div class="modal-backdrop" onclick={() => (isSettingsOpen = false)} role="presentation">
		<div class="modal is-settings" onclick={(event) => event.stopPropagation()} role="presentation">
			<nav class="settings-rail">
				<div class="settings-rail-title">Настройки</div>
				{#each settingsTabs as tab (tab.tabId)}
					<button
						class="settings-rail-item"
						class:is-active={settingsTab === tab.tabId}
						onclick={() => (settingsTab = tab.tabId)}
					>
						<span class="settings-rail-icon">{tab.icon}</span>
						{tab.label}
					</button>
				{/each}
			</nav>

			<div class="settings-pane">
				{#if settingsTab === 'account'}
					<h2>Аккаунт</h2>

					<div class="settings-identity">
						<img class="avatar is-large" src={avatarUrl} alt="" />
						<div>
							<div class="settings-identity-name">{userName}</div>
							<button class="pill-button" disabled>
								Сменить фото <span class="soon-tag">позже</span>
							</button>
						</div>
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Имя <span class="soon-tag">позже</span></strong>
							<span>Видно всем в пространстве · правка после подключения базы</span>
						</div>
						<input class="modal-input is-compact" value={userName} readonly />
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Роль <span class="soon-tag">позже</span></strong>
							<span>Подпись под именем · правка после подключения базы</span>
						</div>
						<input class="modal-input is-compact" value={userRole} readonly />
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Почта <span class="soon-tag">позже</span></strong>
							<span>Для входа и уведомлений · меняется через подтверждение</span>
						</div>
						<input class="modal-input is-compact" value={userEmail} readonly />
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Язык интерфейса <span class="soon-tag">позже</span></strong>
							<span>Интерфейс пока только на русском</span>
						</div>
						<select class="modal-input is-compact" bind:value={interfaceLanguage}>
							{#each interfaceLanguages as language}
								<option value={language.code}>{language.label}</option>
							{/each}
						</select>
					</div>
				{:else if settingsTab === 'appearance'}
					<h2>Оформление</h2>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Шрифт</strong>
							<span>Загружается из Google Fonts</span>
						</div>
						<select class="modal-input is-compact" bind:value={appearanceFont}>
							{#each googleFontOptions as fontOption}
								<option value={fontOption}>{fontOption}</option>
							{/each}
						</select>
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Размер текста</strong>
							<span>Масштабирует весь интерфейс — {appearanceBaseFontSize}px</span>
						</div>
						<input type="range" min="13" max="20" bind:value={appearanceBaseFontSize} />
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Плотность строк</strong>
							<span>Отступы в таблице — {appearanceRowPadding}px</span>
						</div>
						<input type="range" min="4" max="16" bind:value={appearanceRowPadding} />
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Тема <span class="soon-tag">позже</span></strong>
							<span>Пока только светлая</span>
						</div>
						<select class="modal-input is-compact" bind:value={accentPreference}>
							<option value="system">Системная</option>
							<option value="dark">Тёмная</option>
						</select>
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Показывать выходные</strong>
							<span>Сб и Вс в таблице и календаре</span>
						</div>
						<input type="checkbox" class="settings-switch" bind:checked={showWeekends} />
					</div>
				{:else if settingsTab === 'workday'}
					<h2>Рабочий день</h2>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Рабочие часы <span class="soon-tag">позже</span></strong>
							<span>{workDayStartHour}:00 – {workDayEndHour}:00 · пригодятся для напоминаний</span>
						</div>
						<div class="settings-range-pair">
							<input type="range" min="0" max="23" bind:value={workDayStartHour} />
							<input type="range" min="1" max="24" bind:value={workDayEndHour} />
						</div>
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Норма в день</strong>
							<span>Полоса в итогах заполняется до этого числа</span>
						</div>
						<input class="modal-input is-tiny" type="number" min="1" max="24" bind:value={targetHoursPerDay} />
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Минимум в день</strong>
							<span>Ниже — полоса станет красной</span>
						</div>
						<input class="modal-input is-tiny" type="number" min="0" max="24" bind:value={minimumHoursPerDay} />
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Рабочих дней в неделе <span class="soon-tag">позже</span></strong>
							<span>Норма считается по будням — пн–пт</span>
						</div>
						<input class="modal-input is-tiny" type="number" min="1" max="7" bind:value={workDaysPerWeek} />
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Округлять до 15 минут</strong>
							<span>При выходе из ячейки</span>
						</div>
						<input type="checkbox" class="settings-switch" bind:checked={roundToQuarterHour} />
					</div>
				{:else if settingsTab === 'data'}
					<h2>Данные</h2>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Импорт из Excel</strong>
							<span>Перенести старую таблицу часов</span>
						</div>
						<button class="pill-button" onclick={() => onOpenExcel('import')}>
							Настроить <span class="soon-tag">макет</span>
						</button>
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Экспорт в Excel</strong>
							<span>Текущий период целиком</span>
						</div>
						<button class="pill-button" onclick={() => onOpenExcel('export')}>
							Настроить <span class="soon-tag">макет</span>
						</button>
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Удалить все часы <span class="soon-tag">позже</span></strong>
							<span>Задачи и проекты останутся · спросим подтверждение дважды</span>
						</div>
						<button class="pill-button is-danger" disabled>Удалить</button>
					</div>
				{:else if settingsTab === 'workspaces'}
					<h2>Студия</h2>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Название студии</strong>
							<span>Стоит в шапке отчёта для клиента</span>
						</div>
						<input class="modal-input is-compact" bind:value={studioProfile.studioName} />
					</div>

					<div class="settings-row is-stacked">
						<div class="settings-row-text">
							<strong>Логотип</strong>
							<span>PNG или SVG до 400 КБ · подставится в отчёты клиентам</span>
						</div>

						<div class="logo-row">
							<div class="logo-preview" class:is-empty={!studioProfile.logoDataUrl}>
								{#if studioProfile.logoDataUrl}
									<img src={studioProfile.logoDataUrl} alt="Логотип студии" />
								{:else}
									<span>нет логотипа</span>
								{/if}
							</div>

							<div class="logo-actions">
								<label class="pill-button is-file">
									{studioProfile.logoDataUrl ? 'Заменить' : 'Загрузить'}
									<input type="file" accept="image/png,image/svg+xml,image/jpeg" onchange={pickLogo} />
								</label>
								{#if studioProfile.logoDataUrl}
									<button class="pill-button is-danger" onclick={removeLogo}>Убрать</button>
								{/if}
								{#if studioProfile.logoFileName}
									<span class="logo-file-name">{studioProfile.logoFileName}</span>
								{/if}
							</div>
						</div>

						{#if logoErrorText}
							<p class="logo-error">{logoErrorText}</p>
						{/if}
					</div>

					<h2 class="settings-subheading">Пространства</h2>

					{#each workspaces as workspace (workspace.workspaceId)}
						<div class="settings-row">
							<div class="settings-row-text">
								<strong>
									<span class="project-dot" style="background: {workspace.workspaceColor}"></span>
									{workspace.workspaceName}
								</strong>
								<span>{projectsWithTasks.length} проектов</span>
							</div>
							{#if currentWorkspaceId === workspace.workspaceId}
								<span class="settings-badge">Текущее</span>
							{:else}
								<button
									class="pill-button"
									onclick={() => (currentWorkspaceId = workspace.workspaceId)}
								>
									Перейти
								</button>
							{/if}
						</div>
					{/each}

					<button class="pill-button is-dark" disabled>
						+ Новое пространство <span class="soon-tag">позже</span>
					</button>
				{:else}
					<h2>Горячие клавиши</h2>

					{#each keyboardShortcuts as shortcut}
						<div class="settings-row">
							<div class="settings-row-text">
								<strong>
									{shortcut.description}
									{#if !shortcut.isReady}<span class="soon-tag">позже</span>{/if}
								</strong>
							</div>
							<kbd class="settings-key">{shortcut.keys}</kbd>
						</div>
					{/each}
				{/if}
			</div>

			<div class="settings-footer">
				<button class="pill-button is-dark" onclick={() => (isSettingsOpen = false)}>Готово</button>
			</div>
		</div>
	</div>
{/if}

<style>	/* Box clock: analog, but the face is the box — elapsed half-day is filled. */
	/* Settings dialog: icon rail on the left, rows on the right. */
	.modal.is-settings {
		width: min(94vw, 44rem);
		padding: 0;
		display: grid;
		grid-template-columns: 11rem 1fr;
		grid-template-rows: 1fr auto;
		max-height: min(80vh, 34rem);
		overflow: hidden;
	}
	.settings-rail {
		grid-row: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 1rem 0.625rem;
		background: #fafafa;
		border-right: 1px solid var(--color-border);
	}
	.settings-rail-title {
		padding: 0 0.625rem 0.75rem;
		font-size: 0.9375rem;
		font-weight: 600;
	}
	.settings-rail-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border: 0;
		background: none;
		padding: 0.5rem 0.625rem;
		border-radius: 0.5rem;
		font: inherit;
		font-size: 0.8125rem;
		text-align: left;
		cursor: pointer;
		transition: background 0.14s cubic-bezier(0.33, 1, 0.68, 1);
	}
	.settings-rail-item:hover {
		background: #f0f0f0;
	}
	.settings-rail-item.is-active {
		background: var(--color-shell);
		color: var(--color-panel);
	}
	.settings-rail-icon {
		width: 1rem;
		text-align: center;
		font-size: 0.75rem;
	}
	.settings-pane {
		padding: 1.25rem;
		overflow-y: auto;
	}
	.settings-pane h2 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
	}
	.settings-identity {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding-bottom: 0.75rem;
	}
	.settings-identity-name {
		font-size: 0.875rem;
		font-weight: 500;
		margin-bottom: 0.375rem;
	}
	.avatar.is-large {
		width: 3rem;
		height: 3rem;
	}
	.settings-badge {
		flex: none;
		padding: 0.25rem 0.5rem;
		border-radius: 0.4375rem;
		background: #f0f0f0;
		font-size: 0.6875rem;
		color: var(--color-text-muted);
	}
	.settings-key {
		flex: none;
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--color-border);
		border-bottom-width: 2px;
		border-radius: 0.375rem;
		background: #fafafa;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.6875rem;
	}
	.pill-button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.settings-subheading {
		margin-top: 1rem;
	}
	.logo-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	/* Checkerboard so a transparent logo is readable. */
	.logo-preview {
		display: grid;
		place-items: center;
		width: 7rem;
		height: 3.5rem;
		flex: none;
		padding: 0.375rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		background-color: #ffffff;
		background-image:
			linear-gradient(45deg, #f3f3f3 25%, transparent 25% 75%, #f3f3f3 75%),
			linear-gradient(45deg, #f3f3f3 25%, transparent 25% 75%, #f3f3f3 75%);
		background-size: 0.75rem 0.75rem;
		background-position: 0 0, 0.375rem 0.375rem;
	}
	.logo-preview img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	.logo-preview.is-empty {
		background-image: none;
		background: #fafafa;
		color: var(--color-text-muted);
		font-size: 0.6875rem;
	}
	.logo-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.375rem;
	}
	.pill-button.is-file {
		cursor: pointer;
	}
	.pill-button.is-file input {
		display: none;
	}
	.logo-file-name {
		font-size: 0.6875rem;
		color: var(--color-text-muted);
	}
	.logo-error {
		margin: 0;
		font-size: 0.6875rem;
		color: var(--color-weekend);
	}
	.settings-footer {
		display: flex;
		justify-content: flex-end;
		padding: 0.75rem 1.25rem;
		border-top: 1px solid var(--color-border);
	}
	.settings-range-pair {
		display: flex;
		gap: 0.5rem;
	}
	.settings-range-pair input {
		flex: 1;
		min-width: 0;
	}
</style>
