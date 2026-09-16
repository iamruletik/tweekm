<!--
	Frame shared by /login, /signup and /reset-password: brand, one card, footer.
	Needs: a title, an optional hint line, the form as children.
	Writes: nothing.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		pageTitle,
		pageHintText = '',
		children,
		footer = undefined as Snippet | undefined
	}: {
		pageTitle: string;
		pageHintText?: string;
		children: Snippet;
		footer?: Snippet;
	} = $props();
</script>

<main class="auth-shell">
	<a class="auth-brand" href="/landing">
		<span class="auth-brand-mark">t</span>
		Tweekm
	</a>

	<section class="auth-card">
		<h1>{pageTitle}</h1>
		{#if pageHintText}
			<p class="auth-hint">{pageHintText}</p>
		{/if}

		{@render children()}
	</section>

	{#if footer}
		<div class="auth-footer">{@render footer()}</div>
	{/if}
</main>

<style>
	.auth-shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 2rem 1rem;
		background: var(--color-shell);
	}

	.auth-brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #ffffff;
		font-size: 0.9375rem;
		font-weight: 500;
		text-decoration: none;
	}

	.auth-brand-mark {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 0.4375rem;
		background: #28d059;
		color: #0e0e0e;
		font-weight: 600;
	}

	.auth-card {
		width: min(100%, 23rem);
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 1.5rem;
		border-radius: 0.875rem;
		background: var(--color-panel);
	}

	.auth-card h1 {
		margin: 0;
		font-size: 1.0625rem;
		font-weight: 600;
	}

	.auth-hint {
		margin: 0 0 0.25rem;
		font-size: 0.8125rem;
		line-height: 1.4;
		color: var(--color-text-muted);
	}

	.auth-footer {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.auth-footer :global(a) {
		color: #ffffff;
	}
</style>
