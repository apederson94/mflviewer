<script lang="ts">
	let {
		leagueId,
		leagueName,
		year
	}: {
		leagueId?: string;
		leagueName: string;
		year: string;
	} = $props();
</script>

<a
	href={`https://www.myfantasyleague.com/${year}/home/${leagueId ?? ''}`}
	target="_blank"
	rel="noopener noreferrer"
	class="league-tag-link"
>
	<span class="league-tag">{leagueName}</span>
</a>

<style>
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
</style>
