-- Default new progression rows to private. Existing rows retain their current value.
ALTER TABLE "user_progression"
  ALTER COLUMN "leaderboardVisible" SET DEFAULT false;
