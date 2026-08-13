<script lang="ts">
	import PlayerAvatar from '$lib/PlayerAvatar.svelte';
	import TeamChip from '$lib/TeamChip.svelte';
	import type { Player } from '$lib';

	let {
		fa,
		adp,
		selectedCount,
		onSelect,
		onAvailEnter,
		onAvailLeave,
		onAvailToggle
	}: {
		fa: Player;
		adp?: string;
		selectedCount: number;
		onSelect: (player: Player) => void;
		onAvailEnter: (e: MouseEvent, leagues: string[]) => void;
		onAvailLeave: () => void;
		onAvailToggle: (e: MouseEvent, leagues: string[]) => void;
	} = $props();

	const availableIn = $derived(fa.availableIn ?? []);
</script>

<div
	class="fa-card"
	class:locked={fa.locked}
	role="button"
	tabindex="0"
	aria-label={`View profile for ${fa.name}`}
	onclick={() => onSelect(fa)}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onSelect(fa);
		}
	}}
>
	<div class="fa-card-top">
		<PlayerAvatar id={fa.id} position={fa.position} size="md" />
		{#if fa.position}
			<span class="position-badge" data-position={fa.position}
				>{fa.position}</span
			>
		{/if}
		<span class="player-name">{fa.name}</span>
	</div>
	<div class="fa-card-meta">
		<TeamChip team={fa.team} />
		{#if fa.rosterPct != null}
			<span class="roster-badge">{fa.rosterPct.toFixed(1)}%</span>
		{/if}
		{#if adp}
			<span class="adp-badge">ADP {adp}</span>
		{/if}
		{#if fa.locked}
			<span class="fa-lock">Locked</span>
		{/if}
		{#if availableIn.length < selectedCount}
			<button
				type="button"
				class="fa-avail"
				onmouseenter={(e) => onAvailEnter(e, availableIn)}
				onmouseleave={onAvailLeave}
				onclick={(e) => {
					e.stopPropagation();
					onAvailToggle(e, availableIn);
				}}
			>
				FA {availableIn.length}/{selectedCount}
			</button>
		{/if}
	</div>
</div>

<style>
	.fa-card {
		background: var(--bg-secondary);
		border: 2px solid var(--border);
		border-radius: 0;
		padding: 0.75rem;
		box-shadow: var(--card-shadow);
		transition: all 0.1s ease;
		animation: fadeInUp 0.25s ease;
		position: relative;
		cursor: pointer;
	}

	.fa-card::before {
		content: '';
		position: absolute;
		left: -2px;
		top: -2px;
		bottom: -2px;
		width: 8px;
		background: var(--free-agent-color);
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.fa-card:hover {
		transform: translate(-2px, -2px);
		box-shadow: var(--card-shadow-hover);
	}

	.fa-card:focus-visible {
		outline: 2px solid var(--highlight);
		outline-offset: 2px;
		cursor: pointer;
	}

	.fa-card.locked {
		opacity: 0.6;
	}

	.fa-card-top {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.5rem;
		min-width: 0;
	}

	.fa-card-top .player-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 800;
	}

	.fa-card-meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.fa-lock {
		font-size: 0.65rem;
		font-weight: 900;
		color: var(--tint-amber-text);
		background: var(--tint-amber-bg);
		border: 1px solid var(--border);
		border-radius: 0;
		padding: 0.05rem 0.3rem;
		white-space: nowrap;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.fa-avail {
		font-size: 0.65rem;
		font-weight: 900;
		color: var(--free-agent-color);
		background: var(--tint-green-bg);
		border: 1px solid var(--border);
		border-radius: 0;
		padding: 0.05rem 0.3rem;
		white-space: nowrap;
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	@media (max-width: 768px) {
		.fa-card::before {
			width: 100%;
			height: 8px;
			left: -2px;
			top: -2px;
			right: -2px;
			bottom: auto;
		}
	}
</style>
