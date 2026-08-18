export interface DiscordNotice {
	title: string;
	category: string;
	url: string;
	publishedAt: string | null;
	detectedAt: string;
	pdfUrl: string | null;
}

export async function sendDiscordNotification(
	webhookUrl: string,
	notice: DiscordNotice,
): Promise<void> {
	const message = {
		username: "CSIT Notice Watcher",
		content: "New CSIT notice published.",
		embeds: [
			{
				title: notice.title,
				url: notice.url,
				description:
					"A new notice has been detected on Hamro CSIT.",
				fields: [
					{
						name: "Category",
						value: notice.category || "Unknown",
						inline: true,
					},
					{
						name: "Published at",
						value: notice.publishedAt ?? "Not available",
						inline: true,
					},
					{
						name: "Detected at",
						value: notice.detectedAt,
						inline: true,
					},
					{
						name: "Notice",
						value: `[Open notice](${notice.url})`,
						inline: false,
					},
					{
						name: "PDF",
						value: notice.pdfUrl
							? `[Open PDF](${notice.pdfUrl})`
							: "PDF not available",
						inline: false,
					},
				],
			},
		],
	};

	const response = await fetch(webhookUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(message),
	});

	if (!response.ok) {
		const body = await response.text();

		throw new Error(
			`Discord webhook failed: HTTP ${response.status} ${body}`,
		);
	}
}