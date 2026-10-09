# Admin email forwarding

`POST /api/resend-inbound` forwards received mail addressed to `admin@reelbot.movie`
to the single administrator Gmail configured in `ADMIN_EMAIL_TO`. It is disabled
by default. No browser code or recommendation path calls this endpoint.

The handler verifies the untouched request bytes using Resend's official SDK,
retrieves the received message and every attachment page, and sends from
`ReelBot Admin <admin@reelbot.movie>`. The forwarded body identifies the original
sender and preserves text/HTML, attachments, and inline content IDs. The original
To/Cc/Bcc can never change the delivery destination. Only explicit To/Cc/Bcc admin
recipients are supported; headers such as `Received` or `Delivered-To` are not
trusted routing instructions.

Reply-To uses a single valid original sender, or its same-domain Reply-To address.
Ambiguous addresses, ReelBot addresses, and a reported DMARC failure do not get
Reply-To. Cross-domain Reply-To falls back to the original sender. This is not a
guarantee of sender identity. Incoming mail from admin itself, our forwarding
markers, automatic replies, and null-return-path delivery reports are suppressed
to prevent loops. Other automatic receipts and messages from alerts/feedback are
eligible for forwarding.

## Before an approved deployment

1. Recheck the live `reelbot.movie` deployment and current main branch. This work
   started from production `8b0d2b4ad015911be5dac14524156eafb6eeafd6`, which includes
   the analytics release. Preserve any later release changes when integrating.
2. Apply `scripts/supabase_admin_email_forwarding.sql` to the existing Supabase
   project. It creates only a private metadata ledger and three service-role RPCs.
   It does not touch feedback, analytics, recommendations, or existing data.
3. Configure **production-only**, server-side Vercel variables:

   | Variable | Value |
   | --- | --- |
   | `ADMIN_EMAIL_TO` | Exact existing Gmail destination used by signup alerts; verify against the current notification configuration, not a new recipient. |
   | `RESEND_INBOUND_API_KEY` | Dedicated Resend key with Receiving access and sending permission for the verified domain. A Sending-only key is insufficient. |
   | `RESEND_WEBHOOK_SECRET` | Signing secret of this specific Resend webhook. |
   | `SUPABASE_URL` | Existing project URL. |
   | `SUPABASE_SECRET_KEY` | Existing server secret (`SUPABASE_SERVICE_ROLE_KEY` is also supported). |
   | `ADMIN_EMAIL_FORWARDING_ENABLED` | `true` only when ready to activate. |

   Keep credentials in Vercel secrets, never `REACT_APP_`/`NEXT_PUBLIC_` variables,
   Git, command-line arguments, or logs. Preview deployments always return 503.
4. Create a Resend webhook subscribed **only to `email.received`** at
   `https://reelbot.movie/api/resend-inbound`. Keep it disabled until the approved
   production deployment is ready and the signing secret is installed. Do not
   change MX/DNS: existing receiving/sending verification is sufficient.
5. Use the existing approved GitHub release workflow. Pushing this branch may
   automatically create a Vercel deployment; do not push or deploy without approval.
6. Enable the webhook, send a uniquely identified test to admin, and confirm one
   Gmail delivery with sender name/address, body, a PDF, and an inline image.
   Check the actual Gmail Reply action's destination. Replay the same event twice
   and concurrently: there must still be one delivery. Verify a different mailbox
   is ignored. Use a separate test environment for forced provider/database errors.
   Check independent PostgreSQL-session contention before rollout; local PGlite
   tests validate SQL but serialize database connections.

## Failure handling and operations

The Supabase ledger permanently deduplicates by Resend receiving email ID, with a
two-minute worker lease. Each send also uses a stable Resend idempotency key and
payload hash. Rate-limit and concurrent-idempotency errors retry the same provider
operation up to three times with bounded, abortable waits honoring response headers.
Longer waits and other transient failures return 503 for Resend webhook retries.
Sent/ignored duplicates return 200. Oversized or rejected messages are retained
as `review_required`, never silently forwarded with missing attachments. A
30 MiB serialized-payload cap leaves room below Resend's 40 MB MIME limit; at most
100 attachments are processed. Downloads allow only HTTPS on
`inbound-cdn.resend.com`, without redirects or API credentials. Other CDN URLs
require explicit review of provider support before changing the allowlist.

Resend's send idempotency expires after 24 hours. If a send outcome remains
uncertain for 23 hours, automatic resending stops and requires reconciliation.
Changes to destination/content during a retry also require review. Do not delete
ledger rows, change idempotency keys, or reset the first-send time to force a retry.
Inspect the receiving email and outgoing send in the Resend dashboard first;
reconcile confirmed sends before attempting an operator-approved resend.
See Resend's [idempotency contract](https://resend.com/docs/dashboard/emails/idempotency-keys),
[signature verification](https://resend.com/docs/webhooks/verify-webhooks-requests),
and [received-message API](https://resend.com/docs/api-reference/emails/retrieve-received-email).

Monitor Vercel `admin_email_forwarding` errors, Resend failed webhook deliveries,
and ledger rows with `state = 'review_required'`. Logs contain only a fixed error
code and hashed reference. The ledger contains IDs/hashes/timestamps/status, never
message content, addresses, filenames, or credentials. A successful send means
Resend accepted it; check Resend delivery status and Gmail for actual delivery.

Run `node --test server/adminEmail*.test.js` for signed-request, forwarding,
failure, deduplication, and SQL permission checks; `npm run test:pages` includes
these plus existing server regressions. PGlite is a development-only dependency.

## Existing feedback notifications

Feedback inserts into Supabase `public.feedback` from `src/components/FeedbackModal.js`.
Read-only inspection of the live Supabase project on October 9, 2026 found one
active Edge Function, `super-api` version 2. It handles both `feedback` and `users`,
reads `RESEND_API_KEY` and `REELBOT_ALERT_EMAIL`, and uses the shared hardcoded sender
`ReelBot <alerts@reelbot.movie>` for both paths. It contains no `onboarding@resend.dev`
sender. Both enabled database triggers (`auth.users` signup and `public.feedback`
feedback) call this same function; neither calls Resend directly or specifies a
sender. Version 2 was last updated September 29, 2026 at 11:53 AM EDT. The reported
onboarding-sender message cannot be attributed without its timestamp/delivery
evidence, but it does not match the current deployed configuration. No separate
sender environment variable exists: a feedback-only sender change needs a small
conditional code change and an approved Edge Function deployment. No feedback
sender change is included here; the existing signup workflow remains intact.

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
