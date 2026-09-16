<script lang="ts">
	import AuthShell from '$lib/components/AuthShell.svelte';
	import { employees } from '$lib/studioData';

	// UI only — no auth yet. Signing in picks a fake person and goes to their week.

	let email = $state('');
	let password = $state('');
	let errorText = $state('');

	const canSubmit = $derived(email.trim().length > 0 && password.length > 0);

	// The boss lands on the studio; everyone else on their own week.
	function signIn(event: SubmitEvent) {
		event.preventDefault();
		const person = employees.find(
			(employee) => employee.employeeEmail.toLowerCase() === email.trim().toLowerCase()
		);
		if (!person) {
			errorText = 'Не нашли такую почту. Пока сюда подходят адреса из фейковых данных.';
			return;
		}
		window.location.href = person.isBoss ? '/boss' : '/';
	}
</script>

<svelte:head>
	<title>Вход — Tweekm</title>
</svelte:head>

<AuthShell pageTitle="Вход" pageHintText="Учёт часов студии. Аккаунты создаёт руководитель.">
	<form onsubmit={signIn}>
		<div class="auth-field">
			<label for="login-email">Рабочая почта</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="login-email"
				class="modal-input"
				type="email"
				autocomplete="email"
				placeholder="david@studio.com"
				bind:value={email}
				autofocus
			/>
		</div>

		<div class="auth-field">
			<label for="login-password">Пароль</label>
			<input
				id="login-password"
				class="modal-input"
				type="password"
				autocomplete="current-password"
				placeholder="••••••••"
				bind:value={password}
			/>
		</div>

		{#if errorText}
			<p class="auth-error">{errorText}</p>
		{/if}

		<button class="auth-submit-button" type="submit" disabled={!canSubmit}>Войти</button>
	</form>

	<div class="auth-links">
		<a href="/reset-password">Забыли пароль?</a>
		<a href="/signup">Зарегистрировать студию</a>
	</div>

	<p class="auth-note">
		Макет: пароль не проверяется. Подойдёт любая почта из фейковых сотрудников —
		например <strong>david@studio.com</strong> (руководитель) или
		<strong>dasha@studio.com</strong>.
	</p>
</AuthShell>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
</style>
