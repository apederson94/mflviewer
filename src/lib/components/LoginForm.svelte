<script lang="ts">
	let {
		loading,
		onSubmit
	}: {
		loading: boolean;
		onSubmit: (username: string, password: string) => void;
	} = $props();

	let username = $state('');
	let password = $state('');

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		onSubmit(username, password);
	}
</script>

<form class="login-form" onsubmit={handleSubmit}>
	<input type="text" placeholder="Username" bind:value={username} />
	<input type="password" placeholder="Password" bind:value={password} />
	<button type="submit" disabled={loading}> Login </button>
</form>

<style>
	.login-form {
		display: flex;
		gap: 0.5rem;
	}

	.login-form input {
		padding: 0.5rem 0.75rem;
		border: 2px solid var(--border);
		border-radius: 0;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.85rem;
		font-weight: 700;
		transition:
			box-shadow 0.1s ease,
			transform 0.1s ease;
	}

	.login-form input:focus {
		outline: none;
		background: var(--highlight);
		color: var(--on-highlight);
		box-shadow: var(--shadow-sm);
	}

	.login-form input::placeholder {
		color: var(--text-muted);
		text-transform: uppercase;
		font-weight: 700;
	}

	.login-form button {
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

	.login-form button:hover {
		transform: translate(-1px, -1px);
		box-shadow: var(--card-shadow);
		background: var(--highlight);
		color: var(--on-highlight);
	}

	.login-form button:active {
		transform: translate(1px, 1px);
		box-shadow: none;
	}

	.login-form button:disabled {
		background: var(--text-muted);
		cursor: not-allowed;
		transform: none;
		box-shadow: var(--shadow-sm);
		opacity: 0.7;
	}

	@media (max-width: 768px) {
		.login-form {
			flex-wrap: wrap;
			justify-content: center;
		}
	}
</style>
