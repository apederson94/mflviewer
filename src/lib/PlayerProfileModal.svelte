<script lang="ts">
	import PlayerAvatar from './PlayerAvatar.svelte';
	import TeamChip from './TeamChip.svelte';
	import { fetchJson } from './fetchJson';
	import type {
		League,
		MFLPlayerNewsArticle,
		MFLPlayerProfile,
		Player,
		PlayerActionContext,
		PlayerActionLeague,
		ActionRequest,
		ActionResult,
		Exposure
	} from './types';

	let {
		player,
		year,
		leagues = [],
		onclose,
		onActionComplete
	}: {
		player: Player | null;
		year?: string;
		leagues?: League[];
		onclose: () => void;
		onActionComplete?: () => void;
	} = $props();

	let profile = $state<MFLPlayerProfile | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let closeBtn = $state<HTMLButtonElement | null>(null);

	const newsLimit = 5;
	let newsPage = $state(0);

	const newsArticles = $derived.by<MFLPlayerNewsArticle[]>(() => {
		const raw = profile?.news?.article;
		if (!raw) return [];
		return Array.isArray(raw) ? raw : [raw];
	});

	const adpValue = $derived(profile?.player.adp?.trim() || '');
	const isAdpMissing = $derived(
		!adpValue || adpValue === 'N/A' || adpValue === '0'
	);

	const totalNewsPages = $derived(
		Math.max(1, Math.ceil(newsArticles.length / newsLimit))
	);
	const visibleNews = $derived(
		newsArticles.slice(newsPage * newsLimit, newsPage * newsLimit + newsLimit)
	);

	async function load(): Promise<void> {
		if (!player) return;
		profile = null;
		error = null;
		newsPage = 0;
		loading = true;
		try {
			const data = await fetchJson<MFLPlayerProfile>(
				`/api/player-profile/${encodeURIComponent(player.id)}`
			);
			profile = data;
		} catch (err) {
			error =
				err instanceof Error ? err.message : 'Failed to load player profile';
		} finally {
			loading = false;
		}
	}

	let activeTab = $state<'profile' | 'actions'>('profile');
	let actionsLoaded = $state(false);
	let actionsLoading = $state(false);
	let actionError = $state<string | null>(null);
	let actionContext = $state<PlayerActionLeague[]>([]);
	let exposure = $state<Exposure | null>(null);

	interface LeagueForm {
		bid: string;
		dropPlayerId: string;
		submitting: boolean;
		error: string | null;
		success: string | null;
	}

	let forms = $state<Record<string, LeagueForm>>({});

	$effect(() => {
		if (!player) return;
		load();
		loadActions();
		activeTab = 'profile';
		actionsLoaded = false;
		actionContext = [];
		exposure = null;
		forms = {};
		closeBtn?.focus();

		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onclose();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});

	function selectTab(tab: 'profile' | 'actions') {
		activeTab = tab;
		if (tab === 'actions' && !actionsLoaded) {
			loadActions();
		}
	}

	function defaultBidFor(lg: PlayerActionLeague): string {
		if (lg.existingBid) return lg.existingBid.bid;
		const s = lg.bidSettings;
		const base = s.minimum ?? s.increment ?? 1;
		return String(base);
	}

	function newForm(lg: PlayerActionLeague): LeagueForm {
		return {
			bid: defaultBidFor(lg),
			dropPlayerId: lg.existingBid?.dropPlayerId ?? '',
			submitting: false,
			error: null,
			success: null
		};
	}

	function initForms(context: PlayerActionLeague[]) {
		const next: Record<string, LeagueForm> = {};
		for (const lg of context) {
			next[lg.leagueId] = newForm(lg);
		}
		forms = next;
	}

	function formFor(lg: PlayerActionLeague): LeagueForm {
		return forms[lg.leagueId] ?? newForm(lg);
	}

	async function loadActions(): Promise<void> {
		if (!player) return;
		actionsLoading = true;
		actionError = null;
		try {
			const ids = leagues.map((l) => l.id).join(',');
			if (!ids) throw new Error('No leagues available');
			const data = await fetchJson<PlayerActionContext>(
				`/api/player-actions?league=${ids}&player=${encodeURIComponent(
					player.id
				)}`
			);
			actionContext = data.leagues;
			exposure = data.exposure ?? null;
			initForms(data.leagues);
			actionsLoaded = true;
		} catch (err) {
			actionError =
				err instanceof Error ? err.message : 'Failed to load actions';
		} finally {
			actionsLoading = false;
		}
	}

	function quickAmounts(lg: PlayerActionLeague): number[] {
		const s = lg.bidSettings;
		const values = [s.minimum ?? s.increment ?? 1, 1, 5, 25];
		return [...new Set(values.map((v) => Number(v.toFixed(2))))];
	}

	function setBid(lg: PlayerActionLeague, value: string) {
		formFor(lg).bid = value;
	}

	function stepBid(lg: PlayerActionLeague, dir: -1 | 1) {
		const form = formFor(lg);
		const step = Math.max(lg.bidSettings.increment ?? 1, 1);
		const current = parseFloat(form.bid);
		const next = Number.isFinite(current) ? current + dir * step : step;
		form.bid = next > 0 ? next.toFixed(2) : '0.01';
	}

	function setDrop(lg: PlayerActionLeague, value: string) {
		formFor(lg).dropPlayerId = value;
	}

	function normalizePosition(pos?: string): string {
		const p = (pos ?? '').trim().toUpperCase();
		if (p === 'PK') return 'K';
		if (p === 'DEF' || p === 'DFL') return 'DST';
		return p || 'UNK';
	}

	function statusLabel(lg: PlayerActionLeague): string {
		switch (lg.playerStatus) {
			case 'freeAgent':
				return 'Free agent';
			case 'rostered':
				return lg.onMyRoster ? 'Your roster' : 'Rostered';
			case 'locked':
				return 'Locked';
			default:
				return 'Unknown';
		}
	}

	function formatBid(bid: string): string {
		const num = parseFloat(bid);
		return Number.isFinite(num) ? num.toFixed(2) : bid;
	}

	function rosterPlayerName(lg: PlayerActionLeague, id: string): string {
		return lg.roster.find((rp) => rp.id === id)?.name || id;
	}

	function impactPreview(lg: PlayerActionLeague): {
		label: string;
		warnings: string[];
	} | null {
		const form = forms[lg.leagueId];
		if (!form) return null;
		const adding = lg.playerStatus === 'freeAgent';
		const dropping = !!form.dropPlayerId;
		const afterCount = lg.roster.length + (adding ? 1 : 0) - (dropping ? 1 : 0);

		const warnings: string[] = [];
		if (lg.rosterSize > 0 && afterCount > lg.rosterSize) {
			warnings.push(
				`Roster would have ${afterCount} players — exceeds the ${lg.rosterSize}-player limit`
			);
		}
		if (
			lg.bidSettings.waiverType === 'BBID' &&
			lg.bbidAvailableBalance != null
		) {
			const bidVal = parseFloat(form.bid);
			if (Number.isFinite(bidVal) && bidVal > lg.bbidAvailableBalance) {
				warnings.push(
					`Bid exceeds available FAAB ($${lg.bbidAvailableBalance.toFixed(2)})`
				);
			}
		}

		const counts: Record<string, number> = {};
		for (const rp of lg.roster) {
			const key = normalizePosition(rp.position);
			counts[key] = (counts[key] ?? 0) + 1;
		}
		if (adding && player?.position) {
			const key = normalizePosition(player.position);
			counts[key] = (counts[key] ?? 0) + 1;
		}
		if (dropping) {
			const dropPos = lg.roster.find(
				(rp) => rp.id === form.dropPlayerId
			)?.position;
			if (dropPos) {
				const key = normalizePosition(dropPos);
				if (counts[key] && counts[key] > 0) counts[key] -= 1;
			}
		}
		for (const limit of lg.positionLimits) {
			const key = normalizePosition(limit.position);
			const count = counts[key] ?? 0;
			if (limit.max > 0 && count > limit.max) {
				warnings.push(
					`Position limit: ${key} would be ${count} (max ${limit.max})`
				);
			}
		}

		return { label: `Roster after: ${afterCount}`, warnings };
	}

	async function submit(lg: PlayerActionLeague): Promise<void> {
		if (!player) return;
		const form = formFor(lg);
		if (form.submitting) return;
		const bidVal = parseFloat(form.bid);
		if (!Number.isFinite(bidVal) || bidVal <= 0) {
			form.error = 'Enter a valid bid amount';
			return;
		}
		form.submitting = true;
		form.error = null;
		form.success = null;
		try {
			const body: ActionRequest = {
				leagueId: lg.leagueId,
				playerId: player.id,
				action: 'bid',
				bid: form.bid,
				dropPlayerId: form.dropPlayerId || undefined
			};
			const res = await fetch('/api/mfl/action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const result = (await res.json()) as ActionResult;
			if (!res.ok || result.error) {
				form.error = result.error || 'Submission failed';
			} else {
				form.success = result.message || 'Submitted';
				onActionComplete?.();
				await loadActions();
			}
		} catch (err) {
			form.error = err instanceof Error ? err.message : 'Submission failed';
		} finally {
			form.submitting = false;
		}
	}

	async function withdraw(lg: PlayerActionLeague): Promise<void> {
		if (!player) return;
		const form = formFor(lg);
		if (form.submitting) return;
		form.submitting = true;
		form.error = null;
		form.success = null;
		try {
			const body: ActionRequest = {
				leagueId: lg.leagueId,
				playerId: player.id,
				action: 'withdraw'
			};
			const res = await fetch('/api/mfl/action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const result = (await res.json()) as ActionResult;
			if (!res.ok || result.error) {
				form.error = result.error || 'Withdrawal failed';
			} else {
				form.success = result.message || 'Bid withdrawn';
				onActionComplete?.();
				await loadActions();
			}
		} catch (err) {
			form.error = err instanceof Error ? err.message : 'Withdrawal failed';
		} finally {
			form.submitting = false;
		}
	}
</script>

{#if player}
	<div class="profile-backdrop" role="presentation" onclick={onclose}></div>
	<div
		class="profile-modal"
		role="dialog"
		aria-modal="true"
		aria-label={`${player.name} profile`}
	>
		<button
			type="button"
			class="profile-close"
			aria-label="Close"
			bind:this={closeBtn}
			onclick={onclose}>×</button
		>

		<div class="profile-header">
			<PlayerAvatar
				id={player.id}
				position={player.position}
				size="lg"
				alt={player.name}
			/>
			<div class="profile-header-info">
				<span class="profile-name">{player.name}</span>
				<span class="profile-meta">
					{#if player.position}
						<span class="position-badge" data-position={player.position}
							>{player.position}</span
						>
					{/if}
					<TeamChip team={player.team} />
					{#if player.rosterPct != null}
						<span class="roster-badge">{player.rosterPct.toFixed(1)}%</span>
					{/if}
					{#if exposure && exposure.total > 0}
						<span
							class="exposure-badge"
							title={`Owned in ${exposure.owned} of ${exposure.total} leagues`}
							>Exp {exposure.pct.toFixed(0)}% ({exposure.owned}/{exposure.total})</span
						>
					{/if}
				</span>
			</div>
		</div>

		<div class="profile-tabs" role="tablist">
			<button
				type="button"
				class="profile-tab"
				class:active={activeTab === 'profile'}
				role="tab"
				aria-selected={activeTab === 'profile'}
				onclick={() => selectTab('profile')}
			>
				Profile
			</button>
			<button
				type="button"
				class="profile-tab"
				class:active={activeTab === 'actions'}
				role="tab"
				aria-selected={activeTab === 'actions'}
				onclick={() => selectTab('actions')}
			>
				Actions
			</button>
		</div>

		{#if activeTab === 'profile'}
			{#if loading}
				<div class="profile-status">Loading profile...</div>
			{:else if error}
				<div class="profile-status profile-error">
					<span>{error}</span>
					<button type="button" class="profile-retry" onclick={load}
						>Try again</button
					>
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
						<span class="profile-stat-value"
							>{profile.player.height ?? '—'}</span
						>
					</div>
					<div class="profile-stat">
						<span class="profile-stat-label">Weight</span>
						<span class="profile-stat-value"
							>{profile.player.weight ?? '—'}</span
						>
					</div>
					<div class="profile-stat">
						<span class="profile-stat-label">ADP</span>
						<span class="profile-stat-value"
							>{isAdpMissing ? '—' : adpValue}</span
						>
					</div>
				</div>
				{#if player.availableIn}
					<div class="profile-avail">
						Available in {player.availableIn.length} league{player.availableIn
							.length === 1
							? ''
							: 's'}
					</div>
				{/if}
				<div class="profile-news">
					<span class="profile-news-title">Recent News</span>
					{#if newsArticles.length > 0}
						<ul class="profile-news-list">
							{#each visibleNews as article}
								<li class="profile-news-item">
									{#if article.id}
										<a
											class="profile-news-headline"
											href={`https://www.myfantasyleague.com/${year}/view_news_article?L=&ID=${encodeURIComponent(article.id)}`}
											target="_blank"
											rel="noopener noreferrer">{article.headline}</a
										>
									{:else}
										<span class="profile-news-headline">{article.headline}</span
										>
									{/if}
									{#if article.published}
										<span class="profile-news-time">{article.published}</span>
									{/if}
								</li>
							{/each}
						</ul>
						{#if totalNewsPages > 1}
							<div class="profile-news-pager">
								<button
									type="button"
									class="profile-news-arrow"
									aria-label="Previous page"
									disabled={newsPage === 0}
									onclick={() => {
										if (newsPage > 0) newsPage -= 1;
									}}>←</button
								>
								<span class="profile-news-page"
									>Page {newsPage + 1} of {totalNewsPages}</span
								>
								<button
									type="button"
									class="profile-news-arrow"
									aria-label="Next page"
									disabled={newsPage >= totalNewsPages - 1}
									onclick={() => {
										if (newsPage < totalNewsPages - 1) newsPage += 1;
									}}>→</button
								>
							</div>
						{/if}
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
		{:else}
			<div class="profile-actions">
				{#if actionsLoading}
					<div class="profile-status">Loading actions...</div>
				{:else if actionError}
					<div class="profile-status profile-error">
						<span>{actionError}</span>
						<button type="button" class="profile-retry" onclick={loadActions}
							>Try again</button
						>
					</div>
				{:else if actionContext.length === 0}
					<div class="profile-status">No leagues available</div>
				{:else}
					{#each actionContext as lg (lg.leagueId)}
						<div class="action-card">
							<div class="action-card-header">
								<span class="action-league-name">{lg.leagueName}</span>
								<span
									class="action-status"
									class:free={lg.playerStatus === 'freeAgent'}
									class:mine={lg.playerStatus === 'rostered' && lg.onMyRoster}
									class:blocked={lg.playerStatus === 'locked' ||
										lg.playerStatus === 'unknown'}>{statusLabel(lg)}</span
								>
							</div>

							{#if lg.bidSettings.waiverType === 'BBID'}
								<div class="action-settings">
									{#if lg.bbidAvailableBalance != null}
										<span
											>FAAB available:
											<strong>${lg.bbidAvailableBalance.toFixed(2)}</strong
											></span
										>
									{/if}
									{#if lg.bidSettings.seasonLimit != null}
										<span
											>Season limit: ${formatBid(
												String(lg.bidSettings.seasonLimit)
											)}</span
										>
									{/if}
									<span>Roster {lg.rosterSize}</span>
								</div>
							{/if}

							{#if lg.playerStatus === 'rostered' && lg.onMyRoster}
								<p class="action-note">
									Already on your roster. Drop {player?.name} by adding a different
									free agent and selecting them as the drop.
								</p>
							{:else if lg.playerStatus === 'rostered'}
								<p class="action-note">
									Rostered by another franchise — no action available.
								</p>
							{:else if lg.playerStatus === 'locked'}
								<p class="action-note">
									Locked free agent — cannot add right now.
								</p>
							{:else if lg.playerStatus === 'unknown'}
								<p class="action-note">
									Player status unavailable — no action available.
								</p>
							{:else}
								{#if lg.existingBid}
									<div class="action-existing-bid">
										<span>
											Current bid:
											<strong>${formatBid(lg.existingBid.bid)}</strong>
											{#if lg.existingBid.dropPlayerId}
												· drop {rosterPlayerName(
													lg,
													lg.existingBid.dropPlayerId
												)}
											{/if}
										</span>
									</div>
								{/if}

								{#if lg.bidSettings.waiverType === 'BBID'}
									<div class="action-bid-row">
										<button
											type="button"
											class="action-stepper"
											aria-label="Decrease bid"
											onclick={() => stepBid(lg, -1)}>−</button
										>
										<input
											class="action-bid-input"
											type="number"
											step="0.01"
											min="0"
											value={formFor(lg).bid}
											oninput={(e) =>
												setBid(lg, (e.currentTarget as HTMLInputElement).value)}
										/>
										<button
											type="button"
											class="action-stepper"
											aria-label="Increase bid"
											onclick={() => stepBid(lg, 1)}>+</button
										>
									</div>
									<div class="action-quick">
										{#each quickAmounts(lg) as amt}
											<button
												type="button"
												class="action-quick-btn"
												onclick={() => setBid(lg, amt.toFixed(2))}
												>${amt.toFixed(2)}</button
											>
										{/each}
									</div>
								{/if}

								<div class="action-drop-row">
									<label class="action-drop-label" for={`drop-${lg.leagueId}`}
										>Drop</label
									>
									<select
										id={`drop-${lg.leagueId}`}
										class="action-drop-select"
										value={formFor(lg).dropPlayerId}
										onchange={(e) =>
											setDrop(lg, (e.currentTarget as HTMLSelectElement).value)}
									>
										<option value="">No drop</option>
										{#each lg.roster.filter((rp) => rp.id !== player?.id) as rp (rp.id)}
											<option value={rp.id}
												>{rp.name || rp.id}{rp.status !== 'ROSTER'
													? ` (${rp.status})`
													: ''}</option
											>
										{/each}
									</select>
								</div>

								{#if impactPreview(lg)}
									<div
										class="action-preview"
										class:has-warning={impactPreview(lg)?.warnings.length}
									>
										<span>{impactPreview(lg)?.label}</span>
										{#each impactPreview(lg)?.warnings ?? [] as warning}
											<span class="action-preview-warning">⚠ {warning}</span>
										{/each}
									</div>
								{/if}

								<div class="action-submit-row">
									{#if lg.existingBid}
										<button
											type="button"
											class="action-withdraw"
											disabled={formFor(lg).submitting}
											onclick={() => withdraw(lg)}>Withdraw</button
										>
									{/if}
									<button
										type="button"
										class="action-submit"
										disabled={formFor(lg).submitting}
										onclick={() => submit(lg)}
									>
										{#if formFor(lg).submitting}
											Submitting...
										{:else if lg.bidSettings.waiverType === 'BBID'}
											{lg.existingBid ? 'Update bid' : 'Place bid'}
										{:else}
											Add player
										{/if}
									</button>
								</div>
							{/if}

							{#if formFor(lg).error}
								<div class="action-form-error">{formFor(lg).error}</div>
							{/if}
							{#if formFor(lg).success}
								<div class="action-form-success">{formFor(lg).success}</div>
							{/if}
						</div>
					{/each}
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
		width: min(92vw, 560px);
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

	.profile-tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1rem;
		border-bottom: 2px solid var(--border);
	}

	.profile-tab {
		padding: 0.45rem 0.9rem;
		font-size: 0.7rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		background: transparent;
		border: none;
		border-bottom: 3px solid transparent;
		margin-bottom: -2px;
		cursor: pointer;
	}

	.profile-tab:hover {
		color: var(--text-primary);
	}

	.profile-tab.active {
		color: var(--highlight);
		border-bottom-color: var(--highlight);
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

	.exposure-badge {
		font-size: var(--badge-font-size);
		font-weight: var(--badge-font-weight);
		color: var(--on-highlight);
		background: var(--highlight);
		border: 1px solid var(--border);
		border-radius: 0;
		padding: var(--badge-padding);
		white-space: nowrap;
		text-transform: uppercase;
		letter-spacing: var(--badge-letter-spacing);
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

	.profile-news-pager {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.profile-news-arrow {
		width: 1.75rem;
		height: 1.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.9rem;
		font-weight: 900;
		line-height: 1;
		color: var(--text-primary);
		background: var(--bg-secondary);
		border: 2px solid var(--border);
		cursor: pointer;
	}

	.profile-news-arrow:hover:not(:disabled) {
		color: var(--on-highlight);
		background: var(--highlight);
	}

	.profile-news-arrow:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.profile-news-page {
		font-size: 0.7rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
	}

	.profile-actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.action-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.6rem;
		background: var(--bg-secondary);
		border: 2px solid var(--border);
	}

	.action-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.action-league-name {
		font-size: 0.85rem;
		font-weight: 900;
		color: var(--text-primary);
	}

	.action-status {
		flex-shrink: 0;
		font-size: 0.6rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 0.2rem 0.4rem;
		color: var(--text-muted);
		border: 1px solid var(--border);
	}

	.action-status.free {
		color: var(--free-agent-color);
		border-color: var(--free-agent-color);
	}

	.action-status.mine {
		color: var(--waiver-color);
		border-color: var(--waiver-color);
	}

	.action-status.blocked {
		color: var(--drop-color);
		border-color: var(--drop-color);
	}

	.action-settings {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		font-size: 0.7rem;
		font-weight: 800;
		color: var(--text-muted);
	}

	.action-note {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.action-existing-bid {
		padding: 0.4rem 0.5rem;
		font-size: 0.8rem;
		color: var(--text-primary);
		background: var(--bg-paper);
		border: 1px dashed var(--border);
	}

	.action-bid-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.action-stepper {
		width: 2rem;
		height: 2.25rem;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.1rem;
		font-weight: 900;
		line-height: 1;
		color: var(--text-primary);
		background: var(--bg-paper);
		border: 2px solid var(--border);
		cursor: pointer;
	}

	.action-stepper:hover {
		color: var(--on-highlight);
		background: var(--highlight);
	}

	.action-bid-input {
		flex: 1;
		min-width: 0;
		height: 2.25rem;
		padding: 0 0.5rem;
		font-size: 1rem;
		font-weight: 800;
		color: var(--text-primary);
		background: var(--bg-paper);
		border: 2px solid var(--border);
	}

	.action-bid-input:focus {
		outline: 2px solid var(--highlight);
		outline-offset: 1px;
	}

	.action-quick {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.action-quick-btn {
		padding: 0.3rem 0.6rem;
		font-size: 0.7rem;
		font-weight: 900;
		color: var(--text-primary);
		background: var(--bg-paper);
		border: 2px solid var(--border);
		cursor: pointer;
	}

	.action-quick-btn:hover {
		color: var(--on-highlight);
		background: var(--highlight);
	}

	.action-drop-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.action-drop-label {
		flex-shrink: 0;
		font-size: 0.6rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
	}

	.action-drop-select {
		flex: 1;
		min-width: 0;
		height: 2rem;
		padding: 0 0.35rem;
		font-size: 0.8rem;
		color: var(--text-primary);
		background: var(--bg-paper);
		border: 2px solid var(--border);
	}

	.action-preview {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.4rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--text-primary);
		background: var(--bg-paper);
		border: 1px solid var(--border);
	}

	.action-preview.has-warning {
		border-color: var(--drop-color);
	}

	.action-preview-warning {
		font-weight: 800;
		color: var(--drop-color);
	}

	.action-submit-row {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.action-submit {
		padding: 0.45rem 1rem;
		font-size: 0.75rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--on-highlight);
		background: var(--highlight);
		border: 2px solid var(--border);
		cursor: pointer;
	}

	.action-submit:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.action-withdraw {
		padding: 0.45rem 1rem;
		font-size: 0.75rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--drop-color);
		background: var(--bg-paper);
		border: 2px solid var(--drop-color);
		cursor: pointer;
	}

	.action-withdraw:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.action-form-error {
		padding: 0.4rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--drop-color);
		background: var(--error-bg);
		border: 1px solid var(--error-border);
	}

	.action-form-success {
		padding: 0.4rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 800;
		color: var(--free-agent-color);
		background: var(--bg-paper);
		border: 1px solid var(--border);
	}
</style>
