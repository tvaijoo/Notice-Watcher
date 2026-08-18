/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { scrapeNoticeDetails, scrapeNotices } from './scraper';
import { processNotice } from './notice-service';
import { sendDiscordNotification } from './discord';
import { runWatcher } from './watcher';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/api/test-db') {
			const result = await env.csit_notice_db.prepare('SELECT COUNT(*) AS count FROM notices').first<{ count: number }>();

			return Response.json({
				success: true,
				noticeCount: result?.count ?? 0,
			});
		}

		if (url.pathname === '/api/scrape-test') {
			try {
				const notices = await scrapeNotices();

				return Response.json({
					success: true,
					count: notices.length,
					notices,
				});
			} catch (error) {
				return Response.json(
					{
						success: false,
						error: error instanceof Error ? error.message : String(error),
					},
					{ status: 500 },
				);
			}
		}
		if (url.pathname === '/api/notice-details') {
			const noticeUrl = url.searchParams.get('url');

			if (!noticeUrl) {
				return Response.json(
					{
						success: false,
						error: 'Missing ?url= parameter',
					},
					{ status: 400 },
				);
			}

			try {
				const details = await scrapeNoticeDetails(noticeUrl);

				return Response.json({
					success: true,
					url: noticeUrl,
					...details,
				});
			} catch (error) {
				return Response.json(
					{
						success: false,
						error: error instanceof Error ? error.message : String(error),
					},
					{ status: 500 },
				);
			}
		}

		if (url.pathname === '/api/check') {
			if (!env.DISCORD_WEBHOOK_URL) {
				return Response.json(
					{
						success: false,
						error: 'DISCORD_WEBHOOK_URL is not configured',
					},
					{ status: 500 },
				);
			}

			try {
				const notices = await scrapeNotices();

				const newNotices = [];

				for (const notice of notices) {
					const result = await processNotice(env.csit_notice_db, env.DISCORD_WEBHOOK_URL, notice);

					if (result) {
						newNotices.push(result);
					}
				}

				return Response.json({
					success: true,
					checked: notices.length,
					new: newNotices.length,
					newNotices,
				});
			} catch (error) {
				return Response.json(
					{
						success: false,
						error: error instanceof Error ? error.message : String(error),
					},
					{ status: 500 },
				);
			}
		}

		if (url.pathname === '/api/test-discord') {
			if (!env.DISCORD_WEBHOOK_URL) {
				return Response.json(
					{
						success: false,
						error: 'DISCORD_WEBHOOK_URL is not configured',
					},
					{ status: 500 },
				);
			}

			try {
				const detectedAt = new Date().toISOString();

				await sendDiscordNotification(env.DISCORD_WEBHOOK_URL, {
					title: 'CSIT Notice Watcher - Test Notification',
					category: 'Test',
					url: 'https://hamrocsit.com/notice/',
					publishedAt: detectedAt,
					detectedAt,
					pdfUrl: null,
				});

				return Response.json({
					success: true,
					message: 'Discord notification sent.',
				});
			} catch (error) {
				return Response.json(
					{
						success: false,
						error: error instanceof Error ? error.message : String(error),
					},
					{ status: 500 },
				);
			}
		}

		if (url.pathname === '/api/run-watcher') {
			try {
				const result = await runWatcher(env);

				return Response.json({
					success: true,
					...result,
				});
			} catch (error) {
				return Response.json(
					{
						success: false,
						error: error instanceof Error ? error.message : String(error),
					},
					{ status: 500 },
				);
			}
		}

		return new Response('Hello World!');
	},

	//cron trigger calls this part
	async scheduled(event, env, ctx): Promise<void> {
		ctx.waitUntil(runWatcher(env));
	},
} satisfies ExportedHandler<Env>;
