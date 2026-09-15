-- ============================================================================
--  FRIGO CONTROL · GALLERIA LAVORI — SETUP SUPABASE
--  ---------------------------------------------------------------------------
--  Si incolla nel SQL Editor di Supabase (progetto NUOVO, dedicato alla
--  galleria) e si preme Run. Crea la tabella, i permessi e il realtime.
--  Va lanciato UNA sola volta. Rilanciarlo non fa danni (è idempotente).
--
--  Dopo averlo lanciato: Project Settings → API, copia "Project URL" e
--  "anon public key" e incollali nel file HTML (SUPABASE_URL / SUPABASE_ANON).
-- ============================================================================

-- 1) Tabella: una sola riga contiene tutta la galleria (gruppi + immagini)
create table if not exists public.galleria (
  id   text primary key,
  dati jsonb not null default '{"gruppi":[],"immagini":[]}'::jsonb
);

-- 2) Riga iniziale con i due filtri già pronti (nessuna immagine: le carichi tu)
insert into public.galleria (id, dati)
values ('frigocontrol', '{
  "gruppi":[
    {"id":"tipo","nome":"Tipo di impianto","valori":["Climatizzazione","Refrigerazione","Pompa di calore","Ventilazione","Cella frigo"]},
    {"id":"ambiente","nome":"Ambiente","valori":["Residenziale","Commerciale","Industriale","Uffici"]}
  ],
  "immagini":[]
}'::jsonb)
on conflict (id) do nothing;

-- 3) Row Level Security
alter table public.galleria enable row level security;

-- Lettura pubblica: chiunque visita il sito vede la galleria
drop policy if exists "lettura pubblica" on public.galleria;
create policy "lettura pubblica" on public.galleria
  for select to anon, authenticated using (true);

-- Scrittura pubblica: consente il salvataggio dall'area admin del widget
-- (versione semplice; per la versione "blindata" con login vedi la nota in fondo)
drop policy if exists "inserimento pubblico" on public.galleria;
create policy "inserimento pubblico" on public.galleria
  for insert to anon, authenticated with check (true);

drop policy if exists "aggiornamento pubblico" on public.galleria;
create policy "aggiornamento pubblico" on public.galleria
  for update to anon, authenticated using (true) with check (true);

-- 4) Realtime: fa arrivare le modifiche a tutti in tempo reale
do $$
begin
  alter publication supabase_realtime add table public.galleria;
exception when duplicate_object then null;   -- già inclusa: ok
end $$;

-- 5) STORAGE: bucket pubblico per caricare le foto direttamente dal widget
insert into storage.buckets (id, name, public)
values ('galleria', 'galleria', true)
on conflict (id) do nothing;

-- Lettura pubblica dei file (il bucket è già public, la policy è di sicurezza)
drop policy if exists "galleria file lettura" on storage.objects;
create policy "galleria file lettura" on storage.objects
  for select to anon, authenticated using (bucket_id = 'galleria');

-- Caricamento dei file dall'area admin del widget
drop policy if exists "galleria file upload" on storage.objects;
create policy "galleria file upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'galleria');

-- Cancellazione dei file quando elimini un'immagine dalla galleria
drop policy if exists "galleria file delete" on storage.objects;
create policy "galleria file delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'galleria');

-- ── Controllo finale (deve mostrare la riga 'frigocontrol') ──────────────────
select id, jsonb_array_length(dati->'gruppi') as gruppi,
            jsonb_array_length(dati->'immagini') as immagini
from public.galleria;

-- ============================================================================
--  NOTA SICUREZZA
--  Con le policy qui sopra la scrittura è aperta (chiunque conosca le chiavi
--  potrebbe scrivere). La password del widget è solo lato-browser. Per un sito
--  vetrina il rischio è basso. Se vuoi la versione blindata: si attiva Supabase
--  Auth e si limita insert/update a "authenticated". Chiedimelo e ti do sia le
--  policy sia la modifica al widget.
-- ============================================================================
