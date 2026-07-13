# Autoregolazione trasparente

Il motore vive in `src/lib/autoregulation.ts`. È composto da funzioni pure: a parità di input produce lo stesso risultato e non modifica direttamente il database.

## Ordine di precedenza

1. stop di sicurezza;
2. sostituzione per dolore locale 3/10;
3. regressione per prestazione, tecnica o recupero;
4. progressione dopo due esposizioni valide;
5. mantenimento.

Una regola più sicura prevale sempre su una progressione.

## Forza

Scala di difficoltà, un solo gradino alla volta:

1. ripetizioni;
2. eccentrica 3–4 secondi;
3. pausa nel punto difficile;
4. ripetizioni 1,5;
5. variante unilaterale o più difficile;
6. una serie in più entro il tetto;
7. più peso, solo quando esiste attrezzatura adeguata.

```text
se sintomo neurologico OR dolore irradiato OR perdita di forza
   OR dolore > 3 OR tecnica interrotta per sintomi:
  STOP; nessuna progressione
altrimenti se dolore == 3:
  SOSTITUISCI; ROM ridotto, variante facilitata o una serie in meno
altrimenti se ripetizioni < minimo OR RIR 0 non pianificato
   OR tecnica incerta OR peggioramento nelle 24 ore:
  RIDUCI volume/difficoltà del 10–20%
altrimenti se per due esposizioni tutte le serie >= massimo
   AND RIR medio >= 2 AND dolore <= 2 AND tecnica stabile:
  se upper body AND risposta 24 ore mancante: MANTIENI
  altrimenti PROGREDISCI di un solo gradino
altrimenti:
  MANTIENI
```

Non viene prescritto il cedimento per l’upper body. Per le gambe il limite è RIR 1 solo nelle settimane 5–7 e mai con tecnica instabile. Il venerdì il lower body resta a RIR 3.

## Readiness giornaliera

```text
se energia == 1 OR sonno == 1:
  volume × 0,70; target RIR 3–4
se energia == 2 OR sonno == 2:
  -1 serie negli esercizi principali
se indolenzimento gambe >= 7:
  lower body ridotto; qualità corsa -> facile
se dolore locale == 3:
  solo variante facilitata previa conferma
se sintomo neurologico OR coordinazione peggiorata:
  hard stop upper body
```

## Corsa

- martedì sempre facile;
- sabato alterna lungo facile e qualità controllata;
- settimane 1–2 sempre facili;
- dalla settimana 5 può aumentare una sola variabile della qualità;
- minuti settimanali massimi: `minuti_precedenti × 1,10`;
- corsa saltata mai recuperata la domenica;
- gambe affaticate dopo venerdì: sabato facile;
- sintomi cervicali o al braccio: stop; camminata solo se asintomatica.

```text
proposta = durata_settimanale_proposta
limite = arrotonda(durata_settimanale_precedente × 1,10)
durata_finale = min(proposta, limite)
```

## Ciclo di otto settimane

- settimane 1–2: massimo 2 serie, RIR 3–4, corse facili;
- settimane 3–4: serie complete, RIR 2–3, qualità introdotta;
- settimane 5–7: serie complete, RIR 1–2, venerdì lower RIR 3;
- settimana 8: volume × 0,50–0,60, RIR 3–4, corse facili.

Dopo la settimana 8 il nuovo blocco mantiene la domenica libera e propone al massimo una modifica per esercizio.

## Deload anticipato

Viene suggerito solo se due sedute consecutive presentano almeno uno dei seguenti segnali:

- prestazione −10% o peggio a parità di variante;
- session RPE ≥9;
- recupero 1/5;
- peggioramento persistente dei sintomi;
- almeno due sedute incomplete.

## Tracciabilità e undo

Ogni `ProgressionDecision` conserva:

- input completi;
- codice della regola;
- motivazione in linguaggio umano;
- prescrizione precedente;
- prescrizione risultante;
- data;
- eventuale `undoneAt`.

L’undo marca la decisione e ripristina la prescrizione precedente; non cancella la traccia storica.

## Calibrazione martedì → sabato

Il motore vive in `src/lib/run-calibration.ts`. Dopo ogni corsa di martedì:

```text
limite_settimanale = arrotonda(minuti_settimana_precedente × 1,10)
budget_residuo = limite_settimanale − minuti_martedì_effettivi
deficit = max(0, minuti_pianificati_martedì − minuti_effettivi)

se sintomi OR RPE ≥ 8:
  sabato = facile, durata ridotta (~75%)
se deficit ≥ 40% OR RPE ≥ 6:
  sabato = facile/lungo facile, senza recupero aggressivo
se deficit > 0 AND RPE ≤ 5:
  sabato = durata_originale + min(deficit × 0,5, 15), entro budget_residuo
altrimenti:
  sabato invariato entro budget_residuo
```

Ogni `RunCalibrationDecision` è persistita e visibile in Progressi.
