<script lang="ts">
	import { page } from '$app/state';
	import AuthShell from '$lib/components/AuthShell.svelte';

	// Two screens in one route, the way a real reset link works:
	// no token → ask for the email; with ?token=… → set the new password.
	// UI only: nothing is sent or saved.

	const hasResetToken = $derived(Boolean(page.url.searchParams.get('token')));

	let email = $state('');
	let isLinkSent = $state(false);

	let password = $state('');
	let passwordAgain = $state('');
	let isPasswordSaved = $state(false);

	const passwordsMatch = $derived(password.length > 0 && password === passwordAgain);

	function sendResetLink(event: SubmitEvent) {
		event.preventDefault();
		if (!email.trim()) return;
		isLinkSent = true;
	}

	function savePassword(event: SubmitEvent) {
		event.preventDefault();
		if (!passwordsMatch) return;
		isPasswordSaved = true;
	}
</script>

<svelte:head>
	<title>Восстановление пароля — Tweekm</title>
</svelte:head>

{#if hasResetToken}
	<AuthShell
		pageTitle={isPasswordSaved ? 'Пароль изменён' : 'Новый пароль'}
		pageHintText={isPasswordSaved ? '' : 'Ссылка действует сутки и открывается один раз.'}
	>
		{#if isPasswordSaved}
			<p class="auth-note">Дальше можно войти с новым паролем.</p>
			<a class="auth-submit-button is-link" href="/login">Войти</a>
		{:else}
			<form onsubmit={savePassword}>
				<div class="auth-field">
					<label for="reset-password">Новый пароль</label>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="reset-password"
						class="modal-input"
						type="password"
						autocomplete="new-password"
						placeholder="от 8 символов"
						bind:value={password}
						autofocus
					/>
				</div>

				<div class="auth-field">
					<label for="reset-password-again">Пароль ещё раз</label>
					<input
						id="reset-password-again"
						class="modal-input"
						type="password"
						autocomplete="new-password"
						bind:value={passwordAgain}
					/>
				</div>

				{#if passwordAgain.length > 0 && !passwordsMatch}
					<p class="auth-error">Пароли не совпадают.</p>
				{/if}

				<button class="auth-submit-button" type="submit" disabled={!passwordsMatch}>
					Сохранить пароль
				</button>
			</form>
		{/if}
	</AuthShell>
{:else}
	<AuthShell
		pageTitle={isLinkSent ? 'Проверьте почту' : 'Восстановление пароля'}
		pageHintText={isLinkSent ? '' : 'Пришлём ссылку на смену пароля.'}
	>
		{#if isLinkSent}
			<p class="auth-note">
				Отправили ссылку на <strong>{email}</strong>. Если письма нет — руководитель может
				сбросить пароль из карточки сотрудника.
			</p>
			<a class="auth-submit-button is-link" href="/reset-password?token=demo">
				Открыть ссылку (макет)
			</a>
		{:else}
			<form onsubmit={sendResetLink}>
				<div class="auth-field">
					<label for="reset-email">Рабочая почта</label>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="reset-email"
						class="modal-input"
						type="email"
						autocomplete="email"
						placeholder="david@studio.com"
						bind:value={email}
						autofocus
					/>
				</div>

				<button class="auth-submit-button" type="submit" disabled={!email.trim()}>
					Прислать ссылку
				</button>
			</form>
		{/if}

		<div class="auth-links">
			<a href="/login">Вернуться к входу</a>
		</div>
	</AuthShell>
{/if}

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
