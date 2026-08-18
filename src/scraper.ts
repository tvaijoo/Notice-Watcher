import * as cheerio from "cheerio";

const NOTICE_URL = "https://hamrocsit.com/notice/";

export interface ScrapedNotice {
	url: string;
	title: string;
	category: string;
}

export interface NoticeDetails {
	publishedAt: string | null;
	pdfUrl: string | null;
}

export async function scrapeNoticeDetails(
	url: string,
): Promise<NoticeDetails> {
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(
			`Failed to fetch notice ${url}: HTTP ${response.status}`,
		);
	}

	const html = await response.text();
	const $ = cheerio.load(html);

	const publishedAt =
		$("li[title]").filter((_, element) => {
			return $(element).find(".fa-clock-o").length > 0;
		}).first().attr("title") ?? null;

	let pdfUrl: string | null = null;

	$("script").each((_, element) => {
		const script = $(element).html() ?? "";

		const match = script.match(
			/'code'\s*:\s*"([^"]+\.pdf)"/i,
		);

		if (match) {
			pdfUrl = match[1];
		}
	});

	return {
		publishedAt,
		pdfUrl,
	};
}

export async function scrapeNotices(): Promise<ScrapedNotice[]> {
	const response = await fetch(NOTICE_URL);

	if (!response.ok) {
		throw new Error(
			`Hamro CSIT returned HTTP ${response.status}`
		);
	}

	const html = await response.text();
	const $ = cheerio.load(html);

	const notices: ScrapedNotice[] = [];

	$("div.col-md-4").each((_, element) => {
		const link = $(element).find("a[href]").first();

		const url = link.attr("href")?.trim();
		const title = $(element).find("h5").first().text().trim();
		const category = $(element).find("h6").first().text().trim();

		if (!url || !title || !category) {
			return;
		}

		notices.push({
			url,
			title,
			category,
		});
	});

	return notices;
}