import type { ScrapedNotice } from "./scraper";

export async function getNoticeByUrl(
	db: D1Database,
	url: string,
) {
	return db
		.prepare(
			`SELECT id, url, title, category, pdf_url, published_at,
			        detected_at, first_seen_at, last_seen_at, content_hash
			 FROM notices
			 WHERE url = ?`,
		)
		.bind(url)
		.first();
}

export async function isInitialized(
	db: D1Database,
): Promise<boolean> {
	const row = await db
		.prepare(
			`SELECT value
			 FROM watcher_state
			 WHERE key = 'initialized'`,
		)
		.first<{ value: string }>();

	return row?.value === "true";
}

export async function markInitialized(
	db: D1Database,
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO watcher_state (key, value)
			 VALUES ('initialized', 'true')
			 ON CONFLICT(key)
			 DO UPDATE SET value = 'true'`,
		)
		.run();
}

export async function insertNotice(
	db: D1Database,
	notice: ScrapedNotice,
	publishedAt: string | null,
	pdfUrl: string | null,
	detectedAt: string,
	contentHash: string | null,
) {
	await db
		.prepare(
			`INSERT INTO notices (
				url,
				title,
				category,
				pdf_url,
				published_at,
				detected_at,
				first_seen_at,
				last_seen_at,
				content_hash
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			notice.url,
			notice.title,
			notice.category,
			pdfUrl,
			publishedAt,
			detectedAt,
			detectedAt,
			detectedAt,
			contentHash,
		)
		.run();
}