-- ONLY READS. Does not invoke application code, process queues or send emails.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT id, name, active, activated_at, delay_hours,
       (SELECT max(sent_at) FROM email_send_logs l
        WHERE l.automation_id = a.id AND l.status = 'SENT') AS last_sent_at_utc
FROM email_automations a WHERE trigger = 'POST_PURCHASE';

-- Reproduce the old selection: first 300 by creation, event delay, then 100.
-- Ties in created_at were not deterministic in the old application.
WITH eligible AS (
  SELECT a.id AS automation_id, a.name, o.id AS order_id,
         o.public_order_number, o.created_at,
         coalesce(o.paid_at, p.last_proof_at) AS event_at,
         (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - make_interval(hours => a.delay_hours) AS ready_at,
         row_number() OVER (PARTITION BY a.id ORDER BY o.created_at, o.id) AS raw_position
  FROM email_automations a
  JOIN orders o ON o.payment_status IN ('PROOF_UPLOADED', 'PAID')
    AND o.order_status NOT IN ('CANCELLED', 'EXPIRED')
  LEFT JOIN LATERAL (
    SELECT max(uploaded_at) AS last_proof_at FROM payment_proofs WHERE order_id = o.id
  ) p ON true
  WHERE a.active AND a.trigger = 'POST_PURCHASE' AND a.activated_at IS NOT NULL
    AND (o.paid_at >= a.activated_at OR EXISTS (
      SELECT 1 FROM payment_proofs WHERE order_id = o.id AND uploaded_at >= a.activated_at
    ))
    AND (o.paid_at <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - make_interval(hours => a.delay_hours)
      OR EXISTS (SELECT 1 FROM payment_proofs WHERE order_id = o.id
        AND uploaded_at <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - make_interval(hours => a.delay_hours)))
), annotated AS (
  SELECT e.*, l.status AS latest_status,
    row_number() OVER (PARTITION BY e.automation_id ORDER BY e.created_at, e.order_id) AS ready_position
  FROM eligible e
  LEFT JOIN LATERAL (
    SELECT status FROM email_send_logs
    WHERE automation_id = e.automation_id AND target_type = 'order'
      AND (target_id = e.order_id::text OR target_id LIKE e.order_id::text || ':retry:%')
    ORDER BY created_at DESC LIMIT 1
  ) l ON true
  WHERE e.event_at <= e.ready_at
)
SELECT automation_id, name,
  count(*) AS ready_orders_since_activation,
  count(*) FILTER (WHERE raw_position <= 300 AND ready_position <= 100) AS selected_by_old_code,
  count(*) FILTER (WHERE raw_position <= 300 AND ready_position <= 100
    AND latest_status IN ('SENT', 'SKIPPED')) AS selected_but_already_processed,
  count(*) FILTER (WHERE ready_position > 100 AND latest_status IS NULL) AS unseen_without_log,
  (array_agg(public_order_number ORDER BY created_at, order_id)
    FILTER (WHERE ready_position > 100 AND latest_status IS NULL))[1:10] AS sample_unseen_orders
FROM annotated GROUP BY automation_id, name;

-- Missing paid_at + no proof: manual PAID alone does not create a timed event.
SELECT count(*) AS paid_without_event_date
FROM orders o WHERE payment_status = 'PAID' AND paid_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM payment_proofs WHERE order_id = o.id);

ROLLBACK;
