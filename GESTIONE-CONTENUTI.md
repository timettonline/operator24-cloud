# Frigo Control · Embed modificabili del sito Wix

15 embed hanno un **menu impostazioni** (ingranaggio discreto in basso a destra):
password → modulo di modifica → **Salva e pubblica** → la modifica la vedono tutti.
I contenuti stanno in **Supabase**, le foto nel bucket `media`.

Gli altri 6 (interruttore, recensioni, valori, soluzioni, loghi clienti, marchi refrigerazione) sono
**statici, senza menu**: si modificano nel codice dell'"Incorpora HTML" su Wix e, dopo **Pubblica**,
la modifica la vedono tutti. Non usano il database (solo le loro foto stanno nel bucket `media`).

## Cartelle

| Cartella | Contenuto |
|---|---|
| `src/` | I 21 embed **sorgente** (uno per file). Con `<!--FC-KIT-->` hanno il menu; senza sono statici e vengono copiati così come sono. |
| `kit/fc-kit.js` | Il kit comune: ingranaggio, accesso, modulo generato dallo schema, caricamento foto, salvataggio. |
| `kit/build.js` | Unisce kit + sorgenti + chiavi Supabase → `embed/` |
| `kit/migra-immagini.js` | Porta tutte le foto su Supabase (dall'archivio locale) e aggiorna gli indirizzi in `src/` |
| `embed/` | **I file da incollare su Wix** (generati: non modificarli a mano) |
| `supabase/setup.sql` | Da lanciare una volta nel SQL Editor di un progetto Supabase nuovo |
| `media/originali/` | Archivio di tutte le immagini usate (10web, loghi, foto team) + `_indice.json` |
| `archivio-versioni-precedenti/` | I vecchi widget statici, superati da `src/`; in `con-impostazioni/` le versioni con menu dei 6 embed statici, se un giorno servissero |

## Messa in funzione (una volta)

1. Supabase → nuovo progetto (regione Europa).
2. SQL Editor → incolla `supabase/setup.sql` → Run. In fondo deve uscire `tabelle 3 · password 1 · bucket 1`.
3. Project Settings → API → copiare **Project URL** e **anon public key** (mai la `service_role`).
4. Migrazione foto e build:
   ```bash
   node kit/migra-immagini.js --url https://XXXX.supabase.co --anon eyJ...
   node kit/build.js         --url https://XXXX.supabase.co --anon eyJ...
   ```
5. Incollare ogni file di `embed/` nel rispettivo "Incorpora HTML" su Wix (tabella sotto).

Le chiavi si possono anche salvare in `kit/config.json` (`{"url":"…","anon":"…"}`): la chiave anon è
pubblica per natura, la sicurezza la fanno le regole del database.

## Gli embed

| File in `embed/` | Pagina Wix | Menu impostazioni (id nel database) |
|---|---|---|
| `tutte-le-pagine-interruttore.html` | elemento comune a tutte le pagine | — statico, senza menu |
| `home-1-team.html` | Home (1) | `home-team` |
| `home-2-recensioni.html` | Home (2) | — statico, senza menu |
| `home-3-valori.html` | Home (3) | — statico, senza menu |
| `chi-siamo-team.html` | Chi Siamo | `chi-siamo-team` |
| `galleria-lavori.html` | Galleria | `galleria` |
| `climatizzazione-1-soluzioni.html` | Climatizzazione (1) | — statico, senza menu |
| `climatizzazione-2-clienti.html` | Climatizzazione (2) | — statico, senza menu |
| `clima-a-parete.html` | Clima a parete | `clima-a-parete` |
| `clima-a-cassette.html` | Clima a cassette | `clima-a-cassette` |
| `clima-a-pavimento.html` | Clima a pavimento | `clima-a-pavimento` |
| `clima-canalizzato.html` | Clima canalizzato | `clima-canalizzato` |
| `murali.html` | Murali | `murali` |
| `refrigerazione-marchi.html` | Refrigerazione | — statico, senza menu |
| `celle-frigorifere.html` | Celle frigorifere | `celle-frigorifere` |
| `armadi-refrigerati.html` | Armadi refrigerati | `armadi-refrigerati` |
| `armadi-stagionatura.html` | Armadi stagionatori | `armadi-stagionatura` |
| `abbattitori-surgelatori.html` | Abbattitori e Surgelatori | `abbattitori-surgelatori` |
| `vetrine-frigo.html` | Vetrine frigo | `vetrine-frigo` |
| `tavoli-refrigerati.html` | Tavoli Refrigerati e Banchi | `tavoli-refrigerati` |
| `macchine-del-ghiaccio.html` | Macchine del Ghiaccio | `macchine-del-ghiaccio` |

## Come funziona

- **Lettura**: all'apertura della pagina l'embed chiede a Supabase la sua riga (`contenuti`, per id).
  Niente libreria né connessione realtime: resta nel piano gratuito anche con molto traffico.
  Se il database non risponde entro 1,5 s mostra i contenuti predefiniti scritti nel codice.
- **Scrittura**: solo con `salva_contenuto(id, dati, password)`; la password la verifica il database
  (bcrypt). Chi non ha la password può solo leggere.
- **Storico**: ogni salvataggio conserva la versione precedente (`contenuti_storico`); dal menu
  «Versioni» si riapre una versione o il contenuto originale.
- **Foto**: ottimizzate nel browser (max 1600 px, WebP) e caricate nel bucket `media`.
- **Embed bassi**: il menu si apre in una finestra separata; se il browser non lo consente, si apre
  dentro l'embed.
- **Attenzione, embed con menu**: dopo il primo «Salva e pubblica» i contenuti mostrati sono quelli del
  database, non quelli scritti nel codice. Testi, prodotti e foto si cambiano dal menu; il codice
  su Wix si tocca solo per la grafica (stili, struttura).

## Operazioni utili (SQL Editor)

```sql
-- cambiare la password del menu impostazioni
update public.accesso_admin set password_hash = extensions.crypt('NuovaPassword', extensions.gen_salt('bf'));

-- versioni salvate di un embed
select n, salvato_il from public.contenuti_storico where id = 'clima-a-parete' order by n desc;

-- rimettere una versione
update public.contenuti set dati = (select dati from public.contenuti_storico where n = 123) where id = 'clima-a-parete';
```

## Aggiungere un nuovo embed

Crea `src/<nome>.html` con: gli stili, i contenitori vuoti, il segnaposto `<!--FC-KIT-->` e uno script
che chiama `FCKit.avvia({ id, nome, dati, schema, render })`. Vedi `src/home-3-valori.html` (semplice)
o `src/armadi-refrigerati.html` (catalogo). Poi `node kit/build.js …`.
Tipi di campo dello schema: `testo`, `area`, `img`, `link`, `num`, `sel`, `si`, `gruppo`, `lista`, `tabella`.
