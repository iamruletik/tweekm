<script lang="ts">
	// Placeholder landing page: what the thing is, in a few lines, and the way in.

	const capabilities = [
		{
			title: 'Неделя одним экраном',
			text: 'Строки — задачи по проектам, колонки — дни. Часы вбиваются с клавиатуры, без таймеров и запусков.'
		},
		{
			title: 'Студия целиком',
			text: 'Руководитель видит всех сразу: загрузку по дням, отпуска, кто чем занят, кто не заполнил.'
		},
		{
			title: 'Отчёт клиенту',
			text: 'Ссылка на часы за период — с описаниями, ставкой и суммой. Правится перед отправкой.'
		}
	];
</script>

<svelte:head>
	<title>Tweekm — учёт часов для студии</title>
	<meta
		name="description"
		content="Tweekm — недельный учёт часов для дизайн-студии: таблица вместо таймеров, загрузка команды и отчёты клиентам."
	/>
</svelte:head>

<main class="landing">
	<header class="landing-header">
		<span class="landing-brand">
			<span class="landing-brand-mark">t</span>
			Tweekm
		</span>
		<nav class="landing-nav">
			<a href="/login">Войти</a>
			<a class="landing-nav-primary" href="/signup">Зарегистрировать студию</a>
		</nav>
	</header>

	<section class="landing-hero">
		<h1>Часы студии — таблицей, а не таймером</h1>
		<p class="landing-lead">
			Недельный учёт времени для дизайн-студии: каждый ставит часы по своим задачам,
			руководитель видит загрузку всей команды и собирает отчёт клиенту одной ссылкой.
		</p>
		<div class="landing-actions">
			<a class="landing-button is-primary" href="/login">Войти</a>
			<a class="landing-button" href="/">Посмотреть демо</a>
		</div>
		<p class="landing-small">Аккаунты создаёт руководитель студии — сотрудники приходят по приглашению.</p>
	</section>

	<section class="landing-cards">
		{#each capabilities as capability (capability.title)}
			<article class="landing-card">
				<h2>{capability.title}</h2>
				<p>{capability.text}</p>
			</article>
		{/each}
	</section>

	<footer class="landing-footer">
		<span>Tweekm · внутренний инструмент студии Radiance</span>
		<a href="/login">Вход</a>
	</footer>
</main>

<style>
	.landing {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
		padding: 1.25rem clamp(1rem, 5vw, 4rem) 1.5rem;
		background: var(--color-shell);
		color: var(--color-text-on-shell);
	}

	.landing-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.landing-brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #ffffff;
		font-size: 0.9375rem;
		font-weight: 500;
	}

	.landing-brand-mark {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 0.4375rem;
		background: #28d059;
		color: #0e0e0e;
		font-weight: 600;
	}

	.landing-nav {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
	}

	.landing-nav a {
		padding: 0.4375rem 0.75rem;
		border-radius: 0.5rem;
		color: var(--color-text-on-shell);
		text-decoration: none;
	}

	.landing-nav a:hover {
		background: #1c1c1c;
	}

	.landing-nav-primary {
		background: var(--color-panel);
		color: var(--color-text) !important;
	}

	.landing-nav-primary:hover {
		opacity: 0.88;
	}

	.landing-hero {
		max-width: 34rem;
		margin: auto 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.landing-hero h1 {
		margin: 0;
		font-size: clamp(1.75rem, 4.5vw, 2.75rem);
		line-height: 1.1;
		font-weight: 600;
		color: #ffffff;
	}

	.landing-lead {
		margin: 0;
		font-size: 1rem;
		line-height: 1.5;
	}

	.landing-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.landing-button {
		padding: 0.625rem 1.125rem;
		border: 1px solid #303030;
		border-radius: 0.625rem;
		color: var(--color-text-on-shell);
		font-size: 0.8125rem;
		text-decoration: none;
		transition: background 0.14s cubic-bezier(0.33, 1, 0.68, 1);
	}

	.landing-button:hover {
		background: #1c1c1c;
	}

	.landing-button.is-primary {
		background: var(--color-panel);
		border-color: transparent;
		color: var(--color-text);
	}

	.landing-button.is-primary:hover {
		opacity: 0.88;
	}

	.landing-small {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.landing-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 0.75rem;
		margin-bottom: auto;
	}

	.landing-card {
		padding: 1.125rem;
		border-radius: 0.875rem;
		background: #171717;
	}

	.landing-card h2 {
		margin: 0 0 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #ffffff;
	}

	.landing-card p {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--color-text-muted);
	}

	.landing-footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding-top: 1rem;
		border-top: 1px solid #222222;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.landing-footer a {
		color: var(--color-text-on-shell);
	}
</style>
