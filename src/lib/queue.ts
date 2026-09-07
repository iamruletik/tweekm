import { get, set } from 'idb-keyval';
import { supabase } from './supabase';
import type { Database } from './database.types';

type EntryRow = Database['public']['Tables']['entries']['Insert'];

const KEY = 'ruletik:pending-writes';

/**
 * Offline write queue. One array of pending upserts in IndexedDB — nothing
 * relational client-side, which is why this is idb-keyval and not Dexie.
 *
 * Idempotency comes from the client-generated UUID PK on `entries`: retrying
 * an upsert can't create a duplicate row.
 */
let flushing = false;

async function read(): Promise<EntryRow[]> {
	return (await get<EntryRow[]>(KEY)) ?? [];
}

/** Enqueue on every edit. Same id replaces an unflushed write for that cell. */
export async function enqueue(row: EntryRow): Promise<void> {
	const pending = await read();
	const i = pending.findIndex((p) => p.id === row.id);
	if (i === -1) pending.push(row);
	else pending[i] = row;
	await set(KEY, pending);
	void flush();
}

/**
 * Flush pending writes oldest-first.
 * - 4xx → drop the item (bad data, retrying won't help)
 * - 5xx / network → leave it queued and retry on the next flush
 */
export async function flush(): Promise<void> {
	if (flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
	flushing = true;
	try {
		let pending = await read();
		while (pending.length > 0) {
			const row = pending[0];
			try {
				const { error } = await supabase.from('entries').upsert(row);
				if (error) {
					const status = Number((error as { status?: number }).status ?? 0);
					// Non-4xx (incl. unknown/network) stays queued for the next flush.
					if (status < 400 || status >= 500) break;
					console.warn('dropping unwritable entry', row.id, error.message);
				}
			} catch {
				break; // network failure — keep it queued
			}
			pending = (await read()).filter((p) => p.id !== row.id);
			await set(KEY, pending);
		}
	} finally {
		flushing = false;
	}
}

/** Call once from the root layout. */
export function startQueue(): () => void {
	const onVisible = () => {
		if (document.visibilityState === 'visible') void flush();
	};
	window.addEventListener('online', flush);
	document.addEventListener('visibilitychange', onVisible);
	void flush();
	return () => {
		window.removeEventListener('online', flush);
		document.removeEventListener('visibilitychange', onVisible);
	};
}

/** Round to the nearest 0.25 — always on blur, before anything is queued. */
export function roundHours(value: number): number {
	return Math.round(value * 4) / 4;
}
