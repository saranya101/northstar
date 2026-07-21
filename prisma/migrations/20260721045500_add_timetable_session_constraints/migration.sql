ALTER TABLE "ClassSession"
ADD CONSTRAINT "ClassSession_valid_time_check"
CHECK ("startMinutes" BETWEEN 0 AND 1439 AND "endMinutes" BETWEEN 1 AND 1440 AND "endMinutes" > "startMinutes"),
ADD CONSTRAINT "ClassSession_confidence_check"
CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)),
ADD CONSTRAINT "ClassSession_recurrence_weeks_check"
CHECK (("recurrence" = 'CUSTOM' AND cardinality("weekNumbers") > 0) OR ("recurrence" <> 'CUSTOM' AND cardinality("weekNumbers") = 0));
