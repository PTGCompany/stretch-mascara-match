
-- Game sessions: one row per play
CREATE TABLE public.game_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_code TEXT NOT NULL UNIQUE,
  pairs_found INTEGER NOT NULL DEFAULT 0,
  total_pairs INTEGER NOT NULL,
  wrong_attempts INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL,
  time_remaining INTEGER NOT NULL DEFAULT 0,
  completion_time_seconds INTEGER,
  final_win_level INTEGER,
  reward_tier_label TEXT,
  reward_tier_message TEXT,
  reward_product_name TEXT,
  completed_reason TEXT NOT NULL,
  print_status TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  is_win BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.game_sessions TO anon, authenticated;
GRANT ALL ON public.game_sessions TO service_role;

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view game sessions"
  ON public.game_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can create game sessions"
  ON public.game_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update game sessions"
  ON public.game_sessions FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX game_sessions_created_at_idx ON public.game_sessions (created_at DESC);
CREATE INDEX game_sessions_ticket_code_idx ON public.game_sessions (ticket_code);

-- Individual card-flip attempts within a session
CREATE TABLE public.game_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  attempt_index INTEGER NOT NULL,
  first_card_id TEXT,
  second_card_id TEXT,
  is_match BOOLEAN NOT NULL,
  time_elapsed_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.game_attempts TO anon, authenticated;
GRANT ALL ON public.game_attempts TO service_role;

ALTER TABLE public.game_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view game attempts"
  ON public.game_attempts FOR SELECT USING (true);
CREATE POLICY "Anyone can create game attempts"
  ON public.game_attempts FOR INSERT WITH CHECK (true);

CREATE INDEX game_attempts_session_idx ON public.game_attempts (session_id, attempt_index);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_game_sessions_updated_at
  BEFORE UPDATE ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
