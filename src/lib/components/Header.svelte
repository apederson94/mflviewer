<script lang="ts">
	import LoginForm from './LoginForm.svelte';

	let {
		week,
		isLoggedIn,
		theme,
		formLoading,
		onToggleTheme,
		onLogin,
		onLogout
	}: {
		week: number;
		isLoggedIn: boolean;
		theme: 'light' | 'dark';
		formLoading: boolean;
		onToggleTheme: () => void;
		onLogin: (username: string, password: string) => void;
		onLogout: () => void;
	} = $props();
</script>

<header class="header">
	<div class="title-row">
		<h1>MFL Transaction Viewer <span class="week">Week {week}</span></h1>
	</div>
	<div class="header-mobile-controls">
		<button
			class="theme-toggle"
			onclick={onToggleTheme}
			aria-label="Toggle dark mode"
		>
			{theme === 'dark' ? 'Light' : 'Dark'}
		</button>
		<div class="auth-row-mobile">
			{#if isLoggedIn}
				<button onclick={onLogout} class="login-btn">Logout</button>
			{:else}
				<LoginForm loading={formLoading} onSubmit={onLogin} />
			{/if}
		</div>
	</div>
	<div class="auth-row">
		<button
			class="theme-toggle"
			onclick={onToggleTheme}
			aria-label="Toggle dark mode"
		>
			{theme === 'dark' ? 'Light' : 'Dark'}
		</button>
		{#if isLoggedIn}
			<button onclick={onLogout} class="login-btn">Logout</button>
		{:else}
			<LoginForm loading={formLoading} onSubmit={onLogin} />
		{/if}
	</div>
</header>

<style>
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 1rem 2rem;
		background: var(--bg-secondary);
		border-bottom: 3px solid var(--border);
		flex-shrink: 0;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		min-width: 0;
	}

	.title-row h1 {
		margin: 0;
		font-size: 1.35rem;
		color: var(--text-primary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		vertical-align: middle;
	}

	.title-row .week {
		margin-left: 0.5rem;
		font-size: 0.75rem;
		color: var(--on-highlight);
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		vertical-align: middle;
		background: var(--highlight);
		border: 2px solid var(--border);
		padding: 0.15rem 0.5rem;
		box-shadow: var(--shadow-sm);
	}

	.auth-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.theme-toggle {
		padding: 0.5rem 0.9rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 2px solid var(--border);
		border-radius: 0;
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		box-shadow: var(--shadow-sm);
		transition: all 0.1s ease;
		white-space: nowrap;
	}

	.theme-toggle:hover {
		transform: translate(-1px, -1px);
		box-shadow: var(--card-shadow);
	}

	.theme-toggle:active {
		transform: translate(1px, 1px);
		box-shadow: none;
	}

	.login-btn {
		padding: 0.5rem 1.25rem;
		background: var(--text-primary);
		color: var(--bg-secondary);
		border: 2px solid var(--border);
		border-radius: 0;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		box-shadow: var(--shadow-sm);
		transition: all 0.1s ease;
	}

	.login-btn:hover {
		transform: translate(-1px, -1px);
		box-shadow: var(--card-shadow);
		background: var(--highlight);
		color: var(--on-highlight);
	}

	.login-btn:active {
		transform: translate(1px, 1px);
		box-shadow: none;
	}

	.header-mobile-controls {
		display: none;
	}

	.auth-row-mobile {
		display: none;
	}

	@media (max-width: 768px) {
		.header-mobile-controls {
			display: flex;
			flex-direction: row;
			align-items: center;
			justify-content: center;
			gap: 1rem;
			width: 100%;
			visibility: visible;
			opacity: 1;
		}

		.auth-row-mobile {
			display: block;
			flex-shrink: 0;
		}

		.auth-row {
			display: none;
		}

		.header {
			display: flex;
			flex-direction: column;
			gap: 1rem;
			position: sticky;
			top: 0;
			z-index: 100;
		}
	}
</style>
