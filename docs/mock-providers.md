# Mock Provider Sandbox

The core release can be tested without choosing live integration vendors. An opt-in, authenticated **Provider Demo** workspace mimics provider responses using synthetic fixtures and persisted operation history. It never contacts external providers.

## Enable Locally

Use a disposable development/test database, not a production database. Apply migrations through `0007_mock_provider_operations`, then start the backend with:

```powershell
$env:APP_ENV='development'
$env:MOCK_PROVIDERS_ENABLED='true'
python -m alembic upgrade head
python -m uvicorn app.main:app --port 3000
```

Sign in normally. **Provider Demo** appears in desktop/mobile navigation, and an environment banner identifies simulations. Set `MOCK_PROVIDERS_ENABLED=false` and restart to hide/disable the sandbox. The default is false; production startup rejects true. Endpoints also deny access if production mode is detected at request time.

Mock mode is not authentication bypass and does not pretend to be OAuth. Existing SMTP/OAuth configuration belongs to the separate core authentication/support workflows; the sandbox does not silently intercept password-reset messages or provider credentials. Use synthetic accounts and keep real provider credentials out of demo environments.

## Supported Simulations

| Provider | Operations | Effects and limits |
| --- | --- | --- |
| Job board | Discover, save | Returns three explicitly labeled sample vacancies with reserved `.invalid` URLs. Explicit save creates one labeled manual tracker record per fixture/user. No live crawling or employer data. |
| Profile | Connect, sync, disconnect | Persists isolated demo connection state for GitHub/LinkedIn; sync requires connection and returns a stable synthetic achievement ID. Never connects an account or edits a resume. |
| Applications | Submit an approved packet | Requires an owned, approved packet whose saved resume still matches its snapshot. Returns a replay-safe mock receipt. Never submits externally or changes the real job to applied. |
| Billing | Checkout, cancel | Persists isolated simulated subscription state and a zero-charge receipt. No card details, real payment, paid entitlement or quota change. |
| Email | Send to demo outbox | Stores a fixed synthetic message to `candidate@example.invalid` in the user's operation history. No SMTP call, real delivery or password-reset token. |

Every operation supports success, failure and timeout scenarios. A timeout is an immediate deterministic provider-failure result, not a real network wait. Failed scenarios do not apply successful effects. Repeat a failed scenario with a new request key to test recovery under a success scenario.

## API Contract

- `GET /providers/capabilities`: public mode/availability only, no credentials.
- `GET /providers/demo/state`: authenticated per-user demo connection/subscription state.
- `GET /providers/demo/operations?limit=20&offset=0`: authenticated, paginated owned history.
- `POST /providers/demo/execute`: authenticated operation request.

Example request:

```json
{
  "provider": "jobs",
  "action": "discover",
  "scenario": "success",
  "idempotencyKey": "local-demo-request-0001"
}
```

Profile requests use `subjectId: "github"` or `"linkedin"`. Saving a sample job uses its fixture ID. Application simulation uses a saved job ID. Billing accepts `plan: "pro_monthly"` or `"pro_yearly"`.

Reuse a request key only for the same provider/action/inputs. Exact replay returns the original operation; different inputs with the same key return 409. Saved sample jobs and simulated submissions additionally deduplicate their successful effect across different request keys. Per-user row locks and database uniqueness enforce these rules. The UI retains the request key after a network error, so retry does not accidentally repeat an operation.

Each result includes `mode: "mock"`; receipts are prefixed `mock-receipt-`. Operation history is included in full-account export and deletion. Ordinary career-only deletion does not delete account-wide provider history. Disabled sandbox endpoints return 404; enabled endpoints still require normal authentication and ownership checks.

## Later Live Integration

The mock fixture generator is isolated in `services/app/services/mock_providers.py`; persistence and ownership/approval checks live in the provider-demo API. No vendor SDK or credential is required. Implement real adapters with their own explicit availability/configuration and verified provider events, then test contract parity and staging behavior. Do not rename a mock receipt or reuse demo subscription state as proof of payment/delivery.

Real discovery/consent, profile merge/review, payment webhooks, delivery retries, external application receipts, scheduled reminders and provider-specific failure recovery remain future integration work. This sandbox is test infrastructure, not completion of those live services.
