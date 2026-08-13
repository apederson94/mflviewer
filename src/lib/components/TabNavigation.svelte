<script lang="ts">
	import type { Tab } from '$lib';

	let {
		activeTab,
		pendingWaiverCount,
		waiverLoading,
		onselect,
		onrefresh
	}: {
		activeTab: Tab;
		pendingWaiverCount: number;
		waiverLoading: boolean;
		onselect: (tab: Tab) => void;
		onrefresh: () => void;
	} = $props();
</script>

<div class="tab-navigation">
	<button
		class="tab-button"
		class:active={activeTab === 'transactions'}
		onclick={() => onselect('transactions')}
	>
		Transactions
	</button>
	<button
		class="tab-button"
		class:active={activeTab === 'waivers'}
		onclick={() => onselect('waivers')}
	>
		Pending Waivers
		{#if pendingWaiverCount > 0}
			<span class="tab-count">{pendingWaiverCount}</span>
		{/if}
	</button>
	<button
		class="tab-button"
		class:active={activeTab === 'freeAgents'}
		onclick={() => onselect('freeAgents')}
	>
		Free Agents
	</button>
	{#if activeTab === 'waivers' && !waiverLoading && pendingWaiverCount > 0}
		<button class="tab-refresh-btn" onclick={onrefresh}>Refresh</button>
	{/if}
</div>

<style>
	.tab-navigation {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		border-bottom: 3px solid var(--border);
		padding-bottom: 0.5rem;
	}

	.tab-button {
		padding: 0.55rem 1.25rem;
		border: 2px solid var(--border);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.85rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		cursor: pointer;
		border-radius: 0;
		box-shadow: var(--shadow-sm);
		transition: all 0.1s ease;
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.tab-button:hover {
		transform: translate(-1px, -1px);
		box-shadow: var(--card-shadow);
	}

	.tab-button.active {
		color: var(--bg-secondary);
		background: var(--text-primary);
		transform: translate(1px, 1px);
		box-shadow: none;
	}

	.tab-count {
		font-size: 0.7rem;
		background: var(--highlight);
		color: var(--on-highlight);
		border: 1px solid var(--border);
		padding: 0.05rem 0.35rem;
		font-weight: 900;
	}

	.tab-refresh-btn {
		margin-left: auto;
		padding: 0.35rem 0.9rem;
		border: 2px solid var(--border);
		border-radius: 0;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: 0.75rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		cursor: pointer;
		box-shadow: var(--shadow-sm);
		transition: all 0.1s ease;
	}

	.tab-refresh-btn:hover {
		background: var(--text-primary);
		color: var(--bg-secondary);
		transform: translate(-1px, -1px);
		box-shadow: var(--card-shadow);
	}
</style>
