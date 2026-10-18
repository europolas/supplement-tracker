# App Modules pakeitimai

Bendros bibliotekos įnašai iš „Supplement Tracker“. Šis failas platinamas kartu su
biblioteka ir jos ZIP / TGZ. API sutartys aprašytos [modulių kataloge](docs/MODULES.md),
[naršyklės vadove](docs/MOBILE-WORKFLOWS.md) ir [serverio vadove](docs/WORKFLOWS.md).
Ankstesnių leidimų chronologija taip pat saugoma kanoniniame `JOURNAL.jsonl`.

## 1.12.2 — 2026-10-18: dokumentacija

- Pridėta atskira modulių ir starterio pakeitimų istorija su failų bei API žemėlapiu.
- Suderinti README, katalogo, architektūros ir agentų nurodymai su 1.12.1 politika.
- Istorija įtraukta į bibliotekos paketo failus, naujus projektus ir eksportus.
- Veikimas nekeičiamas; versijos numeris ir lockfile suderinti.

## 1.12.1 — 2026-10-18: automatinis atnaujinimas tik įkėlimo metu

[src/pwa.js](src/pwa.js):

- `autoUpdate:true` leidžia automatinį atnaujinimą tik per ribotą paleidimo langą.
- `waitForStartup()` leidžia laikyti įkėlimo ekraną iki patikros pabaigos;
  `finishStartup()` neatšaukiamai uždaro langą prieš rodant interaktyvų turinį.
- `startupTimeout` numatytoji reikšmė — 4000 ms; blokavimas ar nutrūkęs ryšys
  nepalieka programėlės už įkėlimo ekrano neribotam laikui.
- Nebėra periodinių, grįžimo į ekraną, interneto atsiradimo ar laisvos būsenos
  automatinių patikrų ir perkrovimų. Vėlyvas įdiegimas nebeatidaro paleidimo lango.
- Kito lango aktyvuotas worker neperkrauna jau naudojamos programėlės.
- `apply()` lieka aiškiai inicijuojamam atnaujinimui, vis tiek tikrinant `canReload`.
- Pirmas įdiegimas neperkrauna puslapio; `destroy()` išvalo laikmačius ir stebėjimą.

Šios taisyklės pakeičia 1.12.0 automatinio atnaujinimo laukimą iki laisvos būsenos.

## 1.12.0 — 2026-10-18: naršyklės komponentai

| Failas | Viešas API | Perkelta funkcija |
| --- | --- | --- |
| [mobile-ui.js](src/mobile-ui.js) | `createSheet`, `createMobileNavigation`, `createProgress`, `createLoadingScreen` | Bendra langų struktūra, navigacija, progresas ir įkėlimo / klaidos / pakartojimo būsenos. |
| [wizard.js](src/wizard.js) | `createWizard` | Konfigūruojami žingsniai, atminties juodraštis, validacija, išsaugojimas, atmetimas ir išvalymas. |
| [selection-sheet.js](src/selection-sheet.js) | `createSelectionSheet` | Vienas / keli pasirinkimai, limitas, nenurodyta reikšmė ir išsaugojimas. |
| [job-monitor.js](src/job-monitor.js) | `createJobMonitor` | Užduočių eigos skaitymas, daliniai rezultatai, aiškus pakartojimas ir sesijos išvalymas. |
| [proposal-review.js](src/proposal-review.js) | `createProposalReview` | Kiekvieno pasiūlymo priėmimas arba atmetimas po serverio patvirtinimo. |
| [activity-calendar.js](src/activity-calendar.js) | `createActivityCalendar` | Savaitė / mėnuo, filtrai, istorinės grupės ir pasenusių atsakymų apsauga. |
| [pause-editor.js](src/pause-editor.js) | `createPauseEditor` | Rankinis atnaujinimas arba grįžimo data ir laiko juosta. |
| [report-view.js](src/report-view.js) | `createReportView` | Aiškus generavimas, ankstesnės išvados išlaikymas, pasikeitimų žyma ir pasiūlymai. |

Papildyti esami failai:

- [styles/base.css](styles/base.css): pasirenkamas mobilus išdėstymas, temos,
  vienodi tarpai, formų valdikliai, antraštės su X, 50/50 veiksmai, tolygus
  progreso judėjimas ir sumažinto judesio režimas. Veiksmų eilutės nėra fiksuotos.
- [ui.js](src/ui.js): bendras patvirtinimo lango iš apačios antraštės ir mygtukų
  išdėstymas; įprasto dialogo numatytoji pateiktis išlaikyta.
- [forms.js](src/forms.js): pasibaigus veiksmui skelbiamas `app:idle`; nuo 1.12.1
  šis įvykis pats neinicijuoja automatinio atnaujinimo.
- [index.js](src/index.js): naujų naršyklės modulių eksportai.
- [en.js](src/translations/en.js) ir [lt.js](src/translations/lt.js): nauji EN/LT
  tekstai. Anglų kalba lieka numatytoji ir atsarginė.

## 1.12.0 — serveris ir AI pavyzdžiai

