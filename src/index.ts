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

		return Response.json({
			status: 'running',
			service: 'CSIT Notice Watcher',
			monitor: 'https://hamrocsit.com/notice/',
			checkInterval: '10 minutes',
			storage: 'Cloudflare D1',
			processing: 'Cloudflare Queues',
			notifications: 'Discord Webhook',
			endpoints: {
				testDb: '/api/test-db',
				scrapeTest: '/api/scrape-test',
				noticeDetails: '/api/notice-details?url=...',
				check: '/api/check',
				testQueue: '/api/test-queue',
				testDiscord: '/api/test-discord',
				runWatcher: '/api/run-watcher',
			},
		});
	},

	//cron trigger calls this part
	async scheduled(event, env, ctx): Promise<void> {
		ctx.waitUntil(runWatcher(env));
	},

	async queue(batch, env): Promise<void> {
		for (const message of batch.messages) {
			try {
				const data = message.body as {
					notice: {
						title: string;
						category: string;
						url: string;
					};
					publishedAt: string | null;
					pdfUrl: string | null;
					detectedAt: string;
				};

				await sendDiscordNotification(env.DISCORD_WEBHOOK_URL, {
					title: data.notice.title,
					category: data.notice.category,
					url: data.notice.url,
					publishedAt: data.publishedAt,
					detectedAt: data.detectedAt,
					pdfUrl: data.pdfUrl,
				});

				message.ack();

				console.log('Discord notification sent:', data.notice.url);
			} catch (error) {
				console.error('Failed to send Discord notification:', error);

				message.retry();
			}
		}
	},
} satisfies ExportedHandler<Env>;
