export const FA_POSITIONS = [
	'ALL',
	'QB',
	'RB',
	'WR',
	'TE',
	'K',
	'DST',
	'DT',
	'DE',
	'LB',
	'CB',
	'S'
] as const;

export const DAY_OPTIONS = [
	{ value: '1', label: '1 day' },
	{ value: '7', label: '7 days' },
	{ value: '14', label: '14 days' },
	{ value: '30', label: '30 days' },
	{ value: 'all', label: 'All (current year)' }
] as const;

export const SORT_OPTIONS = [
	{ value: 'roster', label: 'Roster %' },
	{ value: 'adp', label: 'ADP' }
] as const;

export type DaysOption = (typeof DAY_OPTIONS)[number]['value'];
export type SortOption = (typeof SORT_OPTIONS)[number]['value'];
export type PositionOption = (typeof FA_POSITIONS)[number];
