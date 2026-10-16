# Jora partner portal — Supabase conversion

This is the complete pasted delivery-partner portal with the Firebase SDK and all Firebase/Firestore references removed. Its login, registration, location, documents, dashboard, order, handover, customer-confirmation, wallet, and map screens are retained.

## Configure

1. In your Supabase project, run `supabase/migrations/0001_delivery_partner_documents.sql`.
2. In Supabase Authentication, enable Email + Password. For immediate access while testing, disable email confirmation or finish the confirmation link flow.
3. Copy the values from your `.env` into `supabase-config.js`. Use only the project URL and publishable browser key. Never use a service-role key in this application.
4. Serve this folder through a web server; do not open the HTML with `file://`, because authentication and realtime connections require an origin.

## Shared order workflow

- Vendor: after packing an order, call `assign_delivery_partner(orderId, partnerId)`. The order becomes `Assigned` and the partner receives it through Supabase Realtime.
- Partner: accepts the assignment, reaches the shop, waits for vendor handover, reaches the customer, and submits delivery proof. Live status and position updates remain available to the vendor/customer through the same `orders` document.
- Vendor: marks `shopHandoverConfirmed: true` after handing over the parcel; the partner portal then unlocks the customer leg.
- Customer: call `confirm_order_delivery(orderId)` from the customer app. This is the server-side final transition to `Delivered`, so the partner wallet can settle only after customer confirmation.

The delivery UI reads and writes `jora_documents`, a controlled Supabase table that preserves the original portal's field names. The RLS rules restrict a partner to their own profile, assigned orders, and settlement records.

## Checks completed

- All inline scripts and both new Supabase files pass JavaScript syntax checks.
- No Firebase or Firestore imports/references remain in the delivered folder.

Live authentication, RLS, realtime, and the cross-app vendor/customer calls still need to be tested after the SQL is applied to the target Supabase project.
