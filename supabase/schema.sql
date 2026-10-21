-- Confronto tariffe bollette: tabelle Supabase
-- mercato: una riga (id=1) con il contenuto di mercato.json {offerte, indici}. Lettura pubblica, scrittura solo dal service role.
create table if not exists public.mercato (
  id int primary key default 1 check (id = 1),
  dati jsonb not null,
  aggiornato timestamptz not null default now()
);
alter table public.mercato enable row level security;
drop policy if exists "lettura pubblica" on public.mercato;
create policy "lettura pubblica" on public.mercato for select to anon, authenticated using (true);

-- uso_giornaliero: quante letture/domande a Claude oggi, per il limite giornaliero. Nessun accesso pubblico.
create table if not exists public.uso_giornaliero (
  giorno date primary key,
  n int not null default 0
);
alter table public.uso_giornaliero enable row level security;

create or replace function public.conta_richiesta(limite int) returns boolean
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into uso_giornaliero(giorno, n) values ((now() at time zone 'Europe/Rome')::date, 1)
  on conflict (giorno) do update set n = uso_giornaliero.n + 1
  returning n into v;
  return v <= limite;
end $$;
revoke all on function public.conta_richiesta(int) from public, anon, authenticated;
grant execute on function public.conta_richiesta(int) to service_role;
