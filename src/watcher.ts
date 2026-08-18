import { scrapeNotices } from "./scraper";
import { processNotice } from "./notice-service";
import {
	isInitialized,
	markInitialized,
} from "./database";

export async function runWatcher(
	env: Env,
): Promise<{
	checked: number;
	newNotices: number;
}> {
	const checkedAt = new Date().toISOString();

	try {
		const response = await fetch("https://hamrocsit.com/notice/", {
			method: "HEAD",
		});

		if (!response.ok) {
			await recordSiteCheck(
				env.csit_notice_db,
				checkedAt,
				"down",
				response.status,
				`HTTP ${response.status}`,
			);

			return {
				checked: 0,
				newNotices: 0,
			};
		}
	} catch (error) {
		await recordSiteCheck(
			env.csit_notice_db,
			checkedAt,
			"down",
			null,
			error instanceof Error ? error.message : String(error),
		);

		return {
			checked: 0,
			newNotices: 0,
		};
	}

	await recordSiteCheck(
		env.csit_notice_db,
		checkedAt,
		"up",
		200,
		null,
	);

	const notices = await scrapeNotices();
const initialized = await isInitialized(
	env.csit_notice_db,
);
if (!initialized) {
	for (const notice of notices) {
		await processNotice(
			env.csit_notice_db,
			notice,
		);
	}

	await markInitialized(env.csit_notice_db);

	return {
		checked: notices.length,
		newNotices: 0,
	};
}
	let newNotices = 0;

for (const notice of notices) {
	const result = await processNotice(
		env.csit_notice_db,
		notice,
	);

	if (result) {
		await env.NOTICE_QUEUE.send(result);
		newNotices++;
	}
}

	return {
		checked: notices.length,
		newNotices,
	};
}

async function recordSiteCheck(
	db: D1Database,
	checkedAt: string,
	status: string,
	responseStatus: number | null,
	error: string | null,
) {
	await db
		.prepare(
			`INSERT INTO site_checks
			(checked_at, status, response_status, error)
			VALUES (?, ?, ?, ?)`,
		)
		.bind(
			checkedAt,
			status,
			responseStatus,
			error,
		)
		.run();
}