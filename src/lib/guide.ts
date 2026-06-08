/**
 * guide.ts — Testo della guida utente (sorgente unica per l'app e per GUIDA.md).
 */
export const GUIDE_MD = `# Agent Lab — Guida rapida

## Cos'è, in parole semplici
Agent Lab è uno strumento per **creare assistenti AI che rispondono basandosi sui TUOI documenti**.

Immagina di assumere un assistente e di dargli una pila di fascicoli (estratti conto, fogli costi, contratti…). Poi gli dici *come* deve comportarsi e gli fai domande. Lui risponde **solo guardando quei documenti**, citando da dove ha preso le informazioni — quindi niente risposte inventate.

È pensato soprattutto per il mondo **finanziario/bancario**: confrontare costi, leggere condizioni, estrarre numeri da documenti complessi.

## Il concetto chiave: il "Workspace"
Un **workspace = un assistente**.

Puoi averne tanti, ognuno separato dagli altri: uno per un cliente, uno per confrontare conti correnti, uno per un tipo di analisi… Ognuno ha i **suoi documenti**, le **sue istruzioni** e la **sua chat**. Quello che metti in un workspace non si mescola con gli altri.

---

## Come si usa, passo per passo

### 1) Entra
Vai sul sito → **Registrati** con email e password (la prima volta), poi **Accedi**. I tuoi workspace sono privati: li vedi solo tu.

### 2) Crea un workspace
Nella colonna a sinistra clicca il **+** accanto a "Workspace", dai un nome (es. *"Confronto conti correnti"*) e crea. Si apre la schermata di lavoro.

### 3) Dai i documenti all'assistente (a destra)
È il passo più importante: senza documenti, l'assistente non sa nulla.
- **Documenti**: trascina o clicca per caricare file **PDF, Word, Excel/CSV, testo** (fino a 10 MB l'uno).
- **Siti Web**: incolla l'indirizzo di una pagina e premi **+** per farne leggere il contenuto.

Dopo il caricamento vedrai **"Indicizzazione… 70%"**: l'assistente sta "leggendo e memorizzando" il documento. Quando appare il numero di "chunks" (pezzi), è pronto.

### 4) Scrivi le istruzioni (riquadro "Prompt Agente")
Qui dici all'assistente **come** comportarsi. Esempio:
> "Sei un consulente bancario. Rispondi in modo chiaro, metti gli importi in grassetto e crea sempre una tabella riassuntiva dei costi."

Scrivi e premi **Salva** (o Ctrl+S). Puoi modificarlo quando vuoi.

### 5) Regola la "Temperatura" (sotto il prompt)
La **temperatura** decide quanto l'assistente è *preciso* o *creativo*:
- **Verso 0 (Preciso)** → risposte rigorose, ripetibili. **Consigliata per la finanza.**
- **Verso 1 (Creativo)** → più discorsivo, ma rischia di essere meno preciso sui numeri.

Per analisi di costi e dati, **tienila bassa (0)**.

### 6) Fai domande (riquadro "Chat di Test")
Scrivi la tua domanda, per esempio:
> "Quanto costa il canone mensile? Fammi una tabella con tutte le commissioni."

L'assistente risponde **basandosi sui documenti** e mostra in basso **da quali fonti** ha preso le informazioni. Se un dato non c'è nei documenti, te lo dice invece di inventarlo.

### 7) Valuta la qualità (pulsante "Valutazione")
Questo è il superpotere di Agent Lab: ti permette di **misurare** quanto è brava l'assistente, invece di giudicare a occhio.
1. Apri **Valutazione** (in alto).
2. Crea un **test set**: scrivi alcune domande "di prova" e, se vuoi, la risposta giusta attesa.
3. Premi **Esegui valutazione**: un giudice AI legge ogni risposta e dà un **voto da 0 a 100** (quanto è fedele ai documenti e quanto è corretta), con un breve commento.
4. Vedi la **media** e lo **storico**.

Così, ogni volta che cambi le istruzioni, la temperatura o i documenti, **rilanci la valutazione e vedi se è migliorata davvero**.

---

## Il ciclo di lavoro tipico
1. Carico i documenti → 2. Scrivo le istruzioni → 3. Faccio domande di prova → 4. Aggiusto istruzioni/temperatura → 5. Valuto → 6. Ripeto finché i voti sono alti.

## Consigli pratici
- **Più documenti buoni = risposte migliori.** Carica fonti pulite e pertinenti.
- **Una domanda alla volta, chiara.** Chiedi tabelle e confronti: l'assistente è bravo a farli.
- **Controlla le fonti** sotto ogni risposta: ti dicono da dove arriva l'informazione.
- **Se un dato manca**, l'assistente dirà che non è presente — è corretto così, non è un errore.
- **Cancella** documenti o workspace che non ti servono più (icona cestino).
`;
