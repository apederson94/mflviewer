<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import type { MFLTransaction, MFLPendingWaiver, Player } from '$lib';
	import PlayerAvatar from '$lib/PlayerAvatar.svelte';
	import TeamChip from '$lib/TeamChip.svelte';
	import PlayerRow from '$lib/PlayerRow.svelte';
	import PlayerProfileModal from '$lib/PlayerProfileModal.svelte';

	let { data }: { data: PageData } = $props();

	let leagues = $state(data.leagues ?? []);
	let selectedLeagueIds = $state(
		new Set<string>(data.leagues?.map((l) => l.id) ?? [])
	);
	let transactions = $state<MFLTransaction[]>([]);
	let playerCache = $state(new Map(data.players || []));
	let loading = $state(false);
	let error = $state<string | null>(null);
	let loginUsername = $state('');
	let loginPassword = $state('');
	let formLoading = $state(false);

	let isLoggedIn = $derived(data.loggedIn);
	let year = $state(data.year);
	let selectedDays = $state('1');
	let showTrades = $state(false);
	let txSort = $state<'roster' | 'adp'>('roster');
	let mobileFilterOpen = $state(false);
	let leagueSearch = $state('');
	let activeTab = $state<'transactions' | 'waivers' | 'freeAgents'>(
		'transactions'
	);
	let pendingWaivers = $state<MFLPendingWaiver[]>([]);
	let waiverLoading = $state(false);
	let freeAgents = $state<Player[]>([]);
	let freeAgentLoading = $state(false);
	let faPosition = $state('ALL');
	let faSearch = $state('');
	let hideLocked = $state(false);
	let faSort = $state<'roster' | 'adp'>('roster');
	let loadId = 0;
	let waiverLoadId = 0;
	let freeAgentLoadId = 0;

	let profilePlayer = $state<Player | null>(null);

	function openProfile(player: Player) {
		profilePlayer = player;
	}

	function closeProfile() {
		profilePlayer = null;
	}

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

	const faPositions = [
		'ALL',
		'QB',
		'RB',
		'WR',
		'TE',
		'K',
		'DST',
		'DT',
		'DE',
		'LB',
		'CB',
		'S'
	];

	let filteredFreeAgents = $derived(
		freeAgents
			.filter((fa) => {
				const position = fa.position ?? 'UNK';
				if (faPosition === 'DST') {
					if (!['DST', 'DEF', 'DFL'].includes(position)) return false;
				} else if (faPosition !== 'ALL' && position !== faPosition) {
					return false;
				}
				if (faSearch && !fa.name.toLowerCase().includes(faSearch.toLowerCase()))
					return false;
				if (hideLocked && fa.locked) return false;
				return true;
			})
			.sort((a, b) => {
				if (!!a.locked !== !!b.locked) return a.locked ? 1 : -1;
				if (faSort === 'adp') {
					const adpA = parseFloat(playerCache.get(a.id)?.adp ?? '');
					const adpB = parseFloat(playerCache.get(b.id)?.adp ?? '');
					const hasA = Number.isFinite(adpA);
					const hasB = Number.isFinite(adpB);
					if (hasA && hasB) return adpA - adpB;
					if (hasA) return -1;
					if (hasB) return 1;
				}
				return (b.rosterPct || 0) - (a.rosterPct || 0);
			})
	);

	function transactionBestAdp(t: MFLTransaction): number | null {
		const players = [
			...(t.tradeGives ?? []),
			...(t.tradeReceives ?? []),
			...(t.addedPlayers ?? []),
			...(t.droppedPlayers ?? [])
		];
		let best: number | null = null;
		for (const p of players) {
			const adp = parseFloat(playerCache.get(p.id)?.adp ?? '');
			if (Number.isFinite(adp) && (best === null || adp < best)) best = adp;
		}
		return best;
	}

	let sortedTransactions = $derived(
		txSort === 'adp'
			? [...transactions].sort((a, b) => {
					const adpA = transactionBestAdp(a);
					const adpB = transactionBestAdp(b);
					if (adpA !== null && adpB !== null) return adpA - adpB;
					if (adpA !== null) return -1;
					if (adpB !== null) return 1;
					return (b.maxRosterPct || 0) - (a.maxRosterPct || 0);
				})
			: transactions
	);

	function reloadForTab(ids: string[]) {
		if (activeTab === 'transactions') {
			loadTransactions(ids);
		} else if (activeTab === 'waivers') {
			loadPendingWaivers(ids);
		} else {
			loadFreeAgents(ids);
		}
	}

	function toggleMobileFilter() {
		mobileFilterOpen = !mobileFilterOpen;
	}

	async function loadTransactions(leagueIds: string[]) {
		if (leagueIds.length === 0) {
			transactions = [];
			return;
		}
		const thisLoad = ++loadId;
		loading = true;
		error = null;
		try {
			const res = await fetch(
				`/api/mfl?type=transactions&league=${leagueIds.join(',')}&days=${selectedDays}&includeTrades=${showTrades}`
			);
			if (thisLoad !== loadId) return;
			const data = await res.json();
			if (data.error) {
				throw new Error(data.error);
			}
			transactions = data.transactions || [];
		} catch (err) {
			if (thisLoad !== loadId) return;
			error =
				err instanceof Error ? err.message : 'Failed to load transactions';
			transactions = [];
		} finally {
			if (thisLoad === loadId) loading = false;
		}
	}

	async function loadPendingWaivers(leagueIds: string[]) {
		if (leagueIds.length === 0) {
			pendingWaivers = [];
			return;
		}
		const thisLoad = ++waiverLoadId;
		waiverLoading = true;
		error = null;
		try {
			const res = await fetch(
				`/api/mfl?type=pendingWaivers&league=${leagueIds.join(',')}`
			);
			if (thisLoad !== waiverLoadId) return;
			const data = await res.json();
			if (data.error) {
				throw new Error(data.error);
			}
			pendingWaivers = data.pendingWaivers || [];
		} catch (err) {
			if (thisLoad !== waiverLoadId) return;
			error =
				err instanceof Error ? err.message : 'Failed to load pending waivers';
			pendingWaivers = [];
		} finally {
			if (thisLoad === waiverLoadId) waiverLoading = false;
		}
	}

	async function loadFreeAgents(leagueIds: string[]) {
		if (leagueIds.length === 0) {
			freeAgents = [];
			return;
		}
		const thisLoad = ++freeAgentLoadId;
		freeAgentLoading = true;
		error = null;
		try {
			const res = await fetch(
				`/api/mfl?type=freeAgents&league=${leagueIds.join(',')}`
			);
			if (thisLoad !== freeAgentLoadId) return;
			const data = await res.json();
			if (data.error) {
				throw new Error(data.error);
			}
			freeAgents = data.freeAgents || [];
		} catch (err) {
			if (thisLoad !== freeAgentLoadId) return;
			error = err instanceof Error ? err.message : 'Failed to load free agents';
			freeAgents = [];
		} finally {
			if (thisLoad === freeAgentLoadId) freeAgentLoading = false;
		}
	}

	function leagueName(leagueId: string): string {
		return leagues.find((l) => l.id === leagueId)?.name ?? leagueId;
	}

	let availTooltip = $state<{ x: number; y: number; leagues: string[] } | null>(
		null
	);

	function showAvailTooltip(e: MouseEvent, leagues: string[]) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		availTooltip = {
			x: Math.min(rect.left, window.innerWidth - 288 - 8),
			y: rect.bottom + 8,
			leagues
		};
	}

	function hideAvailTooltip() {
		availTooltip = null;
	}

	let theme = $state<'light' | 'dark'>(
		typeof document !== 'undefined' &&
			document.documentElement.getAttribute('data-theme') === 'dark'
			? 'dark'
			: 'light'
	);

	$effect(() => {
		document.documentElement.setAttribute('data-theme', theme);
		try {
			window.localStorage.setItem('mfl-theme', theme);
		} catch {
			// localStorage can throw in private browsing; theme is still applied to the DOM
		}
	});

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
	}

	async function handleLogin(e: Event) {
		e.preventDefault();
		if (!loginUsername.trim() || !loginPassword.trim()) {
			error = 'Please enter username and password';
			return;
		}

		formLoading = true;
		error = null;

		try {
			const formData = new FormData();
			formData.append('username', loginUsername);
			formData.append('password', loginPassword);

			const res = await fetch('/api/mfl/login', {
				method: 'POST',
				body: formData
			});

			const result = await res.json();

			if (result.success) {
				window.location.reload();
			} else {
				error = result.error || 'Login failed';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Login failed';
		} finally {
			formLoading = false;
		}
	}

	async function handleLogout() {
		try {
			await fetch('/api/mfl/logout', { method: 'POST' });
			window.location.reload();
		} catch (err) {
			console.error('Logout failed:', err);
		}
	}

	function handleLeagueToggle(leagueId: string) {
		const next = new Set(selectedLeagueIds);
		if (next.has(leagueId)) {
			next.delete(leagueId);
		} else {
			next.add(leagueId);
		}
		selectedLeagueIds = next;
		reloadForTab(Array.from(next));
	}

	function handleSelectAll() {
		const next = new Set(selectedLeagueIds);
		for (const l of filteredLeagues) next.add(l.id);
		selectedLeagueIds = next;
		reloadForTab(Array.from(next));
	}

	function handleSelectNone() {
		const next = new Set(selectedLeagueIds);
		for (const l of filteredLeagues) next.delete(l.id);
		selectedLeagueIds = next;
		reloadForTab(Array.from(next));
	}

	onMount(() => {
		if (isLoggedIn && selectedLeagueIds.size > 0) {
			reloadForTab(Array.from(selectedLeagueIds));
		}
	});
</script>

<svelte:head>
	<title>MFL Transaction Viewer</title>
</svelte:head>

<div class="app">
	<header class="header">
		<div class="title-row">
			<h1>MFL Transaction Viewer <span class="week">Week {data.week}</span></h1>
		</div>
		<div class="header-mobile-controls">
			<button
				class="theme-toggle"
				onclick={toggleTheme}
				aria-label="Toggle dark mode"
			>
				{theme === 'dark' ? 'Light' : 'Dark'}
			</button>
			<div class="auth-row-mobile">
				{#if isLoggedIn}
					<button onclick={handleLogout} class="login-btn">Logout</button>
				{:else}
					<form class="login-form" onsubmit={handleLogin}>
						<input
							type="text"
							placeholder="Username"
							bind:value={loginUsername}
						/>
						<input
							type="password"
							placeholder="Password"
							bind:value={loginPassword}
						/>
						<button type="submit" disabled={formLoading}> Login </button>
					</form>
				{/if}
			</div>
		</div>
		<div class="auth-row">
			<button
				class="theme-toggle"
				onclick={toggleTheme}
				aria-label="Toggle dark mode"
			>
				{theme === 'dark' ? 'Light' : 'Dark'}
			</button>
			{#if isLoggedIn}
				<button onclick={handleLogout} class="login-btn">Logout</button>
			{:else}
				<form class="login-form" onsubmit={handleLogin}>
					<input
						type="text"
						placeholder="Username"
						bind:value={loginUsername}
					/>
					<input
						type="password"
						placeholder="Password"
						bind:value={loginPassword}
					/>
					<button type="submit" disabled={formLoading}> Login </button>
				</form>
			{/if}
		</div>
	</header>

	<div class="main-content">
		<aside class="sidebar" class:open={mobileFilterOpen}>
			<div class="sidebar-header">
				<button
					class="sidebar-close"
					onclick={toggleMobileFilter}
					aria-label="Close filters">✕</button
				>
			</div>
			<div class="sidebar-content">
				<h2>Filters</h2>

				{#if data.error}
					<p class="error">{data.error}</p>
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
							onclick={handleSelectAll}
							disabled={filteredAllSelected}>All</button
						>
						<button
							class="filter-btn"
							onclick={handleSelectNone}
							disabled={filteredLeagues.every(
								(l) => !selectedLeagueIds.has(l.id)
							)}>None</button
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
										onchange={() => handleLeagueToggle(league.id)}
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
					{#if leagues.length === 0 && !data.error}
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
									onchange={() =>
										loadTransactions(Array.from(selectedLeagueIds))}
								>
									<option value="1">1 day</option>
									<option value="7">7 days</option>
									<option value="14">14 days</option>
									<option value="30">30 days</option>
									<option value="all">All (current year)</option>
								</select>
							</div>
							<div class="sidebar-filter-group">
								<label for="tx-sort-select" class="sidebar-label">Sort by</label
								>
								<select id="tx-sort-select" bind:value={txSort}>
									<option value="roster">Roster %</option>
									<option value="adp">ADP</option>
								</select>
							</div>
							<label class="sidebar-trade-toggle">
								<input
									type="checkbox"
									bind:checked={showTrades}
									onchange={() =>
										loadTransactions(Array.from(selectedLeagueIds))}
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
									{#each faPositions as pos}
										<option value={pos}>{pos === 'ALL' ? 'All' : pos}</option>
									{/each}
								</select>
							</div>
							<div class="sidebar-filter-group">
								<label for="fa-sort-select" class="sidebar-label">Sort by</label
								>
								<select id="fa-sort-select" bind:value={faSort}>
									<option value="roster">Roster %</option>
									<option value="adp">ADP</option>
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

		<button
			type="button"
			class="mobile-backdrop"
			class:open={mobileFilterOpen}
			aria-label="Close filters"
			tabindex="-1"
			onclick={toggleMobileFilter}
		></button>

		<main class="content">
			{#if error}
				<div class="error">{error}</div>
			{/if}

			{#if selectedLeagueIds.size > 0}
				<div class="tab-navigation">
					<button
						class="tab-button"
						class:active={activeTab === 'transactions'}
						onclick={() => {
							activeTab = 'transactions';
							error = null;
							loadTransactions(Array.from(selectedLeagueIds));
						}}
					>
						Transactions
					</button>
					<button
						class="tab-button"
						class:active={activeTab === 'waivers'}
						onclick={() => {
							activeTab = 'waivers';
							error = null;
							loadPendingWaivers(Array.from(selectedLeagueIds));
						}}
					>
						Pending Waivers
						{#if pendingWaivers.length > 0}
							<span class="tab-count">{pendingWaivers.length}</span>
						{/if}
					</button>
					<button
						class="tab-button"
						class:active={activeTab === 'freeAgents'}
						onclick={() => {
							activeTab = 'freeAgents';
							error = null;
							loadFreeAgents(Array.from(selectedLeagueIds));
						}}
					>
						Free Agents
					</button>
					{#if activeTab === 'waivers' && !waiverLoading && pendingWaivers.length > 0}
						<button
							class="tab-refresh-btn"
							onclick={() => loadPendingWaivers(Array.from(selectedLeagueIds))}
						>
							Refresh
						</button>
					{/if}
				</div>

				{#if activeTab === 'transactions'}
					<div class="mobile-toolbar">
						<button class="mobile-filters-btn" onclick={toggleMobileFilter}>
							<span class="mobile-filters-icon">☰</span>
							<span class="mobile-filters-label">Filters</span>
							{#if selectedLeagueIds.size !== leagues.length}
								<span class="mobile-filters-count"
									>{selectedLeagueIds.size}/{leagues.length}</span
								>
							{/if}
						</button>
						<div class="mobile-toolbar-spacer"></div>
						<select
							class="mobile-toolbar-select"
							bind:value={selectedDays}
							onchange={() => loadTransactions(Array.from(selectedLeagueIds))}
						>
							<option value="1">1 day</option>
							<option value="7">7 days</option>
							<option value="14">14 days</option>
							<option value="30">30 days</option>
							<option value="all">All</option>
						</select>
						<select
							class="mobile-toolbar-select"
							bind:value={txSort}
							aria-label="Sort transactions"
						>
							<option value="roster">Roster %</option>
							<option value="adp">ADP</option>
						</select>
						<label class="mobile-toolbar-trades">
							<input
								type="checkbox"
								bind:checked={showTrades}
								onchange={() => loadTransactions(Array.from(selectedLeagueIds))}
							/>
							Trades
						</label>
					</div>
					{#if loading}
						<div class="loading">Loading transactions...</div>
					{:else if transactions.length > 0}
						<div class="transactions-wrapper">
							<div class="transactions-list">
								{#each sortedTransactions as transaction, i (`${transaction.id ?? i}-${transaction.week ?? i}-${transaction.type ?? i}`)}
									<div class="transaction-card" data-type={transaction.type}>
										<div class="transaction-header">
											<span class="transaction-type">{transaction.type}</span>
											<a
												href={`https://www.myfantasyleague.com/${year}/home/${transaction.leagueId}`}
												target="_blank"
												rel="noopener noreferrer"
												class="league-tag-link"
											>
												<span class="league-tag">{transaction.leagueName}</span>
											</a>
										</div>
										{#if transaction.type === 'Trade' && transaction.tradeGives && transaction.tradeReceives}
											<div class="trade-header">
												<span class="trade-col"
													>{transaction.franchiseName}</span
												>
												<span class="trade-col"
													>{transaction.tradePartnerName}</span
												>
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
																		onSelect={openProfile}
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
																		onSelect={openProfile}
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
													<span class="franchise-name"
														>{transaction.franchiseName}</span
													>
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
																		onSelect={openProfile}
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
																		onSelect={openProfile}
																	/>
																{/each}
															</div>
														{:else}
															None
														{/if}
													</span>
												</div>
											</div>
											{#if transaction.bid}<span class="tx-bid"
													>Bid: ${transaction.bid}</span
												>{/if}
										{/if}
										<div class="tx-timestamp">{transaction.formattedTime}</div>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<div class="no-data">
							No transactions found — try expanding the timeframe or selecting
							more leagues
						</div>
					{/if}
				{:else if activeTab === 'waivers'}
					{#if waiverLoading}
						<div class="loading">Loading pending waivers...</div>
					{:else if pendingWaivers.length > 0}
						<div class="waivers-list">
							{#each pendingWaivers as waiver, i (`${waiver.leagueId}-${i}`)}
								<div class="waiver-card">
									<div class="waiver-header">
										<span class="waiver-type">Pending Waiver</span>
										<a
											href={`https://www.myfantasyleague.com/${year}/home/${waiver.leagueId}`}
											target="_blank"
											rel="noopener noreferrer"
											class="league-tag-link"
										>
											<span class="league-tag">{waiver.leagueName}</span>
										</a>
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
																	adp={playerCache.get(claim.addedPlayer.id)
																		?.adp}
																	onSelect={openProfile}
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
																	adp={playerCache.get(claim.droppedPlayer.id)
																		?.adp}
																	onSelect={openProfile}
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
												<span class="comments-text"
													>{waiver.commentsFormatted}</span
												>
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="no-data">
							No pending waivers found — try selecting more leagues
						</div>
					{/if}
				{:else if activeTab === 'freeAgents'}
					<div class="mobile-toolbar">
						<select class="mobile-toolbar-select" bind:value={faPosition}>
							{#each faPositions as pos}
								<option value={pos}>{pos === 'ALL' ? 'All' : pos}</option>
							{/each}
						</select>
						<input
							class="fa-mobile-search"
							type="text"
							placeholder="Search..."
							bind:value={faSearch}
						/>
					</div>
					{#if freeAgentLoading}
						<div class="loading">Loading free agents...</div>
					{:else if filteredFreeAgents.length > 0}
						<div class="fa-grid">
							{#each filteredFreeAgents as fa (fa.id)}
								<div
									class="fa-card"
									class:locked={fa.locked}
									role="button"
									tabindex="0"
									aria-label={`View profile for ${fa.name}`}
									onclick={() =>
										openProfile({
											id: fa.id,
											name: fa.name,
											position: fa.position,
											team: fa.team,
											rosterPct: fa.rosterPct,
											availableIn: fa.availableIn
										})}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											openProfile({
												id: fa.id,
												name: fa.name,
												position: fa.position,
												team: fa.team,
												rosterPct: fa.rosterPct,
												availableIn: fa.availableIn
											});
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
											<span class="roster-badge"
												>{fa.rosterPct.toFixed(1)}%</span
											>
										{/if}
										{#if playerCache.get(fa.id)?.adp}
											<span class="adp-badge"
												>ADP {playerCache.get(fa.id)?.adp}</span
											>
										{/if}
										{#if fa.locked}
											<span class="fa-lock">Locked</span>
										{/if}
										{#if (fa.availableIn?.length ?? 0) < selectedCount}
											<button
												type="button"
												class="fa-avail"
												onmouseenter={(e) =>
													showAvailTooltip(e, fa.availableIn ?? [])}
												onmouseleave={hideAvailTooltip}
												onclick={(e) => {
													e.stopPropagation();
													if (
														availTooltip &&
														availTooltip.leagues === fa.availableIn
													) {
														hideAvailTooltip();
													} else {
														showAvailTooltip(e, fa.availableIn ?? []);
													}
												}}
											>
												FA {fa.availableIn?.length ?? 0}/{selectedCount}
											</button>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{:else if freeAgents.length === 0}
						<div class="no-data">
							No free agents found — try selecting more leagues
						</div>
					{:else}
						<div class="no-data">No free agents match your filters</div>
					{/if}
				{/if}
			{:else}
				<div class="no-data">
					Select at least one league to view transactions
				</div>
			{/if}
		</main>
	</div>

	{#if availTooltip}
		<div
			class="fa-tooltip"
			style={`left:${availTooltip.x}px;top:${availTooltip.y}px`}
			role="tooltip"
		>
			<span class="fa-tooltip-title">Available in</span>
			<ul class="fa-tooltip-list">
				{#each availTooltip.leagues as lid}
					<li>{leagueName(lid)}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<PlayerProfileModal player={profilePlayer} onclose={closeProfile} {year} />
</div>

<style>
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
	}

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

	.github-stars img {
		height: 20px;
		width: auto;
	}

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

	.login-form button,
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

	.login-form button:hover,
	.login-btn:hover {
		transform: translate(-1px, -1px);
		box-shadow: var(--card-shadow);
		background: var(--highlight);
		color: var(--on-highlight);
	}

	.login-form button:active,
	.login-btn:active {
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

	.main-content {
		display: flex;
		flex: 1;
		min-height: 0;
	}

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

	.no-data {
		color: var(--text-secondary);
		text-align: center;
		padding: 2rem 1rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-style: normal;
	}

	.content {
		flex: 1;
		padding: 2rem;
		background: var(--bg-primary);
		overflow-y: auto;
		height: calc(100vh - 65px);
	}

	.header-mobile-controls {
		display: none;
	}

	.auth-row-mobile {
		display: none;
	}

	.error {
		background: var(--error-bg);
		color: var(--error-text);
		padding: 0.75rem 1rem;
		border: 2px solid var(--error-border);
		border-radius: 0;
		margin-bottom: 1rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		box-shadow: var(--shadow-sm);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		animation: slideIn 0.2s ease;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.error::before {
		content: '⚠';
		font-weight: bold;
		font-size: 1.2rem;
	}

	.loading {
		color: var(--text-secondary);
		text-align: center;
		padding: 3rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.loading::after {
		content: '';
		display: inline-block;
		width: 20px;
		height: 20px;
		border: 3px solid var(--text-primary);
		border-top-color: transparent;
		margin-left: 0.5rem;
		animation: spin 0.8s linear infinite;
		vertical-align: middle;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
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

	:global(.roster-badge) {
		font-size: var(--badge-font-size);
		font-weight: var(--badge-font-weight);
		color: var(--text-primary);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 0;
		padding: var(--badge-padding);
		white-space: nowrap;
		text-transform: uppercase;
		letter-spacing: var(--badge-letter-spacing);
	}

	:global(.adp-badge) {
		font-size: var(--badge-font-size);
		font-weight: var(--badge-font-weight);
		color: var(--text-primary);
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 0;
		padding: var(--badge-padding);
		white-space: nowrap;
		text-transform: uppercase;
		letter-spacing: var(--badge-letter-spacing);
	}

	.transactions-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.transactions-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

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

	.league-tag {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--text-primary);
		padding: 0.15rem 0.4rem;
		border: 1px solid var(--border);
		border-radius: 0;
		margin: 0 0.5rem;
		background: var(--bg-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		white-space: nowrap;
	}

	.league-tag-link {
		text-decoration: none;
		color: inherit;
	}

	.league-tag-link:hover .league-tag {
		background: var(--text-primary);
		color: var(--bg-secondary);
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

	:global(.position-badge) {
		font-size: var(--badge-font-size);
		font-weight: var(--badge-font-weight);
		padding: var(--badge-padding);
		border-radius: 0;
		text-transform: uppercase;
		letter-spacing: var(--badge-letter-spacing);
		flex-shrink: 0;
		border: 1px solid var(--border);
	}

	:global(.position-badge[data-position='QB']) {
		background: var(--pos-qb-bg);
		color: var(--pos-qb-text);
	}

	:global(.position-badge[data-position='RB']) {
		background: var(--pos-rb-bg);
		color: var(--pos-rb-text);
	}

	:global(.position-badge[data-position='WR']) {
		background: var(--pos-wr-bg);
		color: var(--pos-wr-text);
	}

	:global(.position-badge[data-position='TE']) {
		background: var(--pos-te-bg);
		color: var(--pos-te-text);
	}

	:global(.position-badge[data-position='K']) {
		background: var(--pos-k-bg);
		color: var(--pos-k-text);
	}

	:global(.position-badge[data-position='DT']) {
		background: var(--pos-dt-bg);
		color: var(--pos-dt-text);
	}

	:global(.position-badge[data-position='DE']) {
		background: var(--pos-de-bg);
		color: var(--pos-de-text);
	}

	:global(.position-badge[data-position='LB']) {
		background: var(--pos-lb-bg);
		color: var(--pos-lb-text);
	}

	:global(.position-badge[data-position='CB']) {
		background: var(--pos-cb-bg);
		color: var(--pos-cb-text);
	}

	:global(.position-badge[data-position='S']) {
		background: var(--pos-s-bg);
		color: var(--pos-s-text);
	}

	:global(.position-badge[data-position='DST']),
	:global(.position-badge[data-position='DEF']),
	:global(.position-badge[data-position='DFL']) {
		background: var(--pos-dst-bg);
		color: var(--pos-dst-text);
	}

	:global(.position-badge[data-position='UNK']) {
		background: var(--pos-unk-bg);
		color: var(--pos-unk-text);
	}

	:global(.position-badge[data-position='PICK']) {
		background: var(--pos-pick-bg);
		color: var(--pos-pick-text);
	}

	:global(.position-badge[data-position='FAAB']) {
		background: var(--pos-faab-bg);
		color: var(--pos-faab-text);
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

	.mobile-toolbar {
		display: none;
	}

	.mobile-backdrop {
		display: none;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
	}

	.sidebar-header {
		display: none;
	}

	.sidebar-close {
		display: none;
	}

	@media (max-width: 768px) {
		.main-content {
			flex-direction: column;
			height: calc(100vh - 65px);
		}

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

		.mobile-backdrop {
			display: none;
			position: fixed;
			inset: 0;
			background: rgba(17, 17, 17, 0.6);
			z-index: 100;
		}

		.mobile-backdrop.open {
			display: block;
		}

		.mobile-toolbar {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin-bottom: 0.75rem;
			padding: 0.5rem;
			background: var(--bg-secondary);
			border: 2px solid var(--border);
			border-radius: 0;
			box-shadow: var(--shadow-sm);
		}

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

		.mobile-toolbar-select {
			flex: 0 1 auto;
			min-width: 0;
			max-width: 7rem;
			padding: 0.3rem 0.4rem;
			background: var(--bg-secondary);
			color: var(--text-primary);
			border: 2px solid var(--border);
			border-radius: 0;
			font-size: 0.8rem;
			font-weight: 700;
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

		.login-form {
			flex-wrap: wrap;
			justify-content: center;
		}

		.content {
			height: 100%;
			min-height: 0;
			overflow-y: auto;
			flex: 1;
		}

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

	.waivers-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

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

	.fa-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.75rem;
	}

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

	.fa-tooltip {
		position: fixed;
		z-index: 200;
		min-width: 180px;
		max-width: 280px;
		background: var(--tooltip-bg);
		color: var(--tooltip-text);
		border: 2px solid var(--border);
		box-shadow: var(--shadow-sm);
		padding: 0.5rem;
		pointer-events: none;
	}

	.fa-tooltip-title {
		display: block;
		font-size: 0.6rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--tooltip-title);
		margin-bottom: 0.35rem;
	}

	.fa-tooltip-list {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 200px;
		overflow-y: auto;
	}

	.fa-tooltip-list li {
		font-size: 0.8rem;
		font-weight: 700;
		padding: 0.15rem 0;
		border-bottom: 1px solid var(--tooltip-sep);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.fa-tooltip-list li:last-child {
		border-bottom: none;
	}

	.fa-mobile-search {
		flex: 1;
		min-width: 0;
		padding: 0.3rem 0.4rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 2px solid var(--border);
		border-radius: 0;
		font-size: 0.8rem;
		font-weight: 700;
	}

	.fa-mobile-search:focus {
		outline: none;
		box-shadow: var(--shadow-sm);
	}

	.fa-mobile-search::placeholder {
		color: var(--text-muted);
		text-transform: uppercase;
		font-weight: 700;
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
