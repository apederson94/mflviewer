<script lang="ts">
	import PlayerRow from '$lib/PlayerRow.svelte';
	import LeagueTag from './LeagueTag.svelte';
	import type { MFLPendingWaiver, Player, PlayerData } from '$lib';

	let {
		waiver,
		year,
		playerCache,
		onSelect
	}: {
		waiver: MFLPendingWaiver;
		year: string;
		playerCache: ReadonlyMap<string, PlayerData>;
		onSelect: (player: Player) => void;
	} = $props();
</script>

<div class="waiver-card">
	<div class="waiver-header">
		<span class="waiver-type">Pending Waiver</span>
		<LeagueTag
			leagueId={waiver.leagueId}
			leagueName={waiver.leagueName ?? ''}
			{year}
		/>
	</div>

	<div class="waiver-details">
		<div class="waiver-franchise">
			<span class="franchise-label">Franchise</span>
			<span class="franchise-name">{waiver.franchiseName}</span>
		</div>

		<div class="waiver-priorities">
			{#each waiver.claims as claim, ci}
				{#if ci > 0}
					<div class="waiver-priority-separator"></div>
				{/if}
				<div class="waiver-priority">
					<span class="priority-badge">#{ci + 1}</span>
					<div class="priority-body">
						<div class="priority-row">
							<span class="priority-label">Add</span>
							{#if claim.addedPlayer}
								<PlayerRow
									id={claim.addedPlayer.id}
									name={claim.addedPlayer.name}
									position={claim.addedPlayer.position}
									team={claim.addedPlayer.team}
									rosterPct={claim.addedPlayer.rosterPct}
									adp={playerCache.get(claim.addedPlayer.id)?.adp}
									{onSelect}
								/>
							{/if}
							<span class="priority-bid">${claim.bid}</span>
						</div>
						<div class="priority-row">
							<span class="priority-label">Drop</span>
							{#if claim.droppedPlayer}
								<PlayerRow
									id={claim.droppedPlayer.id}
									name={claim.droppedPlayer.name}
									position={claim.droppedPlayer.position}
									team={claim.droppedPlayer.team}
									rosterPct={claim.droppedPlayer.rosterPct}
									adp={playerCache.get(claim.droppedPlayer.id)?.adp}
									{onSelect}
								/>
							{:else}
								<span class="no-drop">None</span>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>

		<div class="waiver-meta">
			<span class="waiver-round">Round {waiver.round}</span>
			<span class="waiver-time">{waiver.formattedTime}</span>
		</div>

		{#if waiver.commentsFormatted}
			<div class="waiver-comments">
				<span class="comments-label">Comments</span>
				<span class="comments-text">{waiver.commentsFormatted}</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.waiver-card {
		background: var(--bg-secondary);
		border: 2px solid var(--border);
		border-radius: 0;
		padding: 0.9rem;
		box-shadow: var(--card-shadow);
		transition: all 0.1s ease;
		position: relative;
		animation: fadeInUp 0.25s ease;
	}

	.waiver-card::before {
		content: '';
		position: absolute;
		left: -2px;
		top: -2px;
		bottom: -2px;
		width: 8px;
		background: var(--waiver-color);
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

	.waiver-card:hover {
		transform: translate(-2px, -2px);
		box-shadow: var(--card-shadow-hover);
	}

	.waiver-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		padding-bottom: 0.4rem;
		border-bottom: 2px solid var(--border);
	}

	.waiver-type {
		font-weight: 900;
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
		border-radius: 0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--waiver-color);
		background: var(--type-waiver-bg);
		border: 1px solid var(--border);
	}

	.waiver-details {
		padding: 0.25rem 0;
	}

	.waiver-franchise {
		margin-bottom: 0.5rem;
	}

	.franchise-label {
		display: block;
		font-size: 0.65rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 0.15rem;
	}

	.franchise-name {
		display: block;
		color: var(--text-primary);
		font-weight: 900;
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.waiver-priorities {
		margin-bottom: 0.5rem;
	}

	.waiver-priority-separator {
		height: 2px;
		background: var(--text-primary);
		margin: 0.5rem 0;
	}

	.waiver-priority {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.priority-badge {
		font-size: var(--badge-font-size);
		font-weight: var(--badge-font-weight);
		padding: var(--badge-padding);
		border-radius: 0;
		background: var(--highlight);
		color: var(--on-highlight);
		border: 1px solid var(--border);
		letter-spacing: var(--badge-letter-spacing);
		flex-shrink: 0;
		margin-top: 0.15rem;
	}

	.priority-body {
		flex: 1;
		min-width: 0;
	}

	.priority-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0;
	}

	.priority-label {
		font-size: 0.65rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		width: 3rem;
		flex-shrink: 0;
	}

	:global(.priority-row .player-row) {
		flex: 1;
		min-width: 0;
	}

	.priority-bid {
		font-size: 0.8rem;
		font-weight: 900;
		color: var(--waiver-color);
		background: var(--type-waiver-bg);
		border: 1px solid var(--border);
		border-radius: 0;
		padding: 0.1rem 0.4rem;
		flex-shrink: 0;
		white-space: nowrap;
		margin-left: 0.25rem;
	}

	.no-drop {
		color: var(--text-muted);
		font-style: italic;
		font-size: 0.85rem;
		font-weight: 700;
	}

	.waiver-meta {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-bottom: 0.5rem;
		font-weight: 700;
	}

	.waiver-round {
		background: var(--bg-primary);
		border: 1px solid var(--border);
		padding: 0.15rem 0.4rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-size: 0.7rem;
	}

	.waiver-comments {
		padding: 0.6rem;
		background: var(--bg-paper);
		border: 2px solid var(--border);
		border-radius: 0;
		text-align: left;
		box-shadow: var(--shadow-sm);
	}

	.comments-label {
		display: block;
		font-size: 0.7rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
	}

	.comments-text {
		font-size: 0.85rem;
		color: var(--text-secondary);
		white-space: pre-wrap;
	}
</style>
