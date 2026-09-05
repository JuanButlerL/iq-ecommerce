-- fbclid is present on both paid and organic Meta traffic. Reclassify only records
-- that have no explicit paid UTM signal, preserving clearly tagged paid campaigns.
UPDATE "marketing_sessions"
SET
  "source_category" = 'ORGANIC',
  "source_channel" = 'Organic Social',
  "source_label" = CASE "source_platform"
    WHEN 'INSTAGRAM' THEN 'Instagram Organico'
    WHEN 'FACEBOOK' THEN 'Facebook Organico'
    WHEN 'THREADS' THEN 'Threads Organico'
    ELSE "source_label"
  END,
  "is_paid" = false
WHERE "source_category" = 'META'
  AND "source_platform" IN ('INSTAGRAM', 'FACEBOOK', 'THREADS')
  AND COALESCE("utm_medium", '') !~* '(^|[^a-z])(cpc|ppc|paid|ads|adset|remarketing|retargeting|display|social_paid|paid_social)([^a-z]|$)'
  AND COALESCE("utm_source", '') !~* '(^|[^a-z])(paid|ads|adset|remarketing|retargeting)([^a-z]|$)';
