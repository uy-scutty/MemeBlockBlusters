create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  title text not null,
  template text,
  vibe text not null,
  director_style text not null,
  status text not null default 'draft', -- draft | generating | ready | failed
  parent_project_id uuid references projects(id),
  final_video_url text,
  created_at timestamptz default now()
);

create table soul_ids (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  label text not null,
  source_image_url text not null,
  higgsfield_character_id text,
  status text not null default 'pending' -- pending | ready | failed
);

create table scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  order_idx int not null,
  prompt text not null,
  voiceover_line text,
  keyframe_url text,
  video_url text,
  status text not null default 'queued',
  remix_count int not null default 0
);

create table generations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  scene_id uuid references scenes(id) on delete set null,
  tool_name text not null,
  status text not null,
  input_json jsonb,
  output_url text,
  created_at timestamptz default now()
);

create table audio_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  scene_id uuid references scenes(id) on delete set null,
  type text not null, -- voiceover | music
  url text not null
);

create table exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  final_url text not null,
  subtitle_srt_url text,
  share_card_url text,
  created_at timestamptz default now()
);

create index on generations (project_id);
create index on scenes (project_id, order_idx);
