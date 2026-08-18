# CSIT Notice Watcher

A small serverless monitoring system that checks the [Hamro CSIT](https://hamrocsit.com/notice/) notice page every 10 minutes, detects newly published notices, stores them in Cloudflare D1, and sends detailed notifications to Discord through Cloudflare Queues.

## Live Deployment

**Worker:** https://watcher.csitnotice.workers.dev

The Worker is deployed on Cloudflare and runs independently of a local development machine.

---

## What It Does

CSIT Notice Watcher automatically monitors the Hamro CSIT notice page for new notices.

Every 10 minutes, a Cloudflare Cron Trigger invokes the Worker. The Worker checks whether the Hamro CSIT website is reachable and then scrapes the notice listing.

Each notice is identified by its unique notice URL. If the URL has not previously been stored, the Worker fetches the individual notice page to obtain additional information such as:

- Notice title
- Category
- Notice URL
- Published time
- PDF URL, when available
- Detection time

The notice is stored in Cloudflare D1 and a notification message is then placed onto a Cloudflare Queue. The Queue consumer processes the message asynchronously and sends the notification to Discord.

---

## Architecture

```text
                 Cloudflare Cron Trigger
                         │
                         │ every 10 minutes
                         ▼
                ┌───────────────────┐
                │ Cloudflare Worker │
                │    runWatcher()   │
                └─────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │  Hamro CSIT      │
                 │  Notice Page     │
                 └────────┬─────────┘
                          │
                    New notice?
                       /     \
                     No       Yes
                     │         │
                     │         ▼
                     │   ┌──────────────┐
                     │   │ Cloudflare D1│
                     │   │   Database   │
                     │   └──────┬───────┘
                     │          │
                     │          ▼
                     │   ┌──────────────┐
                     │   │ Cloudflare   │
                     │   │    Queue     │
                     │   └──────┬───────┘
                     │          │
                     │          ▼
                     │   ┌──────────────┐
                     │   │ Queue        │
                     │   │ Consumer     │
                     │   └──────┬───────┘
                     │          │
                     │          ▼
                     │   ┌──────────────┐
                     │   │ Discord      │
                     │   │ Webhook      │
                     │   └──────────────┘
                     │
                     ▼
                    Done