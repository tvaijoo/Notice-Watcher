# CSIT Notice Watcher

CSIT Notice Watcher is a small Cloudflare Worker that checks the [Hamro CSIT](https://hamrocsit.com/notice/) notice page every 10 minutes, stores newly discovered notices in D1, and sends Discord notifications through a Queue so delivery stays asynchronous.

## Live Deployment

Worker: https://watcher.csitnotice.workers.dev

The deployed Worker runs independently of a local development machine.

## What It Does

Every Cron run calls the watcher, which first checks whether Hamro CSIT is reachable. If the site is up, the Worker scrapes the notice list, looks up each notice URL in D1, and only treats unseen URLs as new notices. New notices are fetched in detail, stored in D1, and then enqueued for Discord delivery. The first run marks the database as initialized so older notices do not get announced as if they were just published.

## Why D1

D1 is the right storage primitive here because the app keeps relational state: discovered notices, site health checks, and watcher initialization state. The `notices` table uses the notice URL as the unique identity, which prevents duplicate inserts and makes lookups simple. The `site_checks` table records every reachability check so failures are visible instead of being silently ignored. The `watcher_state` table stores whether the initial backfill has already happened.

KV would be a weaker fit because this data is not just simple read-heavy key-value state, and Durable Objects would add coordination that the app does not need.

## Why Queues

Discord delivery is intentionally offloaded to Cloudflare Queues because sending the webhook should not block notice detection. The watcher writes the notice to D1 first, then enqueues a message, and the queue consumer sends the Discord webhook afterward. If Discord fails, the consumer retries the message instead of failing the watcher request itself.

## Failure Handling

The Worker handles Hamro CSIT outages by recording a failed site check and stopping the run without creating fake notices or queue messages. The Queue consumer also handles downstream Discord failures by retrying the message when the webhook response is not successful. That gives the system one clear failure path for the source site and one for notification delivery.

## Cloudflare Resources

- Workers for request handling and scheduled execution
- Cron Triggers for the 10-minute schedule
- D1 for relational persistent state
- Queues for asynchronous Discord notification delivery

## Local Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Type-check:

```bash
npx tsc --noEmit
```

Deploy:

```bash
npm run deploy
```

## Repository Structure

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