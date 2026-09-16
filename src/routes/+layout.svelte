<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<style>
	:global(:root) {
		--color-shell: #0e0e0e;
		--color-panel: #ffffff;
		--color-cell-tint: #f4f4f4;
		--color-hover-tint: #fbfbfb;
		--color-cell-hover-tint: #f2f2f2;
		--color-border: #ededed;
		--color-text: #10161f;
		--color-text-on-shell: #d4d4d4;
		--color-text-muted: #6b6b6b;
		--color-weekend: #e46f86;
		--color-day-full: rgb(64 150 96 / 0.22);
		--color-day-full-text: #79b894;
		--color-day-partial: rgb(190 160 70 / 0.2);
		--color-day-partial-text: #c2ac6a;
		--color-overtime: #8a38f5;
		--color-vacation: rgb(70 100 190 / 0.28);
		--color-vacation-strong: #3c65e7;
	}

	/* Padding counts inside declared widths — without this, width:100% + padding
	   overflows its container (that is what pushed the user card past the edge). */
	:global(*),
	:global(*::before),
	:global(*::after) {
		box-sizing: border-box;
	}

	/* Root size is fluid, and the appearance slider overrides it. */
	:global(html) {
		font-size: clamp(14px, 0.25vw + 13px, 18px);
	}

	:global(body) {
		margin: 0;
		font-size: 1rem;
		background: var(--color-shell);
		font-family: ui-sans-serif, system-ui, sans-serif;
		color: var(--color-text);
	}

</style>
