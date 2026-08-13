<script lang="ts">
	let {
		id,
		position,
		size = 'md',
		alt = ''
	}: {
		id: string;
		position?: string;
		size?: 'sm' | 'md' | 'lg';
		alt?: string;
	} = $props();

	let failed = $state(false);

	const isFaab = $derived(position === 'FAAB' || id.startsWith('BB_'));
	const src = $derived('/api/player-image/' + encodeURIComponent(id));
	const initial = $derived(position && position !== 'UNK' ? position[0] : '?');
</script>

{#if isFaab}
	<span
		class="player-photo player-photo-fallback player-photo-faab"
		class:sm={size === 'sm'}
		class:lg={size === 'lg'}>$</span
	>
{:else if failed}
	<span
		class="player-photo player-photo-fallback"
		class:sm={size === 'sm'}
		class:lg={size === 'lg'}>{initial}</span
	>
{:else}
	<img
		class="player-photo"
		class:sm={size === 'sm'}
		class:lg={size === 'lg'}
		{src}
		{alt}
		loading="lazy"
		decoding="async"
		width="80"
		height="107"
		onerror={() => (failed = true)}
	/>
{/if}

<style>
	.player-photo {
		width: 36px;
		height: 36px;
		border-radius: 0;
		object-fit: cover;
		border: 2px solid var(--border);
		background: var(--bg-primary);
		flex-shrink: 0;
	}

	.player-photo.sm {
		width: 24px;
		height: 24px;
	}

	.player-photo.lg {
		width: 44px;
		height: 44px;
	}

	.player-photo-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 900;
		color: var(--pos-unk-text);
		background: var(--pos-unk-bg);
		border: 2px solid var(--border);
		text-transform: uppercase;
	}

	.player-photo-fallback.sm {
		font-size: 0.65rem;
	}

	.player-photo-fallback.lg {
		font-size: 1rem;
	}

	.player-photo-faab {
		color: var(--pos-rb-text);
		background: var(--pos-rb-bg);
	}
</style>
