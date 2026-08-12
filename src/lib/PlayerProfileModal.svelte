<script lang="ts">
  import PlayerAvatar from './PlayerAvatar.svelte';
  import TeamChip from './TeamChip.svelte';
  import type { MFLPlayerNewsArticle, MFLPlayerProfile, ProfilePlayer } from './types';

  let {
    player,
    year,
    onclose
  }: {
    player: ProfilePlayer | null;
    year?: string;
    onclose: () => void;
  } = $props();

  let profile = $state<MFLPlayerProfile | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let closeBtn = $state<HTMLButtonElement | null>(null);

  const newsArticles = $derived.by<MFLPlayerNewsArticle[]>(() => {
    const raw = profile?.news?.article;
    if (!raw) return [];
    return (Array.isArray(raw) ? raw : [raw]).slice(0, 5);
  });

  async function load(): Promise<void> {
    if (!player) return;
    profile = null;
    error = null;
    loading = true;
    try {
      const res = await fetch(`/api/player-profile/${encodeURIComponent(player.id)}`);
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      if (!res.ok) {
        throw new Error(`Failed to load profile (${res.status})`);
      }
      profile = data;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load player profile';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (!player) return;
    load();
    closeBtn?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onclose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

{#if player}
  <div class="profile-backdrop" role="presentation" onclick={onclose}></div>
  <div class="profile-modal" role="dialog" aria-modal="true" aria-label={`${player.name} profile`}>
    <button type="button" class="profile-close" aria-label="Close" bind:this={closeBtn} onclick={onclose}>×</button>

    <div class="profile-header">
      <PlayerAvatar id={player.id} position={player.position} size="lg" alt={player.name} />
      <div class="profile-header-info">
        <span class="profile-name">{player.name}</span>
        <span class="profile-meta">
          {#if player.position}
            <span class="position-badge" data-position={player.position}>{player.position}</span>
          {/if}
          <TeamChip team={player.team} />
          {#if player.rosterPct != null}
            <span class="roster-badge">{player.rosterPct.toFixed(1)}%</span>
          {/if}
        </span>
      </div>
    </div>

    {#if loading}
      <div class="profile-status">Loading profile...</div>
    {:else if error}
      <div class="profile-status profile-error">
        <span>{error}</span>
        <button type="button" class="profile-retry" onclick={load}>Try again</button>
      </div>
    {:else if profile}
      <div class="profile-stats">
        <div class="profile-stat">
          <span class="profile-stat-label">Age</span>
          <span class="profile-stat-value">{profile.player.age ?? '—'}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-label">DOB</span>
          <span class="profile-stat-value">{profile.player.dob ?? '—'}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-label">Height</span>
          <span class="profile-stat-value">{profile.player.height ?? '—'}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-label">Weight</span>
          <span class="profile-stat-value">{profile.player.weight ?? '—'}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-label">ADP</span>
          <span class="profile-stat-value">{profile.player.adp ?? '—'}</span>
        </div>
      </div>
      {#if player.availableIn}
        <div class="profile-avail">
          Available in {player.availableIn.length} league{player.availableIn.length === 1 ? '' : 's'}
        </div>
      {/if}
      <div class="profile-news">
        <span class="profile-news-title">Recent News</span>
        {#if newsArticles.length > 0}
          <ul class="profile-news-list">
            {#each newsArticles as article}
              <li class="profile-news-item">
                {#if article.id}
                  <a
                    class="profile-news-headline"
                    href={`https://www.myfantasyleague.com/${year}/view_news_article?L=&ID=${encodeURIComponent(article.id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >{article.headline}</a>
                {:else}
                  <span class="profile-news-headline">{article.headline}</span>
                {/if}
                {#if article.published}
                  <span class="profile-news-time">{article.published}</span>
                {/if}
              </li>
            {/each}
          </ul>
          <a
            class="profile-news-link"
            href={`https://www.myfantasyleague.com/${year}/news_articles?L=&P=${player.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View all news on MFL →
          </a>
        {:else}
          <span class="profile-news-none">None</span>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .profile-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(17, 17, 17, 0.6);
    z-index: 400;
  }

  .profile-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 401;
    width: min(92vw, 400px);
    max-height: 85vh;
    overflow-y: auto;
    background: var(--bg-paper);
    border: 3px solid var(--border);
    box-shadow: var(--card-shadow-hover);
    padding: 1rem 1rem 1.25rem;
    animation: profileIn 0.15s ease;
  }

  @keyframes profileIn {
    from {
      opacity: 0;
      transform: translate(-50%, -46%);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%);
    }
  }

  .profile-close {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    font-weight: 900;
    line-height: 1;
    color: var(--text-primary);
    background: var(--bg-secondary);
    border: 2px solid var(--border);
    cursor: pointer;
  }

  .profile-close:hover {
    color: var(--on-highlight);
    background: var(--highlight);
  }

  .profile-close:focus-visible {
    outline: 2px solid var(--highlight);
    outline-offset: 2px;
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    min-width: 0;
    padding-right: 1.75rem;
  }

  .profile-header-info {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }

  .profile-name {
    font-weight: 900;
    color: var(--text-primary);
    font-size: 1.05rem;
    line-height: 1.15;
  }

  .profile-meta {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .profile-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.75rem;
    border: 2px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .profile-error {
    color: var(--drop-color);
  }

  .profile-retry {
    font-size: 0.7rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--on-highlight);
    background: var(--highlight);
    border: 2px solid var(--border);
    padding: 0.25rem 0.5rem;
    cursor: pointer;
  }

  .profile-retry:hover {
    color: var(--text-primary);
  }

  .profile-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .profile-stat {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.5rem;
    background: var(--bg-secondary);
    border: 2px solid var(--border);
  }

  .profile-stat-label {
    font-size: 0.6rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .profile-stat-value {
    font-weight: 800;
    color: var(--text-primary);
  }

  .profile-avail {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--free-agent-color);
  }

  .profile-news {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 2px solid var(--border);
  }

  .profile-news-title {
    display: block;
    font-size: 0.6rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
  }

  .profile-news-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .profile-news-item {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.4rem 0;
    border-bottom: 1px dashed var(--border);
  }

  .profile-news-item:last-child {
    border-bottom: none;
  }

  .profile-news-headline {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.3;
  }

  a.profile-news-headline {
    text-decoration: none;
  }

  a.profile-news-headline:hover {
    color: var(--highlight);
    text-decoration: underline;
  }

  .profile-news-none {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .profile-news-time {
    flex-shrink: 0;
    font-size: 0.65rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .profile-news-link {
    display: inline-block;
    margin-top: 0.5rem;
    font-size: 0.7rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--highlight);
    text-decoration: none;
  }

  .profile-news-link:hover {
    text-decoration: underline;
  }
</style>
