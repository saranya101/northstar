ALTER TABLE "ClassSession"
ADD CONSTRAINT "ClassSession_week_numbers_range_check"
CHECK ("weekNumbers" <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]::INTEGER[]);
