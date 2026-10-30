# LMS mobile sync overlays (Part B — risk / ML)

Applied on `uwezo-lms-app` for constituency phone parity with live `ApplicationView` scoring.

## Changes

1. **Snapshot temp fields** — `phase_applications` rows include `group_name`, `nature_of_business` / `business_name`, `ward_name`, `constituency_name`, `risk_level`, and `assessment_data` from `temp_applications`.
2. **`POST /app/mobile/score`** — scores via `RepaymentScoreClient` (`/v1/score/intake`) and persists `risk_level` + merged `assessment_data` on the temp application.
3. **Mutation `application.score`** — same persist path for outbox push when the dedicated route is unavailable.

Snippets in this folder document the patched regions; re-apply against `MobileSyncController.php` + `routes/web.php` when rebuilding LMS.
