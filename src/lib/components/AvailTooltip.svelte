<script lang="ts">
	let {
		tooltip,
		leagueName
	}: {
		tooltip: { x: number; y: number; leagues: string[] } | null;
		leagueName: (id: string) => string;
	} = $props();
</script>

{#if tooltip}
	<div
		class="fa-tooltip"
		style={`left:${tooltip.x}px;top:${tooltip.y}px`}
		role="tooltip"
	>
		<span class="fa-tooltip-title">Available in</span>
		<ul class="fa-tooltip-list">
			{#each tooltip.leagues as lid}
				<li>{leagueName(lid)}</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.fa-tooltip {
		position: fixed;
		z-index: 200;
		min-width: 180px;
		max-width: 280px;
		background: var(--tooltip-bg);
		color: var(--tooltip-text);
		border: 2px solid var(--border);
		box-shadow: var(--shadow-sm);
		padding: 0.5rem;
		pointer-events: none;
	}

	.fa-tooltip-title {
		display: block;
		font-size: 0.6rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--tooltip-title);
		margin-bottom: 0.35rem;
	}

	.fa-tooltip-list {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 200px;
		overflow-y: auto;
	}

	.fa-tooltip-list li {
		font-size: 0.8rem;
		font-weight: 700;
		padding: 0.15rem 0;
		border-bottom: 1px solid var(--tooltip-sep);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.fa-tooltip-list li:last-child {
		border-bottom: none;
	}
</style>
