<!--
	The Неделя / Месяц / Год dropdown. Nothing else.
	Needs: view mode and its own open state. Writes: view mode.
-->
<script lang="ts">
	import type { ViewMode } from '$lib/dates';

	let {
		viewMode = $bindable(),
		isOpen = $bindable(false),
		modes = ['week', 'month', 'year'] as ViewMode[]
	}: {
		viewMode: ViewMode;
		isOpen?: boolean;
		modes?: ViewMode[];
	} = $props();

	const modeLabels: Record<ViewMode, string> = {
		week: 'Неделя',
		month: 'Месяц',
		year: 'Год'
	};
</script>

<div class="dropdown">
	<button
		class="pill-button"
		onclick={(event) => {
			event.stopPropagation();
			isOpen = !isOpen;
		}}
	>
		{modeLabels[viewMode]} ▾
	</button>

	{#if isOpen}
		<div class="dropdown-panel is-list">
			{#each modes as mode (mode)}
				<button
					onclick={() => {
						viewMode = mode;
						isOpen = false;
					}}
				>
					{modeLabels[mode]}
				</button>
			{/each}
		</div>
	{/if}
</div>