| Failas | API / atsakomybė |
| --- | --- |
| [workflow-store.mjs](server/workflow-store.mjs) | `createSqlWorkflowStore`: vartotojui priklausantys įrašai, transakcijos, revizijos ir vėlyvų įrašymų apsauga. |
| [workflow-store.mjs](server/workflow-store.mjs) | `createJobService`: idempotentiškos užduotys, progresas, daliniai rezultatai, saugios klaidos ir aiškus nutrauktų užduočių žymėjimas. |
| [workflow-store.mjs](server/workflow-store.mjs) | `createProposalService`: nepriklausomi, ilgalaikiai sprendimai; priimant tikrinamas aktualumas ir tos pačios transakcijos kontekste keičiami programėlės duomenys. |
| [workflow-store.mjs](server/workflow-store.mjs) | `createReportService`, `workflowFingerprint`: ankstesnio rezultato išlaikymas, generavimo žetonas ir semantinis pasikeitimų aptikimas. |
| [workflow-store.mjs](server/workflow-store.mjs) | `allowedProfile`: aiškaus leidimo ir leidžiamų laukų projekcija; tušti ir nenurodyti laukai praleidžiami. |
| [activity-history.mjs](server/activity-history.mjs) | `buildActivityHistory`: dienos įrašai ir istoriniai grupių pavadinimai; `calendarDay`, `shiftDay`, `localMidnight` — datų ribos. |
| [activity-history.mjs](server/activity-history.mjs) | `createPause`, `pauseActive`: pristabdymo periodai ir imtinė grįžimo data užfiksuotoje laiko juostoje. |
| [workflows.sql](server/workflows.sql) | Pasirenkama `app_workflows` lentelė; ji netaikoma automatiškai. |
| [localization-provider.mjs](examples/localization-provider.mjs) | `createLocalizationProvider`, `protectNumbers`, `restoreNumbers`: vienodų tekstų sujungimas, tikslių skaičių apsauga ir vienas tik nesėkmingų dalių pakartojimas. |
| [analysis-localization.mjs](examples/analysis-localization.mjs) | `validLocalizationBatch`: dalinės sėkmės validacija, išsaugant pradinės informacijos faktus ir savininko ribas. |
| [research-report.mjs](examples/research-report.mjs) | `createResearchReportRunner`: viešų pavadinimų paieška atskirta nuo privačios analizės; tarp etapų tikrinamos teisės, leidimas ir revizija. |
| [gemini-structured.mjs](examples/gemini-structured.mjs) | Konfigūruojamas `searchInstruction`, išlaikant paieškos metaduomenų tikrinimą. |

## Integravimo ir gyvavimo taisyklės

- Naršyklės moduliuose nėra serverio importų, raktų ar automatiškai vykdomų AI užklausų.
- Ekranai tvarko `reset` / `destroy`, užklausų nutraukimą ir privačių duomenų
  išvalymą keičiantis vartotojui. Lango uždarymas neatšaukia apmokėto serverio darbo.
- Serverio užduotys saugo būseną, ne vykdomas funkcijas; po perkrovimo jos
  automatiškai nekartojamos. Idempotentiškumas nepakeičia teisių ir kvotų patikros.
- Senesnės grupės pavadinimas imamas iš tos dienos momentinės kopijos / įvykio,
  ne iš dabartinės grupės. Nežinoma praeitis neatkuriama spėjant.
- AI vertimai nekeičia pradinių kiekių, tapatybės ir šaltinio faktų. Viešai paieškai
  neperduodamas privatus profilis, rutina, tikslai ar vartotojo identifikatoriai.
- Nauji serverio failai sinchronizuoti su starterio šablonu. Konkrečios API
  integracijos, migracijos, paskyrų ištrynimo ryšiai ir diegimas lieka projekto dalimi.
- Pavyzdžiai, serverio eksportai ir vadovai įtraukti į platinamus paketus.
  Esamos programėlės nekopijuojamos ir neatnaujinamos savaime.

## Anksčiau jau buvęs bendras pagrindas

Pakartotinai panaudoti `createBottomSheet`, vietinė nuotraukų peržiūra,
slaptažodžių rodymas, leidžiamų ikonėlių įvedimas, dienos žurnalas, saugyklos,
šifruoti AI raktai, struktūruotos užklausos, paieška ir ribotos užduočių eilės.
Jų API išvardyti [MODULES.md](docs/MODULES.md); jie nekurti antrą kartą.

## Patikros

- Bendros ir generatoriaus patikros: `npm test` kanoninio toolkit šaknyje.
- Naršyklė: `npx playwright test`; tikrinami juodraščiai, pasirinkimų limitai,
  langų geometrija, eigos pabaiga, sesijos pasikeitimas, įkėlimas ir atnaujinimo langas.
- Serveris: `bash scripts/test-workflows-isolated.sh` kanoniniame toolkit — tik
  laikina MariaDB; transakcijų atšaukimas, izoliacija ir vėlyvų įrašymų atmetimas.
- Surinkimas: `npm run export-toolkit` ir `python3 scripts/prepare-pages.py`.
  Eksporto surinkimas nėra produkcinio API ar SMTP diegimas.
