-- Backfill plannedPoints for sprints that already had stories imported
-- before the plannedPoints feature was added.
UPDATE "Sprint" s
SET "plannedPoints" = (
  SELECT COALESCE(SUM(us."storyPoints"), 0)
  FROM "UserStory" us
  WHERE us."sprintId" = s.id
)
WHERE s."plannedPoints" = 0
  AND EXISTS (SELECT 1 FROM "UserStory" us WHERE us."sprintId" = s.id);