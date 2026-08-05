<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import type { StoredLeague, MFLTransaction, MFLPendingWaiver, MFLFreeAgent } from '$lib';

  let { data }: { data: PageData } = $props();

  let leagues = $state(data.leagues ?? []);
  let selectedLeagueIds = $state(new Set<string>(data.leagues?.map(l => l.id) ?? []));
  let transactions = $state<MFLTransaction[]>([]);
  let playerCache = $state(new Map((data.players || []) as [string, { name: string; position: string; rosterPct?: number }][]));
  let loading = $state(false);
  let error = $state<string | null>(null);
  let loginUsername = $state('');
  let loginPassword = $state('');
  let formLoading = $state(false);

  let isLoggedIn = $derived(data.loggedIn);
  let year = $state(data.year);
  let selectedDays = $state('1');
  let showTrades = $state(false);
  let mobileFilterOpen = $state(false);
  let leagueSearch = $state('');
  let activeTab = $state<'transactions' | 'waivers' | 'freeAgents'>('transactions');
  let pendingWaivers = $state<MFLPendingWaiver[]>([]);
  let waiverLoading = $state(false);
  let freeAgents = $state<MFLFreeAgent[]>([]);
  let freeAgentLoading = $state(false);
  let faPosition = $state('ALL');
  let faSearch = $state('');
  let hideLocked = $state(false);
  let loadId = 0;
  let waiverLoadId = 0;
  let freeAgentLoadId = 0;

  let filteredLeagues = $derived(
    leagueSearch
      ? leagues.filter(l =>
          l.name.toLowerCase().includes(leagueSearch.toLowerCase()) ||
          l.id.includes(leagueSearch)
        )
      : leagues
  );

  let filteredAllSelected = $derived(
    filteredLeagues.length > 0 && filteredLeagues.every(l => selectedLeagueIds.has(l.id))
  );

  let selectedCount = $derived(selectedLeagueIds.size);

  let totalLeagues = $derived(selectedLeagueIds.size);

  const faPositions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST', 'DT', 'DE', 'LB', 'CB', 'S'];

  const NFL_TEAM_COLORS: Record<string, string> = {
    ARI: '#97233F', AZN: '#97233F',
    ATL: '#A71930',
    BAL: '#241773',
    BUF: '#00338D',
    CAR: '#0085CA',
    CHI: '#0B162A',
    CIN: '#FB4F14',
    CLE: '#311D00',
    DAL: '#003594',
    DEN: '#002244',
    DET: '#0076B6',
    GB: '#203731', GBP: '#203731',
    HOU: '#03202F',
    IND: '#002C5F',
    JAC: '#006778', JAX: '#006778',
    KC: '#E31837', KCC: '#E31837',
    LAC: '#0080C6',
    LAR: '#003594',
    LV: '#A5ACAF', LVR: '#A5ACAF',
    MIA: '#008E97',
    MIN: '#4F2683',
    NE: '#002244', NEP: '#002244',
    NO: '#D3BC8D', NOS: '#D3BC8D',
    NYG: '#0B2265',
    NYJ: '#125740',
    PHI: '#004C54',
    PIT: '#FFB612',
    SD: '#002244',
    SF: '#AA0000', SFO: '#AA0000',
    SEA: '#002244',
    STL: '#002244',
    TB: '#D50A0A', TBB: '#D50A0A',
    TEN: '#0C2340',
    WAS: '#773141', WSH: '#773141'
  };

  function getTeamColor(team: string): string {
    return NFL_TEAM_COLORS[team.toUpperCase()] || '';
  }

  function contrastText(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#000000' : '#ffffff';
  }

  let filteredFreeAgents = $derived(
    freeAgents.filter(fa => {
      const position = fa.position ?? 'UNK';
      if (faPosition === 'DST') {
        if (!['DST', 'DEF', 'DFL'].includes(position)) return false;
      } else if (faPosition !== 'ALL' && position !== faPosition) {
        return false;
      }
      if (faSearch && !fa.name.toLowerCase().includes(faSearch.toLowerCase())) return false;
      if (hideLocked && fa.locked) return false;
      return true;
    })
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
      const res = await fetch(`/api/mfl?type=transactions&league=${leagueIds.join(',')}&days=${selectedDays}&includeTrades=${showTrades}`);
      if (thisLoad !== loadId) return;
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      transactions = data.transactions || [];
    } catch (err) {
      if (thisLoad !== loadId) return;
      error = err instanceof Error ? err.message : 'Failed to load transactions';
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
      const res = await fetch(`/api/mfl?type=pendingWaivers&league=${leagueIds.join(',')}`);
      if (thisLoad !== waiverLoadId) return;
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      pendingWaivers = data.pendingWaivers || [];
    } catch (err) {
      if (thisLoad !== waiverLoadId) return;
      error = err instanceof Error ? err.message : 'Failed to load pending waivers';
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
      const res = await fetch(`/api/mfl?type=freeAgents&league=${leagueIds.join(',')}`);
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

  function getPlayerName(playerId: string): string {
    if (!playerCache) return `Unknown (${playerId})`;
    const player = playerCache.get(playerId);
    return player?.name || `Unknown (${playerId})`;
  }

  function getPlayerPosition(playerId: string): string {
    if (!playerCache) return 'UNK';
    const player = playerCache.get(playerId);
    return player?.position || 'UNK';
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
              <button type="submit" disabled={formLoading}>
                Login
              </button>
            </form>
          {/if}
      </div>
    </div>
    <div class="auth-row">
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
            <button type="submit" disabled={formLoading}>
              Login
            </button>
          </form>
        {/if}
    </div>
  </header>
  
  <div class="main-content">
    <aside class="sidebar" class:open={mobileFilterOpen}>
      <div class="sidebar-header">
        <button class="sidebar-close" onclick={toggleMobileFilter} aria-label="Close filters">✕</button>
      </div>
      <div class="sidebar-content">
        <h2>Filters</h2>
        
        {#if data.error}
          <p class="error">{data.error}</p>
        {/if}
        
        {#if !isLoggedIn}
          <p class="login-prompt">Log in to view your leagues</p>
        {/if}
        
        {#if isLoggedIn}
          <input
            class="league-search"
            type="text"
            placeholder="Search leagues..."
            bind:value={leagueSearch}
          />
          <div class="filter-actions">
            <button class="filter-btn" onclick={handleSelectAll} disabled={filteredAllSelected}>All</button>
            <button class="filter-btn" onclick={handleSelectNone} disabled={filteredLeagues.every(l => !selectedLeagueIds.has(l.id))}>None</button>
          </div>
          <div class="selection-count">{selectedCount} of {leagues.length} selected</div>
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
          <div class="sidebar-divider"></div>
          {#if activeTab === 'transactions'}
            <div class="sidebar-timeframe">
              <label for="days-select-sidebar" class="sidebar-label">Timeframe</label>
              <select id="days-select-sidebar" bind:value={selectedDays} onchange={() => loadTransactions(Array.from(selectedLeagueIds))}>
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="all">All (current year)</option>
              </select>
            </div>
            <label class="sidebar-trade-toggle">
              <input type="checkbox" bind:checked={showTrades} onchange={() => loadTransactions(Array.from(selectedLeagueIds))} />
              Show Trades
            </label>
          {/if}
          {#if activeTab === 'freeAgents'}
            <div class="sidebar-filter-group">
              <label for="fa-position-select" class="sidebar-label">Position</label>
              <select id="fa-position-select" bind:value={faPosition}>
                {#each faPositions as pos}
                  <option value={pos}>{pos === 'ALL' ? 'All' : pos}</option>
                {/each}
              </select>
            </div>
            <input
              class="fa-search"
              type="text"
              placeholder="Search players..."
              bind:value={faSearch}
            />
            <label class="sidebar-trade-toggle">
              <input type="checkbox" bind:checked={hideLocked} />
              Hide locked
            </label>
          {/if}
        {/if}
        
        {#if leagues.length === 0 && isLoggedIn && !data.error}
          <p class="no-data">No leagues found</p>
        {/if}
        
        {#if !isLoggedIn}
          <p class="no-data">Log in to view your leagues</p>
        {/if}
      </div>
      
      <a href="https://github.com/apederson94/mflviewer" target="_blank" rel="noopener noreferrer" class="github-stars">
        <img src="https://img.shields.io/github/stars/apederson94/mflviewer?style=social" alt="GitHub Stars">
      </a>
    </aside>
    
    <div class="mobile-backdrop" class:open={mobileFilterOpen} onclick={toggleMobileFilter}></div>
    
    <main class="content">
      {#if error}
        <div class="error">{error}</div>
      {/if}
      
      {#if selectedLeagueIds.size > 0}
        <div class="tab-navigation">
          <button
            class="tab-button"
            class:active={activeTab === 'transactions'}
            onclick={() => { activeTab = 'transactions'; error = null; loadTransactions(Array.from(selectedLeagueIds)); }}
          >
            Transactions
          </button>
          <button
            class="tab-button"
            class:active={activeTab === 'waivers'}
            onclick={() => { activeTab = 'waivers'; error = null; loadPendingWaivers(Array.from(selectedLeagueIds)); }}
          >
            Pending Waivers
            {#if pendingWaivers.length > 0}
              <span class="tab-count">{pendingWaivers.length}</span>
            {/if}
          </button>
          <button
            class="tab-button"
            class:active={activeTab === 'freeAgents'}
            onclick={() => { activeTab = 'freeAgents'; error = null; loadFreeAgents(Array.from(selectedLeagueIds)); }}
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
                <span class="mobile-filters-count">{selectedLeagueIds.size}/{leagues.length}</span>
              {/if}
            </button>
            <div class="mobile-toolbar-spacer"></div>
            <select class="mobile-toolbar-select" bind:value={selectedDays} onchange={() => loadTransactions(Array.from(selectedLeagueIds))}>
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="all">All</option>
            </select>
            <label class="mobile-toolbar-trades">
              <input type="checkbox" bind:checked={showTrades} onchange={() => loadTransactions(Array.from(selectedLeagueIds))} />
              Trades
            </label>
          </div>
          {#if loading}
            <div class="loading">Loading transactions...</div>
          {:else if transactions.length > 0}
            <div class="transactions-wrapper">
              <div class="transactions-list">
              {#each transactions as transaction, i (`${transaction.id ?? i}-${transaction.week ?? i}-${transaction.type ?? i}`)}
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
                                <div class="player-item">
                                  {#if player.position}
                                    <span class="position-badge" data-position={player.position}>{player.position}</span>
                                  {/if}
                                  <span class="player-name">{player.name}</span>
                                  {#if player.rosterPct != null}<span class="roster-badge">{player.rosterPct.toFixed(1)}%</span>{/if}
                                </div>
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
                                <div class="player-item">
                                  {#if player.position}
                                    <span class="position-badge" data-position={player.position}>{player.position}</span>
                                  {/if}
                                  <span class="player-name">{player.name}</span>
                                  {#if player.rosterPct != null}<span class="roster-badge">{player.rosterPct.toFixed(1)}%</span>{/if}
                                </div>
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
                                <span class="player-item">
                                  {#if player.position}
                                    <span class="position-badge" data-position={player.position}>{player.position}</span>
                                  {/if}
                                  <span class="player-name">{player.name}</span>
                                  {#if player.rosterPct != null}<span class="roster-badge">{player.rosterPct.toFixed(1)}%</span>{/if}
                                </span>
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
                                <span class="player-item">
                                  {#if player.position}
                                    <span class="position-badge" data-position={player.position}>{player.position}</span>
                                  {/if}
                                  <span class="player-name">{player.name}</span>
                                  {#if player.rosterPct != null}<span class="roster-badge">{player.rosterPct.toFixed(1)}%</span>{/if}
                                </span>
                              {/each}
                            </div>
                          {:else}
                            None
                          {/if}
                        </span>
                      </div>
                    </div>
                    {#if transaction.bid}<span class="tx-bid">Bid: ${transaction.bid}</span>{/if}
                  {/if}
                  <div class="tx-timestamp">{transaction.formattedTime}</div>
                </div>
              {/each}
              </div>
            </div>
          {:else}
            <div class="no-data">
              No transactions found — try expanding the timeframe or selecting more leagues
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
                                <div class="player-item">
                                  {#if claim.addedPlayer.position}
                                    <span class="position-badge" data-position={claim.addedPlayer.position}>{claim.addedPlayer.position}</span>
                                  {/if}
                                  <span class="player-name">{claim.addedPlayer.name}</span>
                                  {#if claim.addedPlayer.rosterPct != null}
                                    <span class="roster-badge">{claim.addedPlayer.rosterPct.toFixed(1)}%</span>
                                  {/if}
                                </div>
                              {/if}
                              <span class="priority-bid">${claim.bid}</span>
                            </div>
                            <div class="priority-row">
                              <span class="priority-label">Drop</span>
                              {#if claim.droppedPlayer}
                                <div class="player-item">
                                  {#if claim.droppedPlayer.position}
                                    <span class="position-badge" data-position={claim.droppedPlayer.position}>{claim.droppedPlayer.position}</span>
                                  {/if}
                                  <span class="player-name">{claim.droppedPlayer.name}</span>
                                  {#if claim.droppedPlayer.rosterPct != null}
                                    <span class="roster-badge">{claim.droppedPlayer.rosterPct.toFixed(1)}%</span>
                                  {/if}
                                </div>
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
                <div class="fa-card" class:locked={fa.locked}>
                  <div class="fa-card-top">
                    {#if fa.position}
                      <span class="position-badge" data-position={fa.position}>{fa.position}</span>
                    {/if}
                    <span class="player-name">{fa.name}</span>
                  </div>
                  <div class="fa-card-meta">
                    {#if fa.team}
                      {@const teamColor = getTeamColor(fa.team)}
                      <span
                        class="fa-team"
                        style={teamColor ? `--team-bg:${teamColor};--team-text:${contrastText(teamColor)}` : ''}
                      >{fa.team}</span>
                    {/if}
                    {#if fa.rosterPct != null}
                      <span class="roster-badge">{fa.rosterPct.toFixed(1)}%</span>
                    {/if}
                    {#if fa.locked}
                      <span class="fa-lock">Locked</span>
                    {/if}
                    {#if fa.availableIn.length < totalLeagues}
                      <span class="fa-avail">FA {fa.availableIn.length}/{totalLeagues}</span>
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
            <div class="no-data">
              No free agents match your filters
            </div>
          {/if}
        {/if}
      {:else}
        <div class="no-data">
          Select at least one league to view transactions
        </div>
      {/if}
    </main>
  </div>
</div>

<style>
  :root {
    --bg-primary: #0f172a;
    --bg-secondary: #1e293b;
    --bg-card: #1e293b;
    --border: #334155;
    --accent: #22d3ee;
    --accent-hover: #06b6d4;
    --text-primary: #f1f5f9;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    --error-bg: #450a0a;
    --error-border: #ef4444;
    --error-text: #ef4444;

    --trade-color: #a78bfa;
    --waiver-color: #fb923c;
    --free-agent-color: #34d399;
    --franchise-color: #38bdf8;
    --system-color: #fbbf24;

    --card-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    --card-shadow-hover: 0 8px 30px rgba(0, 0, 0, 0.4);
    --glow-shadow: 0 0 20px rgba(34, 211, 238, 0.3);
  }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, var(--bg-primary) 0%, #0c1222 100%);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    background: linear-gradient(180deg, var(--bg-secondary) 0%, #172033 100%);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  
.title-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .title-row h1 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-primary);
    vertical-align: middle;
  }
  
  .title-row .week {
    margin-left: 0.5rem;
    font-size: 0.9rem;
    color: var(--accent);
    font-weight: 600;
    vertical-align: middle;
    background: rgba(34, 211, 238, 0.1);
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    box-shadow: var(--glow-shadow);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 15px rgba(34, 211, 238, 0.3); }
    50% { box-shadow: 0 0 25px rgba(34, 211, 238, 0.5); }
  }
  
  .title-row .github-stars {
    vertical-align: middle;
  }
  
  .title-row .github-stars img {
    height: 1.2rem;
  }
  
.auth-row {
    display: flex;
    align-items: center;
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
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: rgba(15, 23, 42, 0.8);
    color: var(--text-primary);
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }

  .login-form input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.1);
  }

  .login-form input::placeholder {
    color: var(--text-secondary);
  }

  .login-form button, .login-btn {
    padding: 0.5rem 1.5rem;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
    color: var(--bg-primary);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s ease;
    box-shadow: 0 2px 10px rgba(34, 211, 238, 0.3);
  }

  .login-form button:hover, .login-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(34, 211, 238, 0.4);
  }

  .login-form button:disabled {
    background: var(--text-muted);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .main-content {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .sidebar {
    width: 280px;
    min-width: 280px;
    background: linear-gradient(180deg, var(--bg-secondary) 0%, #151c2c 100%);
    border-right: 1px solid var(--border);
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
    border-top: 1px solid var(--border);
  }
 
  .sidebar h2 {
    margin: 0 0 1rem 0;
    font-size: 1.2rem;
    color: var(--text-primary);
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .login-prompt {
    color: var(--text-secondary);
    font-size: 0.9rem;
    text-align: center;
    padding: 1rem;
  }

  .league-filter-list {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 320px;
    overflow-y: auto;
  }

  .league-filter-list::-webkit-scrollbar {
    width: 6px;
  }

  .league-filter-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .league-filter-list::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
  }

  .league-filter-item {
    margin-bottom: 0.25rem;
  }

  .league-checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .league-checkbox-label:hover {
    background: rgba(51, 65, 85, 0.4);
  }

  .league-checkbox-label input[type="checkbox"] {
    accent-color: var(--accent);
    width: 1rem;
    height: 1rem;
    cursor: pointer;
    flex-shrink: 0;
  }

  .league-name {
    flex: 1;
    color: var(--text-primary);
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .league-id {
    color: var(--text-muted);
    font-size: 0.75rem;
    padding: 0.15rem 0.4rem;
    background: rgba(100, 116, 139, 0.2);
    border-radius: 4px;
    flex-shrink: 0;
  }

  .league-search {
    width: 100%;
    padding: 0.5rem;
    margin-bottom: 0.75rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.85rem;
    box-sizing: border-box;
  }

  .league-search:focus {
    outline: none;
    border-color: var(--accent);
  }

  .league-search::placeholder {
    color: var(--text-muted);
  }

  .selection-count {
    color: var(--text-muted);
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .filter-actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .filter-btn {
    flex: 1;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-btn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }

  .filter-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .no-data {
    color: var(--text-secondary);
    text-align: center;
    padding: 2rem 1rem;
    font-style: italic;
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
    background: linear-gradient(135deg, var(--error-bg) 0%, #2d0a0a 100%);
    color: var(--error-text);
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    border-left: 4px solid var(--error-text);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .error::before {
    content: "⚠";
    font-weight: bold;
    font-size: 1.2rem;
  }

  .loading {
    color: var(--text-secondary);
    text-align: center;
    padding: 3rem;
  }

  .loading::after {
    content: '';
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid var(--accent);
    border-top-color: transparent;
    border-radius: 50%;
    margin-left: 0.5rem;
    animation: spin 1s linear infinite;
    vertical-align: middle;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .sidebar-divider {
    height: 1px;
    background: var(--border);
    margin: 0.75rem 0;
  }

  .sidebar-timeframe {
    margin-bottom: 0.5rem;
  }

  .sidebar-label {
    display: block;
    color: var(--text-muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.35rem;
  }

  .sidebar-timeframe select {
    width: 100%;
    padding: 0.4rem 0.5rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .sidebar-timeframe select:focus {
    outline: none;
    border-color: var(--accent);
  }

  .sidebar-trade-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
    cursor: pointer;
    padding: 0.25rem 0;
  }

  .sidebar-trade-toggle input {
    cursor: pointer;
    accent-color: var(--accent);
  }

  .roster-badge {
    font-size: 0.7rem;
    color: var(--text-secondary);
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0.075rem 0.3rem;
    margin-left: 0.25rem;
    white-space: nowrap;
  }

  .transactions-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .transaction-card {
    background: linear-gradient(135deg, var(--bg-secondary) 0%, #1a2536 100%);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.5rem;
    overflow: hidden;
    box-shadow: var(--card-shadow);
    transition: all 0.2s ease;
    animation: fadeInUp 0.3s ease;
    position: relative;
    overflow: visible;
  }

  .transaction-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--accent);
    border-radius: 8px 0 0 8px;
  }

  .transaction-card[data-type="Trade"]::before {
    background: var(--trade-color);
  }

  .transaction-card[data-type="FA Pickup"]::before,
  .transaction-card[data-type="Free Agent"]::before,
  .transaction-card[data-type="Add/Drop"]::before {
    background: var(--free-agent-color);
  }

  .transaction-card[data-type="Waiver"]::before {
    background: var(--waiver-color);
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .transaction-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--card-shadow-hover);
    border-color: var(--text-muted);
  }

  .transaction-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--border);
  }

  .transaction-type {
    font-weight: 700;
    font-size: 0.75rem;
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .transaction-card[data-type="Trade"] .transaction-type {
    color: #c4b5fd;
    background: rgba(167, 139, 250, 0.15);
    box-shadow: 0 0 12px rgba(167, 139, 250, 0.3);
    border: 1px solid rgba(167, 139, 250, 0.3);
  }

  .transaction-card[data-type="FA Pickup"] .transaction-type,
  .transaction-card[data-type="Free Agent"] .transaction-type,
  .transaction-card[data-type="Add/Drop"] .transaction-type {
    color: #6ee7b7;
    background: rgba(52, 211, 153, 0.15);
    box-shadow: 0 0 12px rgba(52, 211, 153, 0.3);
    border: 1px solid rgba(52, 211, 153, 0.3);
  }

  .transaction-card[data-type="Waiver"] .transaction-type {
    color: var(--waiver-color);
    background: rgba(251, 146, 60, 0.15);
  }

  .transaction-card:not([data-type="Trade"]):not([data-type="FA Pickup"]):not([data-type="Free Agent"]):not([data-type="Add/Drop"]):not([data-type="Waiver"]) .transaction-type {
    color: var(--text-secondary);
  }

  .league-tag {
    font-size: 0.75rem;
    color: var(--text-muted);
    padding: 0.15rem 0.4rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    margin: 0 0.5rem;
  }

  .league-tag-link {
    text-decoration: none;
    color: inherit;
  }

  .league-tag-link:hover .league-tag {
    border-color: var(--accent);
    color: var(--accent);
  }

  .trade-header {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    font-weight: 600;
    font-size: 1rem;
    padding: 0.5rem 0;
    color: var(--text-primary);
  }

  .trade-col {
    text-align: left;
    color: var(--text-primary);
    font-weight: 700;
    font-size: 1rem;
  }

  .franchise-item {
    text-align: left;
  }

  .franchise-label {
    display: block;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    margin-bottom: 0.25rem;
  }

  .franchise-name {
    display: block;
    color: var(--text-primary);
    font-weight: 700;
    font-size: 1rem;
  }

  .trade-sides {
    display: flex;
    gap: 0.5rem;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .trade-side {
    flex: 1;
    min-width: 0;
    padding: 0.5rem;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 6px;
    word-break: break-word;
    border: 1px solid rgba(51, 65, 85, 0.5);
    transition: all 0.2s ease;
    text-align: left;
  }

  .trade-side:hover {
    border-color: var(--trade-color);
    background: rgba(167, 139, 250, 0.05);
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
    border-bottom: 1px solid var(--border);
    margin-bottom: 0.5rem;
  }

  .fa-sides {
    display: flex;
    gap: 0.5rem;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .fa-side {
    flex: 1;
    min-width: 0;
    padding: 0.5rem;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 6px;
    word-break: break-word;
    border: 1px solid rgba(51, 65, 85, 0.5);
    transition: all 0.2s ease;
    text-align: left;
  }

  .fa-side:first-child:hover {
    border-color: var(--free-agent-color);
    background: rgba(52, 211, 153, 0.05);
  }

  .fa-side:last-child:hover {
    border-color: #f87171;
    background: rgba(248, 113, 113, 0.05);
  }

  .fa-side-header {
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.25rem;
  }

  .fa-side:first-child .fa-side-header {
    color: var(--free-agent-color);
  }

  .fa-side:last-child .fa-side-header {
    color: #f87171;
  }

  .fa-side-content {
  }

  .player-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: flex-start;
    width: 100%;
  }

  .player-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    width: 100%;
  }

  .player-name {
    color: var(--text-primary);
    text-align: left;
  }

  .position-badge {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .position-badge[data-position="QB"] {
    background: rgba(167, 139, 250, 0.2);
    color: #a78bfa;
  }

  .position-badge[data-position="RB"] {
    background: rgba(52, 211, 153, 0.2);
    color: #34d399;
  }

  .position-badge[data-position="WR"] {
    background: rgba(249, 115, 22, 0.2);
    color: #f97316;
  }

  .position-badge[data-position="TE"] {
    background: rgba(96, 165, 250, 0.2);
    color: #60a5fa;
  }

  .position-badge[data-position="K"] {
    background: rgba(244, 114, 182, 0.2);
    color: #f472b6;
  }

  .position-badge[data-position="DT"] {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .position-badge[data-position="DE"] {
    background: rgba(249, 115, 22, 0.2);
    color: #f97316;
  }

  .position-badge[data-position="LB"] {
    background: rgba(99, 102, 241, 0.2);
    color: #6366f1;
  }

  .position-badge[data-position="CB"] {
    background: rgba(139, 92, 246, 0.2);
    color: #8b5cf6;
  }

  .position-badge[data-position="S"] {
    background: rgba(20, 184, 166, 0.2);
    color: #14b8a6;
  }

  .position-badge[data-position="DST"],
  .position-badge[data-position="DEF"],
  .position-badge[data-position="DFL"] {
    background: rgba(251, 191, 36, 0.25);
    color: #fbbf24;
  }

  .position-badge[data-position="UNK"] {
    background: rgba(100, 116, 139, 0.2);
    color: #94a3b8;
  }

  .position-badge[data-position="PICK"] {
    background: rgba(156, 163, 175, 0.25);
    color: #d1d5db;
    border: 1px solid rgba(156, 163, 175, 0.4);
  }

  .tx-content {
    padding: 0.25rem 0;
    font-size: 0.95rem;
  }

  .tx-franchise {
    font-weight: 600;
    display: block;
    padding: 0.25rem 0;
    color: var(--text-primary);
  }

  .tx-player {
    display: block;
    padding: 0.25rem 0;
    color: var(--text-secondary);
    transition: color 0.2s ease;
  }

  .transaction-card:hover .tx-player {
    color: var(--text-primary);
  }

  .tx-bid {
    color: var(--waiver-color);
    margin-left: 0.5rem;
    font-weight: 600;
  }

  .added-players {
    color: var(--free-agent-color);
    display: block;
  }

  .dropped-players {
    color: #f87171;
    display: block;
  }

  .player-list {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .badge {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge-added {
    background: rgba(52, 211, 153, 0.2);
    color: var(--free-agent-color);
  }

  .badge-dropped {
    background: rgba(248, 113, 113, 0.2);
    color: #f87171;
  }

  .player-names {
    color: var(--text-primary);
  }

  .tx-timestamp {
    color: var(--text-muted);
    font-size: 0.8rem;
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
      transition: transform 0.25s ease;
      height: 100vh;
      max-height: 100vh;
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
      border: 1px solid var(--border);
      border-radius: 6px;
      background: transparent;
      color: var(--text-secondary);
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .sidebar-close:hover {
      background: rgba(51, 65, 85, 0.5);
      color: var(--text-primary);
    }

    .mobile-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
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
      border: 1px solid var(--border);
      border-radius: 6px;
    }

    .mobile-filters-btn {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.35rem 0.6rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: transparent;
      color: var(--text-secondary);
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .mobile-filters-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .mobile-filters-icon {
      font-size: 1rem;
    }

    .mobile-filters-count {
      font-size: 0.7rem;
      color: var(--accent);
      background: rgba(34, 211, 238, 0.15);
      padding: 0.05rem 0.35rem;
      border-radius: 8px;
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
      background: var(--bg-primary);
      color: var(--text-primary);
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.8rem;
    }

    .mobile-toolbar-trades {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--text-secondary);
      font-size: 0.8rem;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .mobile-toolbar-trades input {
      accent-color: var(--accent);
      cursor: pointer;
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
    }

    .content {
      height: 100%;
      min-height: 0;
      overflow-y: auto;
      flex: 1;
    }

    .trade-header, .trade-sides {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }

    .transaction-card::before {
      width: 100%;
      height: 3px;
      border-radius: 12px 12px 0 0;
    }
  }

  .tab-navigation {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.35rem;
  }

  .tab-button {
    padding: 0.6rem 1rem;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    border-radius: 6px 6px 0 0;
    transition: all 0.2s ease;
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .tab-button:hover {
    color: var(--text-primary);
    background: rgba(51, 65, 85, 0.3);
  }

  .tab-button.active {
    color: var(--accent);
    background: rgba(34, 211, 238, 0.1);
  }

  .tab-button.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--accent);
    border-radius: 2px 2px 0 0;
  }

  .tab-count {
    font-size: 0.7rem;
    background: var(--waiver-color);
    color: var(--bg-primary);
    padding: 0.1rem 0.4rem;
    border-radius: 10px;
    font-weight: 700;
  }

  .tab-refresh-btn {
    margin-left: auto;
    padding: 0.3rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tab-refresh-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .waivers-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .waiver-card {
    background: linear-gradient(135deg, var(--bg-secondary) 0%, #1a2536 100%);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.75rem;
    box-shadow: var(--card-shadow);
    transition: all 0.2s ease;
    position: relative;
    animation: fadeInUp 0.3s ease;
  }

  .waiver-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--waiver-color);
    border-radius: 8px 0 0 8px;
  }

  .waiver-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--card-shadow-hover);
    border-color: var(--text-muted);
  }

  .waiver-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--border);
  }

  .waiver-type {
    font-weight: 700;
    font-size: 0.75rem;
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--waiver-color);
    background: rgba(251, 146, 60, 0.15);
    box-shadow: 0 0 12px rgba(251, 146, 60, 0.3);
    border: 1px solid rgba(251, 146, 60, 0.3);
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
    height: 1px;
    background: var(--border);
    margin: 0.5rem 0;
  }

  .waiver-priority {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .priority-badge {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
    background: rgba(251, 146, 60, 0.15);
    color: var(--waiver-color);
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
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    width: 3rem;
    flex-shrink: 0;
  }

  .priority-row .player-item {
    flex: 1;
    min-width: 0;
  }

  .priority-bid {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--waiver-color);
    flex-shrink: 0;
  }

  .no-drop {
    color: var(--text-muted);
    font-style: italic;
    font-size: 0.85rem;
  }

  .waiver-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
  }

  .waiver-round {
    background: rgba(100, 116, 139, 0.2);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }

  .waiver-comments {
    padding: 0.5rem;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 6px;
    border: 1px solid rgba(51, 65, 85, 0.5);
    text-align: left;
  }

  .comments-label {
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
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

  .sidebar-filter-group select {
    width: 100%;
    padding: 0.4rem 0.5rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .sidebar-filter-group select:focus {
    outline: none;
    border-color: var(--accent);
  }

  .fa-search {
    width: 100%;
    padding: 0.5rem;
    margin-bottom: 0.5rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.85rem;
    box-sizing: border-box;
  }

  .fa-search:focus {
    outline: none;
    border-color: var(--accent);
  }

  .fa-search::placeholder {
    color: var(--text-muted);
  }

  .fa-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.5rem;
  }

  .fa-card {
    background: linear-gradient(135deg, var(--bg-secondary) 0%, #1a2536 100%);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.6rem;
    box-shadow: var(--card-shadow);
    transition: all 0.2s ease;
    animation: fadeInUp 0.3s ease;
    position: relative;
  }

  .fa-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--free-agent-color);
    border-radius: 8px 0 0 8px;
  }

  .fa-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--card-shadow-hover);
    border-color: var(--text-muted);
  }

  .fa-card.locked {
    opacity: 0.55;
    filter: saturate(0.7);
  }

  .fa-card-top {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.4rem;
    min-width: 0;
  }

  .fa-card-top .player-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  .fa-card-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .fa-team {
    font-size: 0.75rem;
    font-weight: 700;
    border-radius: 3px;
    padding: 0.075rem 0.3rem;
    white-space: nowrap;
    background: var(--team-bg, rgba(100, 116, 139, 0.2));
    color: var(--team-text, var(--text-secondary));
    border: 1px solid var(--team-bg, var(--border));
  }

  .fa-lock {
    font-size: 0.7rem;
    font-weight: 700;
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.15);
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: 3px;
    padding: 0.075rem 0.3rem;
    white-space: nowrap;
  }

  .fa-avail {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--free-agent-color);
    background: rgba(52, 211, 153, 0.15);
    border: 1px solid rgba(52, 211, 153, 0.3);
    border-radius: 3px;
    padding: 0.075rem 0.3rem;
    white-space: nowrap;
  }

  .fa-mobile-search {
    flex: 1;
    min-width: 0;
    padding: 0.3rem 0.4rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.8rem;
  }

  .fa-mobile-search:focus {
    outline: none;
    border-color: var(--accent);
  }

  .fa-mobile-search::placeholder {
    color: var(--text-muted);
  }

  @media (max-width: 768px) {
    .fa-card::before {
      width: 100%;
      height: 3px;
      border-radius: 12px 12px 0 0;
    }
  }
</style>