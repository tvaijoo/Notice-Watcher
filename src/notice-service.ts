import {
	getNoticeByUrl,
	insertNotice,
} from "./database";

import {
	scrapeNoticeDetails,
	type ScrapedNotice,
} from "./scraper";

import { sha256 } from "./hash";
import { sendDiscordNotification } from "./discord";

export interface NewNotice {
	notice: ScrapedNotice;
	publishedAt: string | null;
	pdfUrl: string | null;
	detectedAt: string;
}

export async function processNotice(
	db: D1Database,
	webhookUrl: string,
	notice: ScrapedNotice,
	silent = false,
): Promise<NewNotice | null> {
	const existing = await getNoticeByUrl(db, notice.url);

	const detectedAt = new Date().toISOString();

	// Already known → do nothing.
	if (existing) {
		return null;
	}

	// Get details from the individual notice page.
	const details = await scrapeNoticeDetails(notice.url);

	// Our v1 identity hash is based on the unique notice URL.
	const contentHash = await sha256(notice.url);

	// Save the notice first.
	await insertNotice(
		db,
		notice,
		details.publishedAt,
		details.pdfUrl,
		detectedAt,
		contentHash,
	);

	// Notify Discord only after the database insert succeeds.
if (!silent) {
	await sendDiscordNotification(
		webhookUrl,
		{
			title: notice.title,
			category: notice.category,
			url: notice.url,
			publishedAt: details.publishedAt,
			detectedAt,
			pdfUrl: details.pdfUrl,
		},
	);
}

	return {
		notice,
		publishedAt: details.publishedAt,
		pdfUrl: details.pdfUrl,
		detectedAt,
	};
}