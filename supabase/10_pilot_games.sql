-- SkillFi-owned, deterministic pilot modes. These records contain no third-party IP.
insert into public.games (id, name, slug, type, description, integration_status, is_active)
values
  ('51000000-0000-4000-8000-000000000001', 'Typing Sprint', 'typing-sprint', 'web2', 'Speed and accuracy typing duel.', 'published', true),
  ('51000000-0000-4000-8000-000000000002', 'Arithmetic Rush', 'arithmetic-rush', 'web2', 'Deterministic mental arithmetic duel.', 'published', true),
  ('51000000-0000-4000-8000-000000000003', 'Sequence Recall', 'sequence-recall', 'web2', 'Working-memory sequence challenge.', 'published', true),
  ('51000000-0000-4000-8000-000000000004', 'Pattern Lock', 'pattern-lock', 'web2', 'Deterministic numeric pattern challenge.', 'published', true),
  ('51000000-0000-4000-8000-000000000005', 'Logic Grid', 'logic-grid', 'web2', 'True-or-false deductive reasoning duel.', 'published', true)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  type = excluded.type,
  description = excluded.description,
  integration_status = excluded.integration_status,
  is_active = excluded.is_active;
