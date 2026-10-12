# Frigo Control · Come mettere online i 21 embed su Wix

Sito Wix: **My Site 7 Copia** (timettonline.wixsite.com/website-28).
Supabase è **già pronto** (database, password, foto). Resta solo da incollare i file su Wix.

## Cosa serve

- La cartella `embed/` di questo zip: **21 file `.html`**, uno per ogni "Incorpora HTML" del sito.
- L'accesso all'editor Wix del sito.

## Come si sostituisce un embed (uguale per tutti e 21)

1. Editor Wix → apri la **pagina** indicata nella tabella.
2. Clicca sul riquadro dell'embed (quello che oggi mostra il contenuto indicato) → **Modifica codice** / **Enter Code**.
3. Scegli **Codice** (non "Sito web" / URL).
4. Cancella tutto il codice che c'è.
5. Apri il file `.html` indicato, **copia tutto** il contenuto e incollalo.
6. **Aggiorna** / **Update**.

Quando hai fatto tutti i 21 → **Pubblica** (in alto a destra).
Non cambiare dimensione né posizione dei riquadri: i file sono fatti per le misure attuali.

## Quale file va dove

| # | Pagina Wix | Riquadro (cosa mostra oggi) | File da incollare | Menu ⚙ |
|---|---|---|---|---|
| 1 | **Tutte le pagine** (intestazione comune) | interruttore Climatizzazione / Refrigerazione | `tutte-le-pagine-interruttore.html` | no |
| 2 | Home | team a carosello | `home-1-team.html` | sì |
| 3 | Home | recensioni | `home-2-recensioni.html` | no |
| 4 | Home | valori | `home-3-valori.html` | no |
| 5 | Chi Siamo | team | `chi-siamo-team.html` | sì |
| 6 | Galleria | galleria lavori con filtri | `galleria-lavori.html` | sì |
| 7 | Climatizzazione | soluzioni (1° embed) | `climatizzazione-1-soluzioni.html` | no |
| 8 | Climatizzazione | loghi clienti (2° embed) | `climatizzazione-2-clienti.html` | no |
| 9 | Clima a parete | catalogo | `clima-a-parete.html` | sì |
| 10 | Clima a cassette | catalogo | `clima-a-cassette.html` | sì |
| 11 | Clima a pavimento | catalogo | `clima-a-pavimento.html` | sì |
| 12 | Clima canalizzato | catalogo | `clima-canalizzato.html` | sì |
| 13 | Murali | catalogo | `murali.html` | sì |
| 14 | Refrigerazione | marchi | `refrigerazione-marchi.html` | no |
| 15 | Celle frigorifere | catalogo | `celle-frigorifere.html` | sì |
| 16 | Armadi refrigerati | catalogo | `armadi-refrigerati.html` | sì |
| 17 | Armadi stagionatori | catalogo | `armadi-stagionatura.html` | sì |
| 18 | Abbattitori e Surgelatori | catalogo | `abbattitori-surgelatori.html` | sì |
| 19 | Vetrine frigo | catalogo | `vetrine-frigo.html` | sì |
| 20 | Tavoli Refrigerati e Banchi | catalogo | `tavoli-refrigerati.html` | sì |
| 21 | Macchine del Ghiaccio | catalogo | `macchine-del-ghiaccio.html` | sì |

## Prova finale (2 minuti, dopo Pubblica)

1. Apri il sito pubblicato → pagina **Celle frigorifere**.
2. Ingranaggio ⚙ in basso a destra → password **Frigocontrol1**.
3. Cambia una parola qualsiasi → **Salva e pubblica**.
4. Apri la stessa pagina dal **telefono**: deve comparire la modifica. ✔
5. Rimetti la parola com'era → **Salva e pubblica**.

## Da sapere

- **Embed con ⚙ (15)**: testi, prodotti e foto si cambiano dal menu (password `Frigocontrol1`).
  Dopo il primo salvataggio i contenuti arrivano dal database: il codice su Wix non va più toccato
  per cambiare testi o foto.
- **Embed senza ⚙ (6)**: si modificano nel codice su Wix, poi Pubblica.
- **Foto Mitsubishi**: 2 immagini nella pagina *Clima a pavimento* sono già rotte sul sito di oggi
  (il sito Mitsubishi le blocca). Sostituirle dal menu ⚙ con foto nuove.
- **Galleria**: la vecchia galleria (password `frigo2026`) viene sostituita; la nuova usa `Frigocontrol1`.
- **Supabase** (piano gratuito): progetto `dgvrlpubiuqxsvkjtrdh`, account Gmail della cliente.
  Guida tecnica completa: `GESTIONE-CONTENUTI.md`.
