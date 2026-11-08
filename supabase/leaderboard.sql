-- INDIE/24 leaderboard tables for Supabase.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to run again (it only creates what is missing and replaces the functions).
--
-- Only the website's server (api/scores.js, using the secret / service_role
-- key) can read or write these tables. Row Level Security is on with no
-- policies, and the functions can't be called with the public anon key.

create table if not exists public.leaderboard_players (
  id uuid primary key,
  name text not null check (char_length(name) between 2 and 16),
  updated_at timestamptz not null default now()
);

create table if not exists public.leaderboard_scores (
  game text not null,
  player_id uuid not null references public.leaderboard_players (id) on delete cascade,
  score bigint not null check (score > 0),
  updated_at timestamptz not null default now(),
  primary key (game, player_id)
);
create index if not exists leaderboard_scores_rank on public.leaderboard_scores (game, score desc, updated_at);

-- Posts per IP per minute, to slow down spam.
create table if not exists public.leaderboard_rate (
  ip text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);

alter table public.leaderboard_players enable row level security;
alter table public.leaderboard_scores enable row level security;
alter table public.leaderboard_rate enable row level security;

-- Count one post from an IP; false when it is over the limit.
create or replace function public.leaderboard_allow(p_ip text, p_limit int)
returns boolean language plpgsql set search_path = public as $$
declare n int;
begin
  insert into leaderboard_rate as r (ip, window_start, hits) values (p_ip, now(), 1)
  on conflict (ip) do update set
    hits = case when r.window_start < now() - interval '1 minute' then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - interval '1 minute' then now() else r.window_start end
  returning hits into n;
  return n <= p_limit;
end $$;

-- Save a score, keeping only the player's best. Returns rank and best.
create or replace function public.leaderboard_submit(p_game text, p_player uuid, p_name text, p_score bigint)
returns json language plpgsql set search_path = public as $$
declare best bigint; rnk bigint;
begin
  insert into leaderboard_players (id, name) values (p_player, p_name)
  on conflict (id) do update set name = excluded.name, updated_at = now();

  insert into leaderboard_scores as s (game, player_id, score) values (p_game, p_player, p_score)
  on conflict (game, player_id) do update
    set score = excluded.score, updated_at = now()
    where excluded.score > s.score;

  select score into best from leaderboard_scores where game = p_game and player_id = p_player;
  select count(*) + 1 into rnk from leaderboard_scores where game = p_game and score > best;
  return json_build_object('rank', rnk, 'best', best, 'newBest', best = p_score);
end $$;

-- Rename a player who already has scores. Does nothing for unknown ids.
create or replace function public.leaderboard_rename(p_player uuid, p_name text)
returns void language sql set search_path = public as $$
  update leaderboard_players set name = p_name, updated_at = now() where id = p_player;
$$;

-- Top N for a game, plus the given player's own rank.
create or replace function public.leaderboard_top(p_game text, p_player uuid, p_limit int)
returns json language sql stable set search_path = public as $$
  with ranked as (
    select s.player_id, p.name, s.score,
           rank() over (order by s.score desc) as rnk,
           row_number() over (order by s.score desc, s.updated_at) as pos
    from leaderboard_scores s join leaderboard_players p on p.id = s.player_id
    where s.game = p_game
  )
  select json_build_object(
    'total', (select count(*) from ranked),
    'top', coalesce((select json_agg(json_build_object('rank', rnk, 'name', name, 'score', score, 'you', player_id = p_player) order by pos)
                     from ranked where pos <= p_limit), '[]'::json),
    'me', (select json_build_object('rank', rnk, 'score', score) from ranked where player_id = p_player)
  );
$$;

revoke all on function public.leaderboard_allow(text, int) from public, anon, authenticated;
revoke all on function public.leaderboard_submit(text, uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.leaderboard_rename(uuid, text) from public, anon, authenticated;
revoke all on function public.leaderboard_top(text, uuid, int) from public, anon, authenticated;
grant execute on function public.leaderboard_allow(text, int) to service_role;
grant execute on function public.leaderboard_submit(text, uuid, text, bigint) to service_role;
grant execute on function public.leaderboard_rename(uuid, text) to service_role;
grant execute on function public.leaderboard_top(text, uuid, int) to service_role;
