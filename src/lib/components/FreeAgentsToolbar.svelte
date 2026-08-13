<script lang="ts">
	import { FA_POSITIONS } from '$lib';

	let {
		faPosition = $bindable('ALL'),
		faSearch = $bindable('')
	}: {
		faPosition?: string;
		faSearch?: string;
	} = $props();
</script>

<div class="mobile-toolbar">
	<select class="mobile-toolbar-select" bind:value={faPosition}>
		{#each FA_POSITIONS as pos}
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

<style>
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
</style>
