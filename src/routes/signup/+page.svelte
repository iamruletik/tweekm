<script lang="ts">
	import AuthShell from '$lib/components/AuthShell.svelte';

	// Signing up creates a studio, not an employee — staff arrive by invite only.
	// UI only: nothing is saved.

	let studioName = $state('');
	let ownerName = $state('');
	let email = $state('');
	let password = $state('');
	let passwordAgain = $state('');
	let isSubmitted = $state(false);

	const passwordsMatch = $derived(password.length > 0 && password === passwordAgain);

	const canSubmit = $derived(
		studioName.trim().length > 0 &&
			ownerName.trim().length > 0 &&
			email.trim().length > 0 &&
			passwordsMatch
	);

	function createStudio(event: SubmitEvent) {
		event.preventDefault();
		isSubmitted = true;
	}
</script>

<svelte:head>
	<title>Регистрация студии — Tweekm</title>
</svelte:head>

<AuthShell
	pageTitle={isSubmitted ? 'Студия создана' : 'Новая студия'}
	pageHintText={isSubmitted
		? ''
		: 'Регистрируется руководитель. Сотрудников потом добавляете приглашением — сами они зарегистрироваться не могут.'}
>
	{#if isSubmitted}
		<p class="auth-note">
			<strong>{studioName}</strong> — дальше вы бы попали в «Команду», чтобы позвать людей по
			почте. Пока это макет: ничего не сохранилось.
		</p>
		<a class="auth-submit-button is-link" href="/boss">Открыть студию</a>
	{:else}
		<form onsubmit={createStudio}>
			<div class="auth-field">
				<label for="signup-studio">Название студии</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="signup-studio"
					class="modal-input"
					placeholder="Radiance"
					bind:value={studioName}
					autofocus
				/>
			</div>

			<div class="auth-field">
				<label for="signup-owner">Ваше имя</label>
				<input id="signup-owner" class="modal-input" placeholder="Имя и фамилия" bind:value={ownerName} />
			</div>

			<div class="auth-field">
				<label for="signup-email">Рабочая почта</label>
				<input
					id="signup-email"
					class="modal-input"
					type="email"
					autocomplete="email"
					placeholder="you@studio.com"
					bind:value={email}
				/>
			</div>

			<div class="auth-field">
				<label for="signup-password">Пароль</label>
				<input
					id="signup-password"
					class="modal-input"
					type="password"
					autocomplete="new-password"
					placeholder="от 8 символов"
					bind:value={password}
				/>
			</div>

			<div class="auth-field">
				<label for="signup-password-again">Пароль ещё раз</label>
				<input
					id="signup-password-again"
					class="modal-input"
					type="password"
					autocomplete="new-password"
					bind:value={passwordAgain}
				/>
			</div>

			{#if passwordAgain.length > 0 && !passwordsMatch}
				<p class="auth-error">Пароли не совпадают.</p>
			{/if}

			<button class="auth-submit-button" type="submit" disabled={!canSubmit}>
				Создать студию
			</button>
		</form>
	{/if}

	<div class="auth-links">
		<a href="/login">Уже есть аккаунт — войти</a>
	</div>

	{#snippet footer()}
		Сотрудник не регистрируется сам — <a href="/login">ждите приглашение на почту</a>.
	{/snippet}
</AuthShell>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.auth-submit-button.is-link {
		display: block;
		text-align: center;
		text-decoration: none;
	}
</style>
