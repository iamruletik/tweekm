<!--
	Right half of the toolbar, shared by both screens: fit columns, view mode,
	the Экспорт menu (Excel + public link) and task search. Screens add their own
	controls through the `leading` snippet.
	Needs: view mode, the rows to search, and the callbacks it triggers.
	Writes: view mode and the search query.
-->
<script lang="ts">
	import type { ProjectWithTasks } from '$lib/fakeData';
	import type { ViewMode } from '$lib/dates';
	import type { Snippet } from 'svelte';
	import ViewModeMenu from '$lib/components/ViewModeMenu.svelte';

	let {
		viewMode = $bindable(),
		searchQuery = $bindable(''),
		projectsWithTasks = [] as ProjectWithTasks[],
		onFitColumns = () => {},
		onOpenShare = () => {},
		onOpenExcel = (_mode: 'import' | 'export') => {},
		leading = undefined as Snippet | undefined
	}: {
		viewMode: ViewMode;
		searchQuery?: string;
		projectsWithTasks?: ProjectWithTasks[];
		onFitColumns?: () => void;
		onOpenShare?: () => void;
		onOpenExcel?: (mode: 'import' | 'export') => void;
		// Screen-specific controls sit before the shared ones.
		leading?: Snippet;
	} = $props();

	let isViewMenuOpen = $state(false);
	let isTableMenuOpen = $state(false);
	let isSearchOpen = $state(false);

	const searchResults = $derived.by(() =>
		projectsWithTasks
			.flatMap((project) =>
				project.tasks.map((task) => ({
					task,
					projectName: project.projectName,
					projectColor: project.projectColor
				}))
			)
			.filter((result) =>
				result.task.taskTitle.toLowerCase().includes(searchQuery.trim().toLowerCase())
			)
			.slice(0, 8)
	);

	export function closeMenus() {
		isViewMenuOpen = false;
		isTableMenuOpen = false;
	}
</script>

<div class="toolbar-group toolbar-group-right">
	{#if leading}{@render leading()}{/if}

		<button
			class="icon-button-light"
			title="Вместить колонки"
			onclick={onFitColumns}
		>
			<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
				<path d="M6 3 3 8l3 5M10 3l3 5-3 5M3 8h10" fill="none" stroke="currentColor"
					stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>

		<ViewModeMenu bind:viewMode bind:isOpen={isViewMenuOpen} />

		<div class="table-menu dropdown">
			<button
				class="pill-button"
				onclick={(event) => {
					event.stopPropagation();
					isTableMenuOpen = !isTableMenuOpen;
				}}
			>
				Экспорт ▾
			</button>
			{#if isTableMenuOpen}
				<div class="dropdown-panel is-list">
					<button
						onclick={() => {
							isTableMenuOpen = false;
							onOpenExcel('import');
						}}
					>
						Импорт из Excel <span class="soon-tag">макет</span>
					</button>
					<button
						onclick={() => {
							isTableMenuOpen = false;
							onOpenExcel('export');
						}}
					>
						Экспорт в Excel <span class="soon-tag">макет</span>
					</button>
					<button
						onclick={() => {
							isTableMenuOpen = false;
							onOpenShare();
						}}>Публичная ссылка</button
					>
				</div>
			{/if}
		</div>

		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="dropdown" onclick={(event) => event.stopPropagation()}>
			<label class="search-box">
				<svg class="search-icon" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
					<circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6" />
					<path d="m10.4 10.4 3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
				</svg>
				<input
					placeholder="Поиск задач"
					bind:value={searchQuery}
					onfocus={() => (isSearchOpen = true)}
					onblur={() => setTimeout(() => (isSearchOpen = false), 120)}
				/>
			</label>

			{#if isSearchOpen}
				<div class="dropdown-panel search-results">
					{#each searchResults as result (result.task.taskId)}
						<div class="search-result">
							<span class="project-dot" style="background: {result.projectColor}"></span>
							<span class="search-result-title">{result.task.taskTitle}</span>
							<span class="search-result-project">{result.projectName}</span>
						</div>
					{:else}
						<div class="search-empty">Ничего не найдено</div>
					{/each}
					{#if searchResults.length > 0}
						<div class="search-note">Переход к строке по клику — позже</div>
					{/if}
				</div>
			{/if}
		</div>
</div>

<style>
	.search-results {
		padding: 0.25rem;
		min-width: 16.25rem;
		display: flex;
		flex-direction: column;
	}
	.search-result {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		border-radius: 0.5rem;
		font-size: 0.8125rem;
	}
	.search-note {
		padding: 0.375rem 0.625rem 0.25rem;
		border-top: 1px solid var(--color-border);
		color: var(--color-text-muted);
		font-size: 0.6875rem;
	}
	.search-result-title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.search-result-project {
		color: var(--color-text-muted);
		font-size: 0.6875rem;
	}
	.search-empty {
		padding: 0.625rem;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
	.toolbar-group-right {
		margin-left: auto;
	}

	.search-box {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		height: 1.875rem;
		padding: 0 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		transition: border-color 0.12s ease;
	}
	.search-box:focus-within {
		border-color: #c4c4c4;
	}
	.search-icon {
		color: var(--color-text-muted);
		flex: none;
	}
	.search-box input {
		border: 0;
		outline: 0;
		font: inherit;
		font-size: 0.8125rem;
		width: 8.125rem;
		background: none;
	}
	.table-menu {
		position: relative;
	}
	.table-menu .pill-button {
		border: 1px solid var(--color-border);
	}
</style>
