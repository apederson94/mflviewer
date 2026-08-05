<script lang="ts">
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

  let { team }: { team?: string } = $props();

  const color = $derived(team ? NFL_TEAM_COLORS[team.toUpperCase()] || '' : '');
  const text = $derived(color ? contrastText(color) : '');

  function contrastText(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#000000' : '#ffffff';
  }
</script>

{#if team}
  <span
    class="team-chip"
    style={color ? `--team-bg:${color};--team-text:${text}` : ''}
  >{team}</span>
{/if}

<style>
  .team-chip {
    font-size: 0.75rem;
    font-weight: 700;
    border-radius: 0;
    padding: 0.075rem 0.3rem;
    white-space: nowrap;
    background: var(--team-bg, var(--pos-unk-bg));
    color: var(--team-text, var(--pos-unk-text));
    border: 1px solid var(--border);
    flex-shrink: 0;
  }
</style>
