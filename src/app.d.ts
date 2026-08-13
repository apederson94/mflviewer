// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		interface PageData {
			loggedIn: boolean;
			leagues: Array<{ id: string; name: string }>;
			week: number;
			year: string;
			error?: string;
			players: Array<
				[
					string,
					{
						name: string;
						position: string;
						team?: string;
						rosterPct?: number;
						adp?: string;
					}
				]
			>;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
