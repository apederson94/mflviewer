<script lang="ts">
	import {
		DAY_OPTIONS,
		SORT_OPTIONS,
		type DaysOption,
		type SortOption
	} from '$lib';

	let {
		selectedDays = $bindable('1'),
		txSort = $bindable('roster'),
		showTrades = $bindable(false),
		selectedCount,
		totalCount,
		onFilters,
		onDaysChange,
		onShowTradesChange
	}: {
		selectedDays?: DaysOption;
		txSort?: SortOption;
		showTrades?: boolean;
		selectedCount: number;
		totalCount: number;
		onFilters: () => void;
		onDaysChange: () => void;
		onShowTradesChange: () => void;
	} = $props();
</script>

<div class="mobile-toolbar">
	<button class="mobile-filters-btn" onclick={onFilters}>
		<span class="mobile-filters-icon">☰</span>
		<span class="mobile-filters-label">Filters</span>
		{#if selectedCount !== totalCount}
			<span class="mobile-filters-count">{selectedCount}/{totalCount}</span>
		{/if}
	</button>
	<div class="mobile-toolbar-spacer"></div>
	<select
		class="mobile-toolbar-select"
		bind:value={selectedDays}
		onchange={onDaysChange}
	>
		{#each DAY_OPTIONS as day}
			<option value={day.value}
				>{day.value === 'all' ? 'All' : day.label}</option
			>
		{/each}
	</select>
	<select
		class="mobile-toolbar-select"
		bind:value={txSort}
		aria-label="Sort transactions"
	>
		{#each SORT_OPTIONS as sort}
			<option value={sort.value}>{sort.label}</option>
		{/each}
	</select>
	<label class="mobile-toolbar-trades">
		<input
			type="checkbox"
			bind:checked={showTrades}
			onchange={onShowTradesChange}
		/>
		Trades
	</label>
</div>

<style>
	.mobile-filters-btn {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.6rem;
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
		white-space: nowrap;
		flex-shrink: 0;
	}

	.mobile-filters-btn:hover {
		background: var(--text-primary);
		color: var(--bg-secondary);
		transform: translate(-1px, -1px);
		box-shadow: var(--card-shadow);
	}

	.mobile-filters-icon {
		font-size: 1rem;
	}

	.mobile-filters-count {
		font-size: 0.7rem;
		font-weight: 900;
		color: var(--on-highlight);
		background: var(--highlight);
		border: 1px solid var(--border);
		padding: 0.05rem 0.35rem;
		margin-left: 0.15rem;
	}

	.mobile-toolbar-spacer {
		flex: 1;
	}

	.mobile-toolbar-trades {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--text-primary);
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.mobile-toolbar-trades input {
		accent-color: var(--highlight);
		cursor: pointer;
		width: 1rem;
		height: 1rem;
	}
</style>
