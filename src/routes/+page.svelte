<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import type { StoredLeague, MFLTransaction } from '$lib';

  let { data }: { data: PageData } = $props();

  let leagues = $state(data.leagues ?? []);
  let selectedLeague = $state<StoredLeague | null>(null);
  let transactions = $state<MFLTransaction[]>([]);
  let playerCache = $state<Map<string, { name: string; position: string }>>(new Map());
  let loading = $state(false);
  let error = $state<string | null>(null);
  let loginUsername = $state('');
  let loginPassword = $state('');
  let formLoading = $state(false);

  let isLoggedIn = $derived(data.loggedIn);

  onMount(async () => {
    await loadPlayerCache();
  });

  

  async function loadPlayerCache() {
    try {
      const res = await fetch('/api/mfl?type=players');
      const data = await res.json();
      if (data.players) {
        playerCache = new Map(data.players as [string, { name: string; position: string }][]);
      }
    } catch (err) {
      console.error('Failed to load player cache:', err);
    }
  }

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
        
        {#if leagues.length === 0 && isLoggedIn}
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
                <div class="transaction-body">
                  <span>Player: {getPlayerName(transaction.player)}</span>
                  {#if transaction.bid}
                    <span>Bid: ${transaction.bid}</span>
                  {/if}
                </div>
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
    background: #16213e;
    border-bottom: 1px solid #0f3460;
  }
  
.title-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .title-row h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #fff;
    vertical-align: middle;
  }
  
  .title-row .week {
    margin-left: 0.5rem;
    font-size: 0.9rem;
    color: #e94560;
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
    border: 1px solid #0f3460;
    border-radius: 4px;
    background: #1a1a2e;
    color: #fff;
    font-size: 0.9rem;
  }

  .login-form input::placeholder {
    color: #888;
  }

  .login-form button, .login-btn {
    padding: 0.5rem 1.5rem;
    background: #e94560;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .login-form button:hover, .login-btn:hover {
    background: #d13652;
  }

  .login-form button:disabled {
    background: #666;
    cursor: not-allowed;
  }

  .main-content {
    display: flex;
    flex: 1;
  }

  .sidebar {
    width: 280px;
    min-width: 280px;
    background: #16213e;
    border-right: 1px solid #0f3460;
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
    color: #fff;
  }

  .login-prompt {
    color: #888;
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
    background: #0f3460;
  }

  .league-item.active {
    background: #e94560;
  }

  .league-name {
    flex: 1;
    color: #fff;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .league-id {
    color: #888;
    font-size: 0.75rem;
    margin-left: 0.5rem;
  }

  .no-data {
    color: #888;
    text-align: center;
    padding: 2rem 1rem;
  }

  .content {
    flex: 1;
    padding: 2rem;
    background: #1a1a2e;
    overflow-y: auto;
  }

  .error {
    background: #3d1a1a;
    color: #e94560;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .loading {
    color: #888;
    text-align: center;
    padding: 2rem;
  }

  .transactions-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .transaction-card {
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 8px;
    padding: 1rem;
  }

  .transaction-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #0f3460;
  }

  .transaction-type {
    color: #e94560;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .transaction-week {
    color: #888;
    font-size: 0.85rem;
  }

  .transaction-body {
    display: flex;
    justify-content: space-between;
    color: #fff;
    font-size: 0.9rem;
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