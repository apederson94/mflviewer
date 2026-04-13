<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import type { StoredLeague, MFLTransaction } from '$lib';

  let { data }: { data: PageData } = $props();

  let leagues = $state(data.leagues ?? []);
  let selectedLeague = $state<StoredLeague | null>(null);
  let transactions = $state<MFLTransaction[]>([]);
  let playerCache = $state(new Map((data.players || []) as [string, { name: string; position: string }][]));
  let loading = $state(false);
  let error = $state<string | null>(null);
  let loginUsername = $state('');
  let loginPassword = $state('');
  let formLoading = $state(false);

  let isLoggedIn = $derived(data.loggedIn);

  async function loadTransactions(leagueId: string) {
    loading = true;
    error = null;
    try {
      const res = await fetch(`/api/mfl?type=transactions&league=${leagueId}`);
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      transactions = data.transactions || [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load transactions';
      transactions = [];
    } finally {
      loading = false;
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

  function handleSelectLeague(league: StoredLeague) {
    selectedLeague = league;
    loadTransactions(league.id);
  }

  
</script>

<svelte:head>
  <title>MFL Transaction Viewer</title>
</svelte:head>

<div class="app">
  <header class="header">
    <div class="title-row">
      <h1>MFL Transaction Viewer <span class="week">Week {data.week}</span></h1>
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
    <aside class="sidebar">
      <div class="sidebar-content">
        <h2>My Leagues</h2>
        
        {#if data.error}
          <p class="error">{data.error}</p>
        {/if}
        
        {#if !isLoggedIn}
          <p class="login-prompt">Log in to view your leagues</p>
        {/if}
        
        <ul class="league-list">
          {#each leagues as league (league.id)}
            <li
              class="league-item {selectedLeague?.id === league.id ? 'active' : ''}"
              onclick={() => handleSelectLeague(league)}
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && handleSelectLeague(league)}
            >
              <span class="league-name">{league.name}</span>
              <span class="league-id">{league.id}</span>
            </li>
          {/each}
        </ul>
        
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
    
    <main class="content">
      {#if error}
        <div class="error">{error}</div>
      {/if}
      
      {#if selectedLeague}
        {#if loading}
          <div class="loading">Loading transactions...</div>
        {:else if transactions.length > 0}
          <div class="transactions-list">
            {#each transactions as transaction, i (`${transaction.id ?? i}-${transaction.week ?? i}-${transaction.type ?? i}`)}
              <div class="transaction-card">
                <div class="transaction-header">
                  <span class="transaction-type">{transaction.type}</span>
                  <span class="transaction-week">Week {transaction.week}</span>
                </div>
                {#if transaction.type === 'Trade' && transaction.tradeGives && transaction.tradeReceives}
                  <div class="trade-header">
                    <span class="trade-col">{transaction.franchiseName}</span>
                    <span class="trade-col">{transaction.tradePartnerName}</span>
                  </div>
                  <div class="trade-sides">
                    <div class="trade-side">{transaction.tradeReceives?.join(', ') || 'None'}</div>
                    <div class="trade-side">{transaction.tradeGives?.join(', ') || 'None'}</div>
                  </div>
                {:else}
                  <div class="tx-content">
                    <span class="tx-franchise">{transaction.franchiseName}</span>
                    <span class="tx-player">
                      {transaction.playerName || getPlayerName(transaction.player || '')}
                      {#if transaction.bid}<span class="tx-bid">Bid: ${transaction.bid}</span>{/if}
                    </span>
                  </div>
                {/if}
                <div class="tx-timestamp">{transaction.formattedTime}</div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="no-data">
            No transactions found for this league
          </div>
        {/if}
      {:else}
        <div class="no-data">
          Select a league from the sidebar to view transactions
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
  }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
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
    font-weight: normal;
    vertical-align: middle;
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
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .login-form input::placeholder {
    color: var(--text-secondary);
  }

  .login-form button, .login-btn {
    padding: 0.5rem 1.5rem;
    background: var(--accent);
    color: var(--text-primary);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .login-form button:hover, .login-btn:hover {
    background: var(--accent-hover);
  }

  .login-form button:disabled {
    background: var(--text-muted);
    cursor: not-allowed;
  }

  .main-content {
    display: flex;
    flex: 1;
  }

  .sidebar {
    width: 280px;
    min-width: 280px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  
.sidebar-content {
    flex: 1;
    overflow-y: auto;
  }
  
  .sidebar .github-stars {
    text-align: right;
  }
 
  .sidebar h2 {
    margin: 0 0 1rem 0;
    font-size: 1.2rem;
    color: var(--text-primary);
  }

  .login-prompt {
    color: var(--text-secondary);
    font-size: 0.9rem;
    text-align: center;
    padding: 1rem;
  }

  .league-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .league-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    margin-bottom: 0.25rem;
    transition: background 0.2s;
  }

  .league-item:hover {
    background: var(--border);
  }

  .league-item.active {
    background: var(--accent);
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
    color: var(--text-secondary);
    font-size: 0.75rem;
    margin-left: 0.5rem;
  }

  .no-data {
    color: var(--text-secondary);
    text-align: center;
    padding: 2rem 1rem;
  }

  .content {
    flex: 1;
    padding: 2rem;
    background: var(--bg-primary);
    overflow-y: auto;
  }

  .error {
    background: var(--error-bg);
    color: var(--accent);
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    border-left: 4px solid var(--accent);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .error::before {
    content: "⚠";
    font-weight: bold;
  }

  .loading {
    color: var(--text-secondary);
    text-align: center;
    padding: 2rem;
  }

  .transactions-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .transaction-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    overflow: hidden;
  }

  .transaction-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
  }

  .transaction-type {
    color: var(--accent);
    font-weight: 600;
    font-size: 0.95rem;
  }

  .transaction-week {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .trade-header {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    font-weight: 600;
    font-size: 1rem;
    padding: 0.25rem 0;
    color: var(--text-primary);
  }

  .trade-col {
    text-align: left;
  }

  .trade-sides {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .trade-side {
    min-width: 0;
    padding: 0.5rem;
    background: var(--bg-primary);
    border-radius: 4px;
    word-break: break-word;
  }

  .tx-content {
    padding: 0.25rem 0;
    font-size: 0.95rem;
  }

  .tx-franchise {
    font-weight: 600;
    display: block;
    padding: 0.25rem 0;
  }

  .tx-player {
    display: block;
    padding: 0.25rem 0;
  }

  .tx-bid {
    color: var(--accent);
    margin-left: 0.5rem;
  }

  .tx-timestamp {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin-top: 0.75rem;
  }

  @media (max-width: 768px) {
    .main-content {
      flex-direction: column;
    }

    .sidebar {
      width: 100%;
      min-width: unset;
      max-height: 200px;
    }

    .header {
      flex-direction: column;
      gap: 1rem;
    }

    .login-form {
      flex-wrap: wrap;
    }
  }
</style>