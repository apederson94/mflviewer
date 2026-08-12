<script lang="ts">
  import PlayerAvatar from './PlayerAvatar.svelte';
  import TeamChip from './TeamChip.svelte';
  import { isRealPlayerId } from './playerProfiles';
  import type { ProfilePlayer } from './types';

  let {
    id,
    position,
    team,
    name,
    rosterPct,
    adp,
    onSelect
  }: {
    id: string;
    position?: string;
    team?: string;
    name: string;
    rosterPct?: number;
    adp?: string;
    onSelect?: (player: ProfilePlayer) => void;
  } = $props();

  const adpValue = $derived(adp?.trim() || '');
  const showAdp = $derived(adpValue && adpValue !== 'N/A' && adpValue !== '0');

  const clickable = $derived(onSelect != null && isRealPlayerId(id));
</script>

{#snippet rowContent()}
  <PlayerAvatar {id} {position} size="lg" />
  <div class="player-row-info">
    <span class="player-row-name">{name}</span>
    <span class="player-row-meta">
      {#if position}
        <span class="position-badge" data-position={position}>{position}</span>
      {/if}
      <TeamChip {team} />
      {#if rosterPct != null}
        <span class="roster-badge">{rosterPct.toFixed(1)}%</span>
      {/if}
      {#if showAdp}
        <span class="adp-badge">ADP {adpValue}</span>
      {/if}
    </span>
  </div>
{/snippet}

{#if clickable}
  <button
    type="button"
    class="player-row player-row-btn"
    aria-label={`View profile for ${name}`}
    onclick={() => onSelect?.({ id, name, position, team, rosterPct })}
  >
    {@render rowContent()}
  </button>
{:else}
  <div class="player-row">
    {@render rowContent()}
  </div>
{/if}

<style>
  .player-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex: 1;
    min-width: 0;
  }

  .player-row-btn {
    width: 100%;
    text-align: left;
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
  }

  .player-row-btn:hover .player-row-name {
    color: var(--highlight);
    text-decoration: underline;
  }

  .player-row-btn:focus-visible {
    outline: 2px solid var(--highlight);
    outline-offset: 2px;
  }

  .player-row-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .player-row-name {
    font-weight: 600;
    color: var(--text-primary);
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .player-row-meta {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
  }
</style>
