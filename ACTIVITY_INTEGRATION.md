# Activity + sync

`CatalogRequest` now records durable `ActivityEvent` rows in the same database transaction:

- `REQUEST_CREATED` (and `CORRECTION_REQUESTED` for correction links)
- `REQUEST_STARTED` (once only, including the implicit start on first save)
- `REQUEST_SUBMITTED` (and `CORRECTION_RESOLVED` for correction links)

The external importer is intentionally represented by `actorUserId: null`; no actor identity is accepted from the bearer-link browser. Metadata is structured and never contains raw link tokens or submitted field values.

The same transactions create in-app notifications. `Notification.userId` is no longer unique, so a user can receive a history of notifications. API:

- `GET /api/notifications`
- `PATCH /api/notifications/:notificationId` marks one of the authenticated user's notifications read.

Activity API:

- `GET /api/activities`
- `GET /api/activities?filters=true`

Dispatcher access is limited by `CustomsBrokerCompanyAccess`; importers are constrained to their own company and never receive `DISPATCHER_ONLY` or `SYSTEM_INTERNAL` events.
