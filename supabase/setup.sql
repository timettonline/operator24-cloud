-- ============================================================================
--  FRIGO CONTROL · CONTENUTI DEL SITO — SETUP SUPABASE
--  ---------------------------------------------------------------------------
--  Progetto Supabase NUOVO e dedicato a Frigo Control.
--  Si incolla TUTTO nel SQL Editor e si preme Run. Una volta sola.
--  Rilanciarlo non fa danni (non cancella contenuti né cambia la password).
--
--  COSA CREA
--    · contenuti          → una riga per ogni embed del sito (testi, foto, tabelle)
--    · contenuti_storico  → la versione precedente a ogni salvataggio (annulla)
--    · accesso_admin      → la password del menu impostazioni (cifrata)
--    · salva_contenuto()  → l'unico modo di modificare: controlla la password
--    · bucket "media"     → le foto caricate dagli embed
--
--  SICUREZZA
--    Chiunque visiti il sito può LEGGERE i contenuti (servono per mostrarli).
--    Nessuno può SCRIVERE direttamente: si passa da salva_contenuto(), che
--    verifica la password nel database. Senza password giusta → rifiutato.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tabelle
create table if not exists public.contenuti (
  id            text primary key,
  dati          jsonb not null,
  aggiornato_il timestamptz not null default now()
);

create table if not exists public.contenuti_storico (
  n          bigint generated always as identity primary key,
  id         text not null,
  dati       jsonb not null,
  salvato_il timestamptz not null default now()
);
create index if not exists contenuti_storico_per_id
  on public.contenuti_storico (id, n desc);

create table if not exists public.accesso_admin (
  unico         boolean primary key default true check (unico),
  password_hash text not null
);

-- Password iniziale del menu impostazioni: Frigocontrol1
insert into public.accesso_admin (unico, password_hash)
values (true, extensions.crypt('Frigocontrol1', extensions.gen_salt('bf')))
on conflict (unico) do nothing;

-- ------------------------------------------- storico automatico + orario
create or replace function public.contenuti_prima_di_salvare()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.dati is distinct from new.dati then
    insert into public.contenuti_storico (id, dati) values (old.id, old.dati);
  end if;
  new.aggiornato_il := now();
  return new;
end $$;

drop trigger if exists contenuti_prima_di_salvare on public.contenuti;
create trigger contenuti_prima_di_salvare
  before insert or update on public.contenuti
  for each row execute function public.contenuti_prima_di_salvare();

-- ------------------------------------------------------- permessi (RLS)
alter table public.contenuti         enable row level security;
alter table public.contenuti_storico enable row level security;
alter table public.accesso_admin     enable row level security;

-- Lettura pubblica dei contenuti (nessuna policy di scrittura: si scrive solo
-- tramite salva_contenuto). Storico e password non hanno policy → invisibili.
drop policy if exists "lettura pubblica" on public.contenuti;
create policy "lettura pubblica" on public.contenuti
  for select to anon, authenticated using (true);

-- -------------------------------------------------------- funzioni (RPC)
create or replace function public.verifica_password(p_password text)
returns boolean
language plpgsql security definer
set search_path = public, extensions
as $$
declare h text;
begin
  select password_hash into h from public.accesso_admin where unico;
  if h is not null and p_password is not null and crypt(p_password, h) = h then
    return true;
  end if;
  perform pg_sleep(1);   -- rallenta chi prova password a caso
  return false;
end $$;

create or replace function public.salva_contenuto(p_id text, p_dati jsonb, p_password text)
returns timestamptz
language plpgsql security definer
set search_path = public, extensions
as $$
declare t timestamptz;
begin
  if not public.verifica_password(p_password) then
    raise exception 'Password errata' using errcode = '28P01';
  end if;
  if p_id is null or p_id !~ '^[a-z0-9-]{1,60}$' then
    raise exception 'Identificativo non valido';
  end if;
  if p_dati is null or jsonb_typeof(p_dati) <> 'object' then
    raise exception 'Contenuto non valido';
  end if;
  if pg_column_size(p_dati) > 3000000 then
    raise exception 'Contenuto troppo grande';
  end if;
  insert into public.contenuti (id, dati) values (p_id, p_dati)
  on conflict (id) do update set dati = excluded.dati
  returning aggiornato_il into t;
  return t;
end $$;

-- Elenco delle versioni salvate di un embed (per "Versioni precedenti")
create or replace function public.versioni_contenuto(p_id text, p_password text)
returns table (n bigint, salvato_il timestamptz)
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public.verifica_password(p_password) then
    raise exception 'Password errata' using errcode = '28P01';
  end if;
  return query
    select s.n, s.salvato_il from public.contenuti_storico s
    where s.id = p_id order by s.n desc limit 30;
end $$;

-- Contenuto di una versione precedente (si apre nel menu, non viene salvata
-- finché non si preme "Salva e pubblica")
create or replace function public.leggi_versione(p_n bigint, p_password text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare d jsonb;
begin
  if not public.verifica_password(p_password) then
    raise exception 'Password errata' using errcode = '28P01';
  end if;
  select s.dati into d from public.contenuti_storico s where s.n = p_n;
  return d;
end $$;

revoke all on function public.verifica_password(text)               from public;
revoke all on function public.salva_contenuto(text, jsonb, text)     from public;
revoke all on function public.versioni_contenuto(text, text)         from public;
revoke all on function public.leggi_versione(bigint, text)           from public;
grant execute on function public.verifica_password(text)             to anon, authenticated;
grant execute on function public.salva_contenuto(text, jsonb, text)  to anon, authenticated;
grant execute on function public.versioni_contenuto(text, text)      to anon, authenticated;
grant execute on function public.leggi_versione(bigint, text)        to anon, authenticated;

-- ------------------------------------------------------------- foto (Storage)
-- Bucket pubblico: le foto si vedono da tutti. Solo immagini, max 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760,
        array['image/webp','image/jpeg','image/png','image/gif','image/svg+xml','image/avif'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Caricamento foto dal menu impostazioni (solo nuovi file, nel bucket media)
drop policy if exists "media caricamento" on storage.objects;
create policy "media caricamento" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'media');

-- ============================================================================
--  CONTROLLO FINALE — deve comparire: tabelle 3 · password 1 · bucket 1
-- ============================================================================
select
  (select count(*) from information_schema.tables
    where table_schema = 'public'
      and table_name in ('contenuti','contenuti_storico','accesso_admin')) as tabelle,
  (select count(*) from public.accesso_admin)                              as password,
  (select count(*) from storage.buckets where id = 'media')               as bucket;

-- ============================================================================
--  COMANDI UTILI (non servono ora: si usano solo se capita)
--
--  Cambiare la password del menu impostazioni:
--    update public.accesso_admin
--       set password_hash = extensions.crypt('NuovaPassword', extensions.gen_salt('bf'));
--
--  Vedere le versioni salvate di un embed (es. clima a parete):
--    select n, salvato_il from public.contenuti_storico
--     where id = 'clima-a-parete' order by n desc;
--
--  Rimettere una versione precedente (n preso dalla query sopra):
--    update public.contenuti
--       set dati = (select dati from public.contenuti_storico where n = 123)
--     where id = 'clima-a-parete';
-- ============================================================================
