/**
 * PLACEHOLDER — this file is generated, never hand-written.
 *
 * Once the project is linked, overwrite it with:
 *   npx supabase gen types typescript --linked > src/lib/database.types.ts
 *
 * The stub below only exists so the app typechecks before that first run.
 */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
	public: {
		Tables: {
			[key: string]: {
				Row: Record<string, Json>;
				Insert: Record<string, Json>;
				Update: Record<string, Json>;
				Relationships: [];
			};
		};
		Views: Record<never, never>;
		Functions: Record<never, never>;
		Enums: Record<never, never>;
		CompositeTypes: Record<never, never>;
	};
};
