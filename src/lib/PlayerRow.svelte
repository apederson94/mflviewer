<script lang="ts">
  import PlayerAvatar from './PlayerAvatar.svelte';
  import TeamChip from './TeamChip.svelte';

  let {
    id,
    position,
    team,
    name,
    rosterPct
  }: {
    id: string;
    position?: string;
    team?: string;
    name: string;
    rosterPct?: number;
  } = $props();
</script>

<div class="player-row">
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
    </span>
  </div>
</div>

<style>
  .player-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex: 1;
    min-width: 0;
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
