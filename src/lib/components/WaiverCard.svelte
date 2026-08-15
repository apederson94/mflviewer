<script lang="ts">
	import PlayerRow from '$lib/PlayerRow.svelte';
	import LeagueTag from './LeagueTag.svelte';
	import type {
		ActionResult,
		ActionRequest,
		MFLPendingWaiver,
		Player,
		PlayerData,
		WaiverManagerClaim,
		WaiverManagerLeague,
		WaiverSetClaim
	} from '$lib';

	let {
		waiver,
		year,
		playerCache,
		onSelect,
		myFranchiseId,
		context,
		onChanged
	}: {
		waiver: MFLPendingWaiver;
		year: string;
		playerCache: ReadonlyMap<string, PlayerData>;
		onSelect: (player: Player) => void;
		myFranchiseId?: string;
		context?: WaiverManagerLeague;
		onChanged?: () => void;
	} = $props();

	interface ClaimForm {
		bid: string;
		dropPlayerId: string;
	}

	let editing = $state(false);
	let submitting = $state(false);
	let cardError: string | null = $state(null);
	let forms = $state<Record<string, ClaimForm>>({});
	let withdrawn = $state<Record<string, boolean>>({});

	const isMine = $derived(
		!waiver.franchise || waiver.franchise === myFranchiseId
	);

	function roundClaims(lg: WaiverManagerLeague | null): WaiverManagerClaim[] {
		if (!lg) return [];
		return lg.claims.filter((claim) => claim.round === waiver.round);
	}

	function editableClaims(): WaiverManagerClaim[] {
		const fromContext = context ? roundClaims(context) : [];
		return fromContext.length > 0
			? fromContext
			: waiver.claims.map((c) => ({ ...c, round: waiver.round }));
	}

	const displayClaims = $derived<WaiverManagerClaim[]>(editableClaims());

	function newForm(claim: WaiverManagerClaim): ClaimForm {
		return {
			bid: claim.bid,
			dropPlayerId: claim.dropPlayerId ?? ''
		};
	}

	function formFor(claim: WaiverManagerClaim): ClaimForm {
		return forms[claim.playerId] ?? newForm(claim);
	}

	function isWithdrawn(claim: WaiverManagerClaim): boolean {
		return withdrawn[claim.playerId] === true;
	}

	function toggleWithdraw(claim: WaiverManagerClaim) {
		if (submitting) return;
		cardError = null;
		withdrawn[claim.playerId] = !isWithdrawn(claim);
	}

	function startEdit() {
		const next: Record<string, ClaimForm> = {};
		for (const claim of editableClaims()) next[claim.playerId] = newForm(claim);
		forms = next;
		withdrawn = {};
		cardError = null;
		editing = true;
	}

	function quickAmounts(lg: WaiverManagerLeague | null | undefined): number[] {
		const values = lg
			? [lg.bidSettings.minimum ?? lg.bidSettings.increment ?? 1, 1, 5, 25]
			: [1, 5, 25];
		return [...new Set(values.map((v) => Number(v.toFixed(2))))];
	}

	function setBid(claim: WaiverManagerClaim, value: string) {
		formFor(claim).bid = value;
	}

	function stepBid(claim: WaiverManagerClaim, dir: -1 | 1) {
		const form = formFor(claim);
		const step = Math.max(context?.bidSettings.increment ?? 1, 1);
		const current = parseFloat(form.bid);
		const next = Number.isFinite(current) ? current + dir * step : step;
		form.bid = next > 0 ? next.toFixed(2) : '0.01';
	}

	function setDrop(claim: WaiverManagerClaim, value: string) {
		formFor(claim).dropPlayerId = value;
	}

	function formatBid(bid: string): string {
		const num = parseFloat(bid);
		return Number.isFinite(num) ? num.toFixed(2) : bid;
	}

	function preview(): { label: string; warnings: string[] } | null {
		if (!context) return null;
		const lg = context;
		const claims = roundClaims(context);
		const warnings: string[] = [];

		if (
			lg.bidSettings.waiverType === 'BBID' &&
			lg.bbidAvailableBalance != null
		) {
			let total = 0;
			for (const claim of claims) {
				if (isWithdrawn(claim)) continue;
				const val = parseFloat(formFor(claim).bid);
				if (Number.isFinite(val)) total += val;
			}
			if (total > lg.bbidAvailableBalance) {
				warnings.push(
					`Total bids $${total.toFixed(2)} exceed available FAAB ($${lg.bbidAvailableBalance.toFixed(2)})`
				);
			}
		}

		let adds = 0;
		for (const claim of claims) {
			if (isWithdrawn(claim)) continue;
			if (!formFor(claim).dropPlayerId) adds += 1;
		}
		const afterCount = lg.roster.length + adds;
		if (lg.rosterSize > 0 && afterCount > lg.rosterSize) {
			warnings.push(
				`Roster would have ${afterCount} players — exceeds the ${lg.rosterSize}-player limit`
			);
		}

		if (warnings.length === 0) return null;
		return { label: `Roster after: ${afterCount}`, warnings };
	}

	function hasChanges(): boolean {
		for (const claim of editableClaims()) {
			if (isWithdrawn(claim)) return true;
			const form = formFor(claim);
			if (
				parseFloat(form.bid) !== parseFloat(claim.bid) ||
				(form.dropPlayerId || undefined) !== (claim.dropPlayerId || undefined)
			)
				return true;
		}
		return false;
	}

	async function finishEdit() {
		if (submitting) return;
		const finalClaims: WaiverSetClaim[] = [];
		for (const claim of editableClaims()) {
			if (isWithdrawn(claim)) continue;
			const form = formFor(claim);
			const bidVal = parseFloat(form.bid);
			if (!Number.isFinite(bidVal) || bidVal <= 0) {
				cardError = 'Enter a valid bid amount for every claim';
				return;
			}
			finalClaims.push({
				playerId: claim.playerId,
				bid: form.bid,
				dropPlayerId: form.dropPlayerId || undefined
			});
		}

		if (!hasChanges()) {
			editing = false;
			forms = {};
			withdrawn = {};
			return;
		}

		submitting = true;
		cardError = null;
		try {
			const body: ActionRequest = {
				leagueId: waiver.leagueId ?? '',
				action: 'saveAll',
				claims: finalClaims
			};
			const res = await fetch('/api/mfl/action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const result = (await res.json()) as ActionResult;
			if (!res.ok || result.error) {
				cardError = result.error || 'Submission failed';
				return;
			}
			onChanged?.();
			editing = false;
			forms = {};
			withdrawn = {};
		} catch (err) {
			cardError = err instanceof Error ? err.message : 'Submission failed';
		} finally {
			submitting = false;
		}
	}

	function toggleEdit() {
		if (editing) {
			void finishEdit();
		} else {
			startEdit();
		}
	}
</script>

<div class="waiver-card" class:editing>
	<div class="waiver-header">
		<span class="waiver-type">Pending Waiver</span>
		{#if isMine}
			<button
				type="button"
				class="waiver-edit-btn"
				class:active={editing}
				disabled={submitting}
				onclick={toggleEdit}
				>{editing ? (submitting ? 'Saving…' : 'Done') : 'Edit'}</button
			>
		{/if}
	</div>

	<div class="waiver-details">
		<div class="waiver-franchise">
			<span class="franchise-label">Franchise</span>
			<span class="franchise-name">{waiver.franchiseName}</span>
		</div>

		<div class="waiver-priorities">
			{#each displayClaims as claim, ci (claim.playerId)}
				{#if ci > 0}
					<div class="waiver-priority-separator"></div>
				{/if}
				<div class="waiver-priority">
					<span class="priority-badge">#{ci + 1}</span>
					<div class="priority-body">
						<div class="priority-row">
							<span class="priority-label">Add</span>
							{#if claim.addedPlayer}
								<PlayerRow
									id={claim.addedPlayer.id}
									name={claim.addedPlayer.name}
									position={claim.addedPlayer.position}
									team={claim.addedPlayer.team}
									rosterPct={claim.addedPlayer.rosterPct}
									adp={playerCache.get(claim.addedPlayer.id)?.adp}
									{onSelect}
								/>
							{/if}
							<span class="priority-bid"
								>${editing ? formatBid(formFor(claim).bid) : claim.bid}</span
							>
						</div>

						{#if editing}
							<div class="priority-row edit-remove-row">
								<button
									type="button"
									class="edit-remove"
									class:is-removed={isWithdrawn(claim)}
									disabled={submitting}
									onclick={() => toggleWithdraw(claim)}
								>
									{isWithdrawn(claim) ? 'Undo Remove' : 'Remove'}
								</button>
							</div>

							{#if isWithdrawn(claim)}
								<div class="withdrawn-note">
									Claim removed — it will be withdrawn when you click Done
								</div>
							{:else}
								<div class="priority-row">
									<span class="priority-label">Bid</span>
									<div class="edit-bid-row">
										<button
											type="button"
											class="edit-stepper"
											aria-label="Decrease bid"
											disabled={submitting}
											onclick={() => stepBid(claim, -1)}>−</button
										>
										<input
											class="edit-bid-input"
											type="number"
											step="0.01"
											min="0"
											value={formFor(claim).bid}
											disabled={submitting}
											oninput={(e) =>
												setBid(
													claim,
													(e.currentTarget as HTMLInputElement).value
												)}
										/>
										<button
											type="button"
											class="edit-stepper"
											aria-label="Increase bid"
											disabled={submitting}
											onclick={() => stepBid(claim, 1)}>+</button
										>
										<div class="edit-quick">
											{#each quickAmounts(context) as amt}
												<button
													type="button"
													class="edit-quick-btn"
													disabled={submitting}
													onclick={() => setBid(claim, amt.toFixed(2))}
													>${amt.toFixed(2)}</button
												>
											{/each}
										</div>
									</div>
								</div>

								<div class="priority-row">
									<span class="priority-label">Drop</span>
									{#if context}
										<select
											class="edit-drop-select"
											value={formFor(claim).dropPlayerId}
											disabled={submitting}
											onchange={(e) =>
												setDrop(
													claim,
													(e.currentTarget as HTMLSelectElement).value
												)}
										>
											<option value="">No drop</option>
											{#each context.roster.filter((rp) => rp.id !== claim.playerId) as rp (rp.id)}
												<option value={rp.id}
													>{rp.name || rp.id}{rp.status !== 'ROSTER'
														? ` (${rp.status})`
														: ''}</option
												>
											{/each}
										</select>
									{:else}
										<span class="drop-loading">Roster unavailable</span>
									{/if}
								</div>
							{/if}
						{:else}
							<div class="priority-row">
								<span class="priority-label">Drop</span>
								{#if claim.droppedPlayer}
									<PlayerRow
										id={claim.droppedPlayer.id}
										name={claim.droppedPlayer.name}
										position={claim.droppedPlayer.position}
										team={claim.droppedPlayer.team}
										rosterPct={claim.droppedPlayer.rosterPct}
										adp={playerCache.get(claim.droppedPlayer.id)?.adp}
										{onSelect}
									/>
								{:else}
									<span class="no-drop">None</span>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		{#if editing && preview()}
			<div class="edit-preview" class:has-warning={preview()?.warnings.length}>
				<span>{preview()?.label}</span>
				{#each preview()?.warnings ?? [] as warning}
					<span class="edit-preview-warning">⚠ {warning}</span>
				{/each}
			</div>
		{/if}

		{#if editing && cardError}
			<div class="edit-card-error">{cardError}</div>
		{/if}

		<div class="waiver-meta">
			<span class="waiver-meta-left">
				<span class="waiver-round">Round {waiver.round}</span>
				<LeagueTag
					leagueId={waiver.leagueId}
					leagueName={waiver.leagueName ?? ''}
					{year}
				/>
			</span>
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

<style>
	.waiver-card {
		background: var(--bg-secondary);
		border: 2px solid var(--border);
		border-radius: 0;
		padding: 0.9rem;
		box-shadow: var(--card-shadow);
		transition: all 0.1s ease;
		position: relative;
		animation: fadeInUp 0.25s ease;
	}

	.waiver-card::before {
		content: '';
		position: absolute;
		left: -2px;
		top: -2px;
		bottom: -2px;
		width: 8px;
		background: var(--waiver-color);
	}

	.waiver-card:hover {
		transform: translate(-2px, -2px);
		box-shadow: var(--card-shadow-hover);
	}

	.waiver-card.editing {
		border-color: var(--highlight);
		box-shadow: var(--card-shadow-hover);
	}

	.waiver-card.editing .waiver-header {
		border-bottom-color: var(--highlight);
	}

	.waiver-card.editing::before {
		background: var(--highlight);
	}

	.waiver-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		padding-bottom: 0.4rem;
		border-bottom: 2px solid var(--border);
	}

	.waiver-type {
		font-weight: 900;
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
		border-radius: 0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--waiver-color);
		background: var(--type-waiver-bg);
		border: 1px solid var(--border);
	}

	.waiver-edit-btn {
		padding: 0.3rem 0.7rem;
		font-size: 0.65rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-primary);
		background: var(--bg-secondary);
		border: 2px solid var(--border);
		cursor: pointer;
	}

	.waiver-edit-btn:hover,
	.waiver-edit-btn.active {
		color: var(--on-highlight);
		background: var(--highlight);
	}

	.waiver-edit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.waiver-details {
		padding: 0.25rem 0;
	}

	.waiver-franchise {
		margin-bottom: 0.5rem;
	}

	.franchise-label {
		display: block;
		font-size: 0.65rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 0.15rem;
	}

	.franchise-name {
		display: block;
		color: var(--text-primary);
		font-weight: 900;
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.waiver-priorities {
		margin-bottom: 0.5rem;
	}

	.waiver-priority-separator {
		height: 2px;
		background: var(--text-primary);
		margin: 0.5rem 0;
	}

	.waiver-priority {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.priority-badge {
		font-size: var(--badge-font-size);
		font-weight: var(--badge-font-weight);
		padding: var(--badge-padding);
		border-radius: 0;
		background: var(--highlight);
		color: var(--on-highlight);
		border: 1px solid var(--border);
		letter-spacing: var(--badge-letter-spacing);
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
		font-size: 0.65rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		width: 3rem;
		flex-shrink: 0;
	}

	:global(.priority-row .player-row) {
		flex: 1;
		min-width: 0;
	}

	.priority-bid {
		font-size: 0.8rem;
		font-weight: 900;
		color: var(--waiver-color);
		background: var(--type-waiver-bg);
		border: 1px solid var(--border);
		border-radius: 0;
		padding: 0.1rem 0.4rem;
		flex-shrink: 0;
		white-space: nowrap;
		margin-left: 0.25rem;
	}

	.edit-bid-row {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.edit-stepper {
		width: 1.9rem;
		height: 2rem;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		font-weight: 900;
		line-height: 1;
		color: var(--text-primary);
		background: var(--bg-secondary);
		border: 2px solid var(--border);
		cursor: pointer;
	}

	.edit-stepper:hover:not(:disabled) {
		color: var(--on-highlight);
		background: var(--highlight);
	}

	.edit-stepper:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.edit-bid-input {
		width: 5rem;
		height: 2rem;
		padding: 0 0.4rem;
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--text-primary);
		background: var(--bg-secondary);
		border: 2px solid var(--border);
	}

	.edit-bid-input:focus {
		outline: 2px solid var(--highlight);
		outline-offset: 1px;
	}

	.edit-bid-input:disabled {
		opacity: 0.6;
	}

	.edit-quick {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.edit-quick-btn {
		padding: 0.3rem 0.6rem;
		font-size: 0.7rem;
		font-weight: 900;
		color: var(--text-primary);
		background: var(--bg-secondary);
		border: 2px solid var(--border);
		cursor: pointer;
	}

	.edit-quick-btn:hover:not(:disabled) {
		color: var(--on-highlight);
		background: var(--highlight);
	}

	.edit-quick-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.edit-drop-select {
		flex: 1;
		min-width: 0;
		height: 2rem;
		padding: 0 0.35rem;
		font-size: 0.8rem;
		color: var(--text-primary);
		background: var(--bg-secondary);
		border: 2px solid var(--border);
	}

	.edit-drop-select:disabled {
		opacity: 0.6;
	}

	.drop-loading {
		flex: 1;
		min-width: 0;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.edit-remove-row {
		justify-content: flex-end;
		padding: 0;
	}

	.edit-remove {
		padding: 0.2rem 0.6rem;
		font-size: 0.65rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--drop-color);
		background: var(--bg-paper);
		border: 2px solid var(--drop-color);
		cursor: pointer;
	}

	.edit-remove:hover:not(:disabled) {
		color: var(--on-highlight);
		background: var(--drop-color);
	}

	.edit-remove.is-removed {
		color: var(--on-highlight);
		background: var(--highlight);
		border-color: var(--highlight);
	}

	.edit-remove:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.withdrawn-note {
		padding: 0.4rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--drop-color);
		background: var(--error-bg);
		border: 1px solid var(--error-border);
		margin-bottom: 0.4rem;
	}

	.edit-card-error {
		padding: 0.5rem 0.6rem;
		font-size: 0.8rem;
		font-weight: 800;
		color: var(--drop-color);
		background: var(--error-bg);
		border: 1px solid var(--error-border);
		margin-bottom: 0.5rem;
	}

	.edit-preview {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.4rem 0.5rem;
		margin-bottom: 0.5rem;
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-primary);
		background: var(--bg-paper);
		border: 1px solid var(--border);
	}

	.edit-preview.has-warning {
		border-color: var(--drop-color);
	}

	.edit-preview-warning {
		font-weight: 800;
		color: var(--drop-color);
	}

	.no-drop {
		color: var(--text-muted);
		font-style: italic;
		font-size: 0.85rem;
		font-weight: 700;
	}

	.waiver-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-bottom: 0.5rem;
		font-weight: 700;
	}

	.waiver-meta-left {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 0;
	}

	:global(.waiver-meta .league-tag) {
		margin: 0;
	}

	.waiver-round {
		background: var(--bg-primary);
		border: 1px solid var(--border);
		padding: 0.15rem 0.4rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-size: 0.7rem;
	}

	.waiver-comments {
		padding: 0.6rem;
		background: var(--bg-paper);
		border: 2px solid var(--border);
		border-radius: 0;
		text-align: left;
		box-shadow: var(--shadow-sm);
	}

	.comments-label {
		display: block;
		font-size: 0.7rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
	}

	.comments-text {
		font-size: 0.85rem;
		color: var(--text-secondary);
		white-space: pre-wrap;
	}
</style>
