# Confronto tariffe bollette — versione web (Vercel + Supabase)

Sito pubblico per confrontare le bollette di luce e gas con le offerte del mercato.
La pagina si rigenera da `sorgente/src` con `sh sorgente/build.sh`; non modificare `index.html` a mano.
In `mercato.json` ci sono le offerte incluse nella pagina, usate se Supabase non risponde.

- `index.html`: la stessa pagina della versione claude.ai, più `web_shim.js`, che manda le letture
  delle bollette e le domande all'assistente a `/api/claude` e prende le offerte da `/api/mercato`.
- `api/claude.js`: chiama Claude con la chiave del sito, con un limite di richieste al giorno.
- `api/mercato.js`: legge offerte e PUN/PSV dalla tabella `mercato` di Supabase. Se Supabase non
  risponde, la pagina usa le offerte incluse al momento della build.
- `supabase/schema.sql`: tabelle `mercato` (lettura pubblica) e `uso_giornaliero` (contatore privato).

Le bollette dei visitatori non passano da Supabase: restano nel loro browser (localStorage).
Le immagini delle bollette vanno a Claude solo per la lettura e non vengono salvate.

## Variabili d'ambiente su Vercel

| Nome | A cosa serve |
|---|---|
| `ANTHROPIC_API_KEY` | chiave API Anthropic (obbligatoria per leggere bollette e per l'assistente) |
| `SUPABASE_URL` | URL del progetto Supabase |
| `SUPABASE_ANON_KEY` | chiave pubblica, per leggere le offerte |
| `SUPABASE_SERVICE_ROLE_KEY` | chiave privata, solo per il contatore giornaliero |
| `LIMITE_GIORNALIERO` | richieste a Claude al giorno, predefinito 200 |
| `CLAUDE_MODEL` | predefinito `claude-sonnet-5-5` |

## Aggiornare le offerte
Scrivere il nuovo `mercato.json` nella riga `id=1` della tabella `mercato`
(`insert ... on conflict (id) do update set dati = excluded.dati, aggiornato = now()`).
Il sito lo mostra entro un'ora, senza ripubblicare.
