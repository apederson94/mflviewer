<script lang="ts">
	import {
		FA_POSITIONS,
		DAY_OPTIONS,
		SORT_OPTIONS,
		type League,
		type Tab,
		type DaysOption,
		type PositionOption,
		type SortOption
	} from '$lib';

	let {
		open,
		leagues,
		selectedLeagueIds,
		isLoggedIn,
		dataError,
		activeTab,
		leagueSearch = $bindable(''),
		selectedDays = $bindable('1'),
		txSort = $bindable('roster'),
		showTrades = $bindable(false),
		faSearch = $bindable(''),
		faPosition = $bindable('ALL'),
		faSort = $bindable('roster'),
		hideLocked = $bindable(false),
		onClose,
		onSelectionChange,
		onDaysChange,
		onShowTradesChange
	}: {
		open: boolean;
		leagues: League[];
		selectedLeagueIds: Set<string>;
		isLoggedIn: boolean;
		dataError?: string;
		activeTab: Tab;
		leagueSearch?: string;
		selectedDays?: DaysOption;
		txSort?: SortOption;
		showTrades?: boolean;
		faSearch?: string;
		faPosition?: PositionOption;
		faSort?: SortOption;
		hideLocked?: boolean;
		onClose: () => void;
		onSelectionChange: (ids: string[]) => void;
		onDaysChange: () => void;
		onShowTradesChange: () => void;
	} = $props();

	let filteredLeagues = $derived(
		leagueSearch
			? leagues.filter(
					(l) =>
						l.name.toLowerCase().includes(leagueSearch.toLowerCase()) ||
						l.id.includes(leagueSearch)
				)
			: leagues
	);

	let filteredAllSelected = $derived(
		filteredLeagues.length > 0 &&
			filteredLeagues.every((l) => selectedLeagueIds.has(l.id))
	);

	let selectedCount = $derived(selectedLeagueIds.size);

	function toggleLeague(leagueId: string) {
		const next = new Set(selectedLeagueIds);
		if (next.has(leagueId)) {
			next.delete(leagueId);
		} else {
			next.add(leagueId);
		}
		onSelectionChange(Array.from(next));
	}

	function selectAll() {
		const next = new Set(selectedLeagueIds);
		for (const l of filteredLeagues) next.add(l.id);
		onSelectionChange(Array.from(next));
	}

	function selectNone() {
		const next = new Set(selectedLeagueIds);
		for (const l of filteredLeagues) next.delete(l.id);
		onSelectionChange(Array.from(next));
	}
</script>

