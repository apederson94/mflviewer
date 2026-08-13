<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import type { MFLTransaction, MFLPendingWaiver, Player, Tab } from '$lib';
	import type { DaysOption, PositionOption, SortOption } from '$lib';
	import { fetchJson } from '$lib/fetchJson';
	import Header from '$lib/components/Header.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TabNavigation from '$lib/components/TabNavigation.svelte';
	import TransactionsToolbar from '$lib/components/TransactionsToolbar.svelte';
	import FreeAgentsToolbar from '$lib/components/FreeAgentsToolbar.svelte';
	import TransactionCard from '$lib/components/TransactionCard.svelte';
	import WaiverCard from '$lib/components/WaiverCard.svelte';
	import FreeAgentCard from '$lib/components/FreeAgentCard.svelte';
	import AvailTooltip from '$lib/components/AvailTooltip.svelte';
	import PlayerProfileModal from '$lib/PlayerProfileModal.svelte';

	let { data }: { data: PageData } = $props();

	const leagues = $derived(data.leagues ?? []);
	const playerCache = $derived(new Map(data.players || []));
	const year = $derived(data.year);
	const week = $derived(data.week);
	const loggedIn = $derived(data.loggedIn);
	const pageError = $derived(data.error);

	// leagues is static server data; seed the selection from the initial value
	// svelte-ignore state_referenced_locally
	let selectedLeagueIds = $state(
		new Set<string>(leagues?.map((l) => l.id) ?? [])
	);
	let transactions = $state<MFLTransaction[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let formLoading = $state(false);

	let selectedDays = $state<DaysOption>('1');
	let showTrades = $state(false);
	let txSort = $state<SortOption>('roster');
	let mobileFilterOpen = $state(false);
	let leagueSearch = $state('');
	let activeTab = $state<Tab>('transactions');
	let pendingWaivers = $state<MFLPendingWaiver[]>([]);
	let waiverLoading = $state(false);
	let freeAgents = $state<Player[]>([]);
	let freeAgentLoading = $state(false);
	let faPosition = $state<PositionOption>('ALL');
	let faSearch = $state('');
	let hideLocked = $state(false);
	let faSort = $state<SortOption>('roster');

	let profilePlayer = $state<Player | null>(null);

	function openProfile(player: Player) {
		profilePlayer = player;
	}

	function closeProfile() {
		profilePlayer = null;
	}

	let selectedCount = $derived(selectedLeagueIds.size);

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

	function handleSelectionChange(ids: string[]) {
		selectedLeagueIds = new Set(ids);
		reloadForTab(ids);
	}

	function reloadTransactions() {
		loadTransactions(Array.from(selectedLeagueIds));
	}

	function createTabLoader<TResponse, TList>(config: {
		buildUrl: (leagueIds: string[]) => string;
		extract: (data: TResponse) => TList[];
		setList: (list: TList[]) => void;
		setLoading: (loading: boolean) => void;
	}): (leagueIds: string[]) => Promise<void> {
		let controller: AbortController | null = null;

		return async function load(leagueIds: string[]) {
			controller?.abort();
			controller = null;
			if (leagueIds.length === 0) {
				config.setList([]);
				return;
			}
			const ctrl = new AbortController();
			controller = ctrl;
			config.setLoading(true);
			error = null;
			try {
				const data = await fetchJson<TResponse>(
					config.buildUrl(leagueIds),
					ctrl.signal
				);
				if (ctrl.signal.aborted) return;
				config.setList(config.extract(data));
			} catch (err) {
				if (ctrl.signal.aborted) return;
				error = err instanceof Error ? err.message : 'Failed to load data';
				config.setList([]);
			} finally {
				if (!ctrl.signal.aborted) config.setLoading(false);
			}
		};
	}

	const loadTransactions = createTabLoader<
		{ transactions: MFLTransaction[] },
		MFLTransaction
	>({
		buildUrl: (leagueIds) =>
			`/api/mfl?type=transactions&league=${leagueIds.join(',')}&days=${selectedDays}&includeTrades=${showTrades}`,
		extract: (data) => data.transactions || [],
		setList: (list) => (transactions = list),
		setLoading: (v) => (loading = v)
	});

	const loadPendingWaivers = createTabLoader<
		{ pendingWaivers: MFLPendingWaiver[] },
		MFLPendingWaiver
	>({
		buildUrl: (leagueIds) =>
			`/api/mfl?type=pendingWaivers&league=${leagueIds.join(',')}`,
		extract: (data) => data.pendingWaivers || [],
		setList: (list) => (pendingWaivers = list),
		setLoading: (v) => (waiverLoading = v)
	});

	const loadFreeAgents = createTabLoader<{ freeAgents: Player[] }, Player>({
		buildUrl: (leagueIds) =>
			`/api/mfl?type=freeAgents&league=${leagueIds.join(',')}`,
		extract: (data) => data.freeAgents || [],
		setList: (list) => (freeAgents = list),
		setLoading: (v) => (freeAgentLoading = v)
	});

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

	function toggleAvailTooltip(e: MouseEvent, leagues: string[]) {
		if (availTooltip && availTooltip.leagues === leagues) {
			hideAvailTooltip();
		} else {
			showAvailTooltip(e, leagues);
		}
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

	async function handleLogin(username: string, password: string) {
		if (!username.trim() || !password.trim()) {
			error = 'Please enter username and password';
			return;
		}

		formLoading = true;
		error = null;

		try {
			const formData = new FormData();
			formData.append('username', username);
			formData.append('password', password);

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

	function handleTabSelect(tab: Tab) {
		activeTab = tab;
		error = null;
		if (tab === 'transactions') {
			loadTransactions(Array.from(selectedLeagueIds));
		} else if (tab === 'waivers') {
			loadPendingWaivers(Array.from(selectedLeagueIds));
		} else {
			loadFreeAgents(Array.from(selectedLeagueIds));
		}
	}

	onMount(() => {
		if (loggedIn && selectedLeagueIds.size > 0) {
			reloadForTab(Array.from(selectedLeagueIds));
		}
	});
</script>

<svelte:head>
	<title>MFL Transaction Viewer</title>
</svelte:head>

<div class="app">
	<Header
		{week}
		isLoggedIn={loggedIn}
		{theme}
		{formLoading}
		onToggleTheme={toggleTheme}
		onLogin={handleLogin}
		onLogout={handleLogout}
	/>

	<div class="main-content">
		<Sidebar
			open={mobileFilterOpen}
			{leagues}
			{selectedLeagueIds}
			isLoggedIn={loggedIn}
			dataError={pageError}
			{activeTab}
			onClose={toggleMobileFilter}
			onSelectionChange={handleSelectionChange}
			onDaysChange={reloadTransactions}
			onShowTradesChange={reloadTransactions}
			bind:leagueSearch
			bind:selectedDays
			bind:txSort
			bind:showTrades
			bind:faSearch
			bind:faPosition
			bind:faSort
			bind:hideLocked
		/>

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
				<TabNavigation
					{activeTab}
					pendingWaiverCount={pendingWaivers.length}
					{waiverLoading}
					onselect={handleTabSelect}
					onrefresh={() => loadPendingWaivers(Array.from(selectedLeagueIds))}
				/>

				{#if activeTab === 'transactions'}
					<TransactionsToolbar
						bind:selectedDays
						bind:txSort
						bind:showTrades
						selectedCount={selectedLeagueIds.size}
						totalCount={leagues.length}
						onFilters={toggleMobileFilter}
						onDaysChange={reloadTransactions}
						onShowTradesChange={reloadTransactions}
					/>
					{#if loading}
						<div class="loading">Loading transactions...</div>
					{:else if sortedTransactions.length > 0}
						<div class="transactions-wrapper">
							<div class="transactions-list">
								{#each sortedTransactions as transaction, i (`${transaction.leagueId ?? ''}-${transaction.id ?? i}-${transaction.week ?? i}-${transaction.type ?? i}`)}
									<TransactionCard
										{transaction}
										{year}
										{playerCache}
										onSelect={openProfile}
									/>
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
								<WaiverCard
									{waiver}
									{year}
									{playerCache}
									onSelect={openProfile}
								/>
							{/each}
						</div>
					{:else}
						<div class="no-data">
							No pending waivers found — try selecting more leagues
						</div>
					{/if}
				{:else if activeTab === 'freeAgents'}
					<FreeAgentsToolbar bind:faPosition bind:faSearch />
					{#if freeAgentLoading}
						<div class="loading">Loading free agents...</div>
					{:else if filteredFreeAgents.length > 0}
						<div class="fa-grid">
							{#each filteredFreeAgents as fa (fa.id)}
								<FreeAgentCard
									{fa}
									adp={playerCache.get(fa.id)?.adp}
									{selectedCount}
									onSelect={openProfile}
									onAvailEnter={showAvailTooltip}
									onAvailLeave={hideAvailTooltip}
									onAvailToggle={toggleAvailTooltip}
								/>
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

	<AvailTooltip tooltip={availTooltip} {leagueName} />
	<PlayerProfileModal player={profilePlayer} onclose={closeProfile} {year} />
</div>

<style>
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary);
	}

	.main-content {
		display: flex;
		flex: 1;
		min-height: 0;
	}

	.content {
		flex: 1;
		padding: 2rem;
		background: var(--bg-primary);
		overflow-y: auto;
		height: calc(100vh - 65px);
	}

	.mobile-backdrop {
		display: none;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
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

	.waivers-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.fa-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.75rem;
	}

	@media (max-width: 768px) {
		.main-content {
			flex-direction: column;
			height: calc(100vh - 65px);
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

		.content {
			height: 100%;
			min-height: 0;
			overflow-y: auto;
			flex: 1;
		}
	}
</style>
