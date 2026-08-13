<script lang="ts">
	import PlayerRow from '$lib/PlayerRow.svelte';
	import LeagueTag from './LeagueTag.svelte';
	import type { MFLTransaction, Player, PlayerData } from '$lib';

	let {
		transaction,
		year,
		playerCache,
		onSelect
	}: {
		transaction: MFLTransaction;
		year: string;
		playerCache: ReadonlyMap<string, PlayerData>;
		onSelect: (player: Player) => void;
	} = $props();
</script>

<div class="transaction-card" data-type={transaction.type}>
	<div class="transaction-header">
		<span class="transaction-type">{transaction.type}</span>
		<LeagueTag
			leagueId={transaction.leagueId}
			leagueName={transaction.leagueName ?? ''}
			{year}
		/>
	</div>
	{#if transaction.type === 'Trade' && transaction.tradeGives && transaction.tradeReceives}
		<div class="trade-header">
			<span class="trade-col">{transaction.franchiseName}</span>
			<span class="trade-col">{transaction.tradePartnerName}</span>
		</div>
		<div class="trade-sides">
			<div class="trade-side">
				<div class="trade-separator"></div>
				<div class="trade-side-content">
					{#if transaction.tradeReceives?.length}
						<div class="player-list">
							{#each transaction.tradeReceives as player}
								<PlayerRow
									id={player.id}
									name={player.name}
									position={player.position}
									team={player.team}
									rosterPct={player.rosterPct}
									adp={playerCache.get(player.id)?.adp}
									{onSelect}
								/>
							{/each}
						</div>
					{:else}
						None
					{/if}
				</div>
			</div>
			<div class="trade-side">
				<div class="trade-separator"></div>
				<div class="trade-side-content">
					{#if transaction.tradeGives?.length}
						<div class="player-list">
							{#each transaction.tradeGives as player}
								<PlayerRow
									id={player.id}
									name={player.name}
									position={player.position}
									team={player.team}
									rosterPct={player.rosterPct}
									adp={playerCache.get(player.id)?.adp}
									{onSelect}
								/>
							{/each}
						</div>
					{:else}
						None
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<div class="fa-header">
			<div class="franchise-item">
				<span class="franchise-label">Franchise</span>
				<span class="franchise-name">{transaction.franchiseName}</span>
			</div>
		</div>
		<div class="fa-sides">
			<div class="fa-side">
				<span class="fa-side-header">Added</span>
				<span class="fa-side-content">
					{#if transaction.addedPlayers?.length}
						<div class="player-list">
							{#each transaction.addedPlayers as player}
								<PlayerRow
									id={player.id}
									name={player.name}
									position={player.position}
									team={player.team}
									rosterPct={player.rosterPct}
									adp={playerCache.get(player.id)?.adp}
									{onSelect}
								/>
							{/each}
						</div>
					{:else}
						None
					{/if}
				</span>
			</div>
			<div class="fa-side">
				<span class="fa-side-header">Dropped</span>
				<span class="fa-side-content">
					{#if transaction.droppedPlayers?.length}
						<div class="player-list">
							{#each transaction.droppedPlayers as player}
								<PlayerRow
									id={player.id}
									name={player.name}
									position={player.position}
									team={player.team}
									rosterPct={player.rosterPct}
									adp={playerCache.get(player.id)?.adp}
									{onSelect}
								/>
							{/each}
						</div>
					{:else}
						None
					{/if}
				</span>
			</div>
		</div>
		{#if transaction.bid}<span class="tx-bid">Bid: ${transaction.bid}</span
			>{/if}
	{/if}
	<div class="tx-timestamp">{transaction.formattedTime}</div>
</div>

<style>
	.transaction-card {
		background: var(--bg-secondary);
		border: 2px solid var(--border);
		border-radius: 0;
		padding: 0.75rem;
		box-shadow: var(--card-shadow);
		transition: all 0.1s ease;
		animation: fadeInUp 0.25s ease;
		position: relative;
		overflow: visible;
	}

	.transaction-card::before {
		content: '';
		position: absolute;
		left: -2px;
		top: -2px;
		bottom: -2px;
		width: 8px;
		background: var(--accent);
	}

	.transaction-card[data-type='Trade']::before {
		background: var(--trade-color);
	}

	.transaction-card[data-type='FA Pickup']::before,
	.transaction-card[data-type='Free Agent']::before,
	.transaction-card[data-type='Add/Drop']::before {
		background: var(--free-agent-color);
	}

	.transaction-card[data-type='Waiver']::before {
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

	.transaction-card:hover {
		transform: translate(-2px, -2px);
		box-shadow: var(--card-shadow-hover);
	}

	.transaction-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		padding-bottom: 0.4rem;
		border-bottom: 2px solid var(--border);
	}

	.transaction-type {
		font-weight: 900;
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
		border-radius: 0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		border: 1px solid var(--border);
		flex-shrink: 0;
	}

	.transaction-card[data-type='Trade'] .transaction-type {
		color: var(--trade-color);
		background: var(--type-trade-bg);
	}

	.transaction-card[data-type='FA Pickup'] .transaction-type,
	.transaction-card[data-type='Free Agent'] .transaction-type,
	.transaction-card[data-type='Add/Drop'] .transaction-type {
		color: var(--free-agent-color);
		background: var(--type-fa-bg);
	}

	.transaction-card[data-type='Waiver'] .transaction-type {
		color: var(--waiver-color);
		background: var(--type-waiver-bg);
	}

	.transaction-card:not([data-type='Trade']):not([data-type='FA Pickup']):not(
			[data-type='Free Agent']
		):not([data-type='Add/Drop']):not([data-type='Waiver'])
		.transaction-type {
		color: var(--text-secondary);
		background: var(--type-other-bg);
	}

	.trade-header {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		font-weight: 900;
		font-size: 1rem;
		padding: 0.5rem 0;
		color: var(--text-primary);
	}

	.trade-col {
		text-align: left;
		color: var(--text-primary);
		font-weight: 900;
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.franchise-item {
		text-align: left;
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

	.trade-sides {
		display: flex;
		gap: 0.75rem;
		color: var(--text-primary);
		font-size: 0.9rem;
	}

	.trade-side {
		flex: 1;
		min-width: 0;
		padding: 0.6rem;
		background: var(--bg-paper);
		border: 2px solid var(--border);
		border-radius: 0;
		word-break: break-word;
		box-shadow: var(--shadow-sm);
		transition: all 0.1s ease;
		text-align: left;
	}

	.trade-side:hover {
		transform: translate(-1px, -1px);
		box-shadow: var(--card-shadow);
	}

	.trade-separator {
		display: none;
	}

	.trade-side-content {
		text-align: left;
	}

	.fa-header {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		font-weight: 600;
		font-size: 1rem;
		padding: 0.5rem 0;
		color: var(--text-primary);
		border-bottom: 2px solid var(--border);
		margin-bottom: 0.5rem;
	}

	.fa-sides {
		display: flex;
		gap: 0.75rem;
		color: var(--text-primary);
		font-size: 0.9rem;
	}

	.fa-side {
		flex: 1;
		min-width: 0;
		padding: 0.6rem;
		background: var(--bg-paper);
		border: 2px solid var(--border);
		border-radius: 0;
		word-break: break-word;
		box-shadow: var(--shadow-sm);
		transition: all 0.1s ease;
		text-align: left;
	}

	.fa-side:hover {
		transform: translate(-1px, -1px);
		box-shadow: var(--card-shadow);
	}

	.fa-side-header {
		display: block;
		font-size: 0.7rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 0.25rem;
	}

	.fa-side:first-child .fa-side-header {
		color: var(--free-agent-color);
	}

	.fa-side:last-child .fa-side-header {
		color: var(--drop-color);
	}

	.fa-side-content {
		display: block;
	}

	.player-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		width: 100%;
	}

	.tx-bid {
		display: inline-block;
		margin-top: 0.5rem;
		color: var(--waiver-color);
		background: var(--type-waiver-bg);
		border: 1px solid var(--border);
		border-radius: 0;
		padding: var(--badge-padding);
		font-weight: var(--badge-font-weight);
		text-transform: uppercase;
		font-size: var(--badge-font-size);
		letter-spacing: var(--badge-letter-spacing);
	}

	.tx-timestamp {
		color: var(--text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-top: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.tx-timestamp::before {
		content: '⏱';
		font-size: 0.9rem;
	}

	@media (max-width: 768px) {
		.trade-header,
		.trade-sides {
			grid-template-columns: 1fr;
			gap: 0.5rem;
		}

		.transaction-card::before {
			width: 100%;
			height: 8px;
			left: -2px;
			top: -2px;
			right: -2px;
			bottom: auto;
		}
	}
</style>