<aside class="sidebar" class:open>
	<div class="sidebar-header">
		<button class="sidebar-close" onclick={onClose} aria-label="Close filters"
			>✕</button
		>
	</div>
	<div class="sidebar-content">
		<h2>Filters</h2>

		{#if dataError}
			<p class="error">{dataError}</p>
		{/if}

		{#if !isLoggedIn}
			<p class="login-prompt">Log in to view your leagues</p>
		{:else}
			<input
				class="league-search"
				type="text"
				placeholder="Search leagues..."
				bind:value={leagueSearch}
			/>
			<div class="filter-actions">
				<button
					class="filter-btn"
					onclick={selectAll}
					disabled={filteredAllSelected}>All</button
				>
				<button
					class="filter-btn"
					onclick={selectNone}
					disabled={filteredLeagues.every((l) => !selectedLeagueIds.has(l.id))}
					>None</button
				>
			</div>
			<div class="selection-count">
				{selectedCount} of {leagues.length} selected
			</div>
			<ul class="league-filter-list">
				{#each filteredLeagues as league (league.id)}
					<li class="league-filter-item">
						<label class="league-checkbox-label">
							<input
								type="checkbox"
								checked={selectedLeagueIds.has(league.id)}
								onchange={() => toggleLeague(league.id)}
							/>
							<span class="league-name">{league.name}</span>
							<span class="league-id">{league.id}</span>
						</label>
					</li>
				{/each}
			</ul>
			{#if leagueSearch && filteredLeagues.length === 0}
				<p class="no-data">No leagues match your search</p>
			{/if}
			{#if leagues.length === 0 && !dataError}
				<p class="no-data">No leagues found</p>
			{/if}
			{#if leagues.length > 0}
				<div class="sidebar-divider"></div>
				{#if activeTab === 'transactions'}
					<div class="sidebar-timeframe">
						<label for="days-select-sidebar" class="sidebar-label"
							>Timeframe</label
						>
						<select
							id="days-select-sidebar"
							bind:value={selectedDays}
							onchange={onDaysChange}
						>
							{#each DAY_OPTIONS as day}
								<option value={day.value}>{day.label}</option>
							{/each}
						</select>
					</div>
					<div class="sidebar-filter-group">
						<label for="tx-sort-select" class="sidebar-label">Sort by</label>
						<select id="tx-sort-select" bind:value={txSort}>
							{#each SORT_OPTIONS as sort}
								<option value={sort.value}>{sort.label}</option>
							{/each}
						</select>
					</div>
					<label class="sidebar-trade-toggle">
						<input
							type="checkbox"
							bind:checked={showTrades}
							onchange={onShowTradesChange}
						/>
						Show Trades
					</label>
				{/if}
				{#if activeTab === 'freeAgents'}
					<input
						class="fa-search"
						type="text"
						placeholder="Search players..."
						bind:value={faSearch}
					/>
					<div class="sidebar-filter-group">
						<label for="fa-position-select" class="sidebar-label"
							>Position</label
						>
						<select id="fa-position-select" bind:value={faPosition}>
							{#each FA_POSITIONS as pos}
								<option value={pos}>{pos === 'ALL' ? 'All' : pos}</option>
							{/each}
						</select>
					</div>
					<div class="sidebar-filter-group">
						<label for="fa-sort-select" class="sidebar-label">Sort by</label>
						<select id="fa-sort-select" bind:value={faSort}>
							{#each SORT_OPTIONS as sort}
								<option value={sort.value}>{sort.label}</option>
							{/each}
						</select>
					</div>
					<label class="sidebar-trade-toggle">
						<input type="checkbox" bind:checked={hideLocked} />
						Hide locked
					</label>
				{/if}
			{/if}
		{/if}
	</div>

	<a
		href="https://github.com/apederson94/mflviewer"
		target="_blank"
		rel="noopener noreferrer"
		class="github-stars"
	>
		<img
			src="https://img.shields.io/github/stars/apederson94/mflviewer?style=social"
			alt="GitHub Stars"
		/>
	</a>
</aside>

<style>
	.sidebar {
		width: 280px;
		min-width: 280px;
		background: var(--bg-secondary);
		border-right: 3px solid var(--border);
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		position: sticky;
		top: 0;
		height: calc(100vh - 65px);
		max-height: calc(100vh - 65px);
	}

	.sidebar-content {
		flex: 1;
		padding: 1rem;
	}

	.sidebar .github-stars {
		padding: 1rem;
		text-align: right;
		border-top: 2px solid var(--border);
	}

	.github-stars img {
		height: 20px;
		width: auto;
	}

	.sidebar h2 {
		margin: 0 0 1rem 0;
		font-size: 1.1rem;
		color: var(--text-primary);
		text-transform: uppercase;
		letter-spacing: 1px;
		padding-bottom: 0.5rem;
		border-bottom: 3px solid var(--border);
		display: inline-block;
		flex-shrink: 0;
	}

	.login-prompt {
		color: var(--text-secondary);
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		text-align: center;
		padding: 1rem;
		border: 2px dashed var(--text-muted);
	}

	.league-filter-list {
		list-style: none;
		padding: 0;
		margin: 0;
		max-height: 320px;
		overflow-y: auto;
	}

	.league-filter-list::-webkit-scrollbar {
		width: 8px;
	}

	.league-filter-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.league-filter-list::-webkit-scrollbar-thumb {
		background: var(--text-primary);
		border-radius: 0;
	}

	.league-filter-item {
		margin-bottom: 0.25rem;
	}

	.league-checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border: 2px solid transparent;
		cursor: pointer;
		transition: all 0.1s ease;
	}

	.league-checkbox-label:hover {
		background: var(--highlight);
		border-color: var(--border);
		box-shadow: var(--shadow-sm);
		color: var(--on-highlight);
	}

	.league-checkbox-label:hover .league-name {
		color: var(--on-highlight);
	}

	.league-checkbox-label input[type='checkbox'] {
		accent-color: var(--highlight);
		width: 1rem;
		height: 1rem;
		cursor: pointer;
		flex-shrink: 0;
	}

	.league-name {
		flex: 1;
		color: var(--text-primary);
		font-size: 0.9rem;
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.league-id {
		color: var(--text-primary);
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.1rem 0.35rem;
		background: var(--bg-primary);
		border: 1px solid var(--border);
		flex-shrink: 0;
	}

	.league-search {
		width: 100%;
		padding: 0.5rem;
		margin-bottom: 0.75rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 2px solid var(--border);
		border-radius: 0;
		font-size: 0.85rem;
		font-weight: 700;
		box-sizing: border-box;
	}

	.league-search:focus {
		outline: none;
		background: var(--bg-paper);
		box-shadow: var(--shadow-sm);
	}

	.league-search::placeholder {
		color: var(--text-muted);
		font-weight: 700;
		text-transform: uppercase;
	}

	.selection-count {
		color: var(--text-secondary);
		font-size: 0.7rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 0.5rem;
	}

	.filter-actions {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.filter-btn {
		flex: 1;
		padding: 0.4rem 0.5rem;
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

	.filter-btn:hover:not(:disabled) {
		background: var(--text-primary);
		color: var(--bg-secondary);
		transform: translate(-1px, -1px);
		box-shadow: var(--card-shadow);
	}

	.filter-btn:active:not(:disabled) {
		transform: translate(1px, 1px);
		box-shadow: none;
	}

	.filter-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		box-shadow: none;
	}

	.sidebar-divider {
		height: 3px;
		background: var(--text-primary);
		margin: 0.75rem 0;
	}

	.sidebar-timeframe {
		margin-bottom: 0.5rem;
	}

	.sidebar-label {
		display: block;
		color: var(--text-primary);
		font-size: 0.7rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 0.35rem;
	}

	.sidebar-timeframe select,
	.sidebar-filter-group select {
		width: 100%;
		padding: 0.4rem 0.5rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 2px solid var(--border);
		border-radius: 0;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
	}

	.sidebar-timeframe select:focus,
	.sidebar-filter-group select:focus {
		outline: none;
		box-shadow: var(--shadow-sm);
	}

	.sidebar-trade-toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--text-primary);
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		padding: 0.25rem 0;
	}

	.sidebar-trade-toggle input {
		cursor: pointer;
		accent-color: var(--text-primary);
		width: 1rem;
		height: 1rem;
	}

	.sidebar-filter-group {
		margin-bottom: 0.5rem;
	}

	.fa-search {
		width: 100%;
		padding: 0.5rem;
		margin-bottom: 0.5rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 2px solid var(--border);
		border-radius: 0;
		font-size: 0.85rem;
		font-weight: 700;
		box-sizing: border-box;
	}

	.fa-search:focus {
		outline: none;
		background: var(--bg-paper);
		box-shadow: var(--shadow-sm);
	}

	.fa-search::placeholder {
		color: var(--text-muted);
		text-transform: uppercase;
		font-weight: 700;
	}

	.sidebar-header {
		display: none;
	}

	.sidebar-close {
		display: none;
	}

	@media (max-width: 768px) {
		.sidebar {
			display: flex;
			position: fixed;
			top: 0;
			left: 0;
			bottom: 0;
			width: 300px;
			max-width: 80vw;
			z-index: 101;
			transform: translateX(-100%);
			transition: transform 0.2s ease;
			height: 100vh;
			max-height: 100vh;
			border-right: 3px solid var(--border);
			box-shadow: 8px 0 0 rgba(17, 17, 17, 0.12);
		}

		.sidebar.open {
			transform: translateX(0);
		}

		.sidebar-header {
			display: flex;
			justify-content: flex-end;
			padding: 0.5rem 0.5rem 0 0;
			position: absolute;
			top: 0;
			right: 0;
			z-index: 1;
		}

		.sidebar-close {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 2rem;
			height: 2rem;
			border: 2px solid var(--border);
			border-radius: 0;
			background: var(--bg-secondary);
			color: var(--text-primary);
			font-size: 1rem;
			font-weight: 900;
			cursor: pointer;
			transition: all 0.1s ease;
			box-shadow: var(--shadow-sm);
		}

		.sidebar-close:hover {
			background: var(--text-primary);
			color: var(--bg-secondary);
		}
	}
</style>
