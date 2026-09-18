-- Run this once in your Supabase project's SQL editor
-- (Project → SQL Editor → New query → paste → Run).
-- It adds a time_seconds column used as a tiebreaker when two players
-- tie on guess count, so wins are ranked by fewest guesses, then fastest.

alter table leaderboard
  add column if not exists time_seconds integer;
