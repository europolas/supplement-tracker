# @europolas/app-modules 1.6.0

40 funkcinių modulių failai: 36 naršyklės moduliai, service worker ir 3 serverio moduliai.
Be frontend framework ir be naršyklės runtime priklausomybių. Node serverio
runtime atskirai naudoja mysql2 ir nodemailer, jų konkrečios versijos užrakintos.

## Agent handoff and localization

English (`en`) is the default and fallback; Lithuanian (`lt`) is the second option.
Saved language choices are preserved. Read [AGENTS.md](AGENTS.md),
[architecture](docs/ARCHITECTURE.md), [module contracts](docs/MODULES.md),
[localization](docs/LOCALIZATION.md), [iPhone constraints](docs/IPHONE.md),
[backend](docs/BACKEND.md) and [development](docs/DEVELOPMENT.md).
Every functional source file includes purpose and integration/cleanup comments.

## Katalogas

| Modulis | Eksportai / naudojimas |
| --- | --- |
| config | `createConfig` — ID, vardas, API, tema, kalba, įjungiami moduliai |
| viewport | `setupViewport` — veikiančios iPhone aukščio, pasukimo ir klaviatūros pataisos |
| gestures | `setupGestures` — pinch ir teksto žymėjimo pasirinkimai, tekstiniai laukeliai redaguojami |
| pwa | `setupPwa` — registracija, atnaujinimų tikrinimas, saugus vartotojo aktyvavimas |
| worker | `installWorker` — atskira talpykla, offline sąsaja, push ir click |
| api | `createApi`, `HttpError` — JSON/FormData, laiko limitai, atšaukimas, 401 |
| auth | `createAuth` — paskyros, profilis, sesija, slaptažodžiai, admin API |
| auth-screen | `setupAccount` — paruoštos paskyros formos iš `account.html` |
| storage | `createStorage` — JSON, schema versija, atskiras app namespace, fallback |
| daily-log | `localDay`, `createDailyLog` — local-calendar completion records for routines and checklists |
| database | `openDatabase` — IndexedDB get/list/set/remove, atnaujinimo kabliukas |
| outbox | `createOutbox` — išliekanti operacijų eilė su stabiliu idempotency ID |
| drafts | `createDrafts` — juodraščiai, saugus formų binding be password/file/hidden |
| store | `createStore` — stebima būsena ir prenumeratos |
| events | `createEvents` — vietiniai modulio įvykiai ir atšaukimas |
| settings | `createSettings` — išliekantys nustatymai su validacija |
| router | `createRouter` — hash navigacija, query, back, navigacijos guard |
| forms | `bindForm`, `readForm`, `trackDirty` — validacija, busy, dvigubo submit apsauga |
| validation | `validate`, `validators`, `createValidators` — laukelių taisyklės |
| ui | `element`, `createToast`, `confirmDialog`, `setStatus` — saugus tekstas ir dialogai |
| theme | `createTheme` — tamsi, šviesi, sistemos tema |
| i18n | `createI18n` — žodynai, kalbos, parametrų įterpimas |
| network | `watchNetwork` — ryšio pokyčiai ir stebima būsena |
| capabilities | `capabilities`, `permissionState` — galimybių ir leidimų patikra |
| notifications | `subscribePush`, `unsubscribePush`, `notificationSupport`, `keyBytes` |
| ntfy | `createNtfy` — viešo bandomojo push planavimas ir atšaukimas |
| files | `validateFile`, `uploadFile`, `previewFile`, `downloadBlob`, `exportJson`, `importJson` |
| media | `openCamera`, `takePhoto` — kamera, nuotrauka ir srauto uždarymas |
| geolocation | `locate`, `watchLocation` — vieta ir stebėjimo nutraukimas |
| clipboard | `copyText` — kopijavimas po vartotojo paspaudimo |
| share | `share` — teksto, nuorodos ar failų native bendrinimas |
| search | `filterItems`, `sortItems` — paieška be diakritinių skirtumų, rikiavimas |
| pagination | `paginate` — puslapiai ir ribos |
| time | `formatDate`, `formatNumber`, `formatMoney`, `relativeTime` |
| tasks | `singleFlight`, `debounce`, `retry` — užduočių ir kartojimo valdymas |
| resources | `createResource` — jūsų API CRUD kliento adapteris |
| logger | `createLogger`, `redact` — pagal nutylėjimą išjungti, struktūruoti žurnalai |
| server/auth | `AuthApi` — scrypt, sesijos, atkūrimas, profilis, admin teisės ir ribojimai |
| server/security | slaptažodžių, žetonų, HMAC ir AES-GCM funkcijos |
| server/migrations | `applyMigrations` — versijos, kontrolinės sumos, DB užraktas |

## Importas ir versijos

Sugeneruotas projektas turi savo bibliotekos kopiją `modules/` ir fiksuotą jos
versiją. Jį galima naudoti be npm diegimo, naudojant ES module importus iš
publikuoto `docs/modules/` aplanko. Keisti savo ekranus reikia šaltinio `src/`,
o ne perstatomuose `docs/` failuose.

```js
import { createStorage } from './modules/storage.js';
import { createApi } from './modules/api.js';

const storage = createStorage('mano-app');
storage.set('preferences', { language: 'lt' });

const api = createApi({ baseUrl: 'https://mano.example/api' });
const profile = await api.get('/v1/me');
```

npm vartotojams paketas turi `exports` ir gali būti įdiegtas iš paruošto `.tgz`.
Kai `build/app-modules` paskelbiamas atskiros Git repozitorijos šaknyje, galima
įdiegti jį per Git URL, pririšus prie žymos arba konkretaus commit:

```bash
npm install git+ssh://git@github.com/europolas/app-modules.git#v1.2.0
```

Tai būsimos atskiros repozitorijos pavyzdys; dabartinės bibliotekos npm registre
nepublikavome. `iphoneTest` yra monorepo, jo šaknies Git URL nėra šio npm paketo URL.
Monorepo viduje npm gali naudoti `file:./packages/app-modules`.

```js
import { createApi } from '@europolas/app-modules/api';
import { AuthApi } from '@europolas/app-modules/server/auth';
```

Backend modulius naudok tik serveryje; jų neįtrauk į naršyklės build.
Atnaujinimas turi būti sąmoningas: pakeisk paketo versiją, perkurk PWA ir paleisk
testus. Vartotojų DB, slapti raktai ir `.runtime/` nesidalinami tarp projektų.

## Praktiniai pavyzdžiai

```js
import { openDatabase, createOutbox, createDrafts, subscribePush, createNtfy } from './modules/index.js';

const db = await openDatabase('mano-app');
await db.set('records', { id: crypto.randomUUID(), title: 'Pastaba' });
const outbox = createOutbox(db);
await outbox.enqueue({ operation: 'save-note', text: 'Pastaba' });
// Jūsų API turi įgyvendinti šio Idempotency-Key saugojimą ir dublikatų atmetimą.
await outbox.flush((payload, { idempotencyKey }) => api.post('/notes', payload, {
  headers: { 'Idempotency-Key': idempotencyKey }
}));

const drafts = createDrafts(storage);
const unbind = drafts.bind(document.querySelector('#editor-form'), 'editor');

const ntfy = createNtfy({ id: 'mano-app' });
document.querySelector('#notify').addEventListener('click', async () => {
  const subscription = await subscribePush('jusu-viesas-vapid-raktas');
  await ntfy.schedule(subscription, { title: 'Priminimas', message: 'Praėjo minutė.', delay: '1m' });
});
```

`api`, `storage` ir jų vardai šiame pavyzdyje remiasi ankstesniu pavyzdžiu.
DB `outbox` nėra prisijungimo žetonų ar slaptažodžių saugykla. Eilės siuntimas
gali kartotis po tinklo nutrūkimo: serverio idempotency apsauga būtina prieš
naudojant duomenis keičiančioms operacijoms. Vienos eilės procesorius turi būti
aktyvus viename lange; tarp kelių langų ar įrenginių šis modulis užrakto neturi.

Pranešimai, kamera, bendrinimas ir kopijavimas kviečiami vartotojo paspaudime;
naršyklės leidimai nėra prašomi vien importavus modulį. `ntfy` yra viešas demo
adapteris: jam netinka privatūs pranešimai, mokėjimų ar paskyros paslaptys.
Kliento failų patikra nepakeičia serverio dydžio, turinio ir teisių patikros.
CRUD ir upload klientams jūsų projekte reikia tikrų API endpointų.

`retry` pagal nutylėjimą kartoja tik tinklo tipo klaidas, bet jo automatiškai
netaiko API modulis. Duomenis keičiančias užklausas kartok tik su idempotency.
Logger redagavimas yra pagalbinis; nesiųsk jam slaptažodžių, žetonų ar žalių
klaidų tekstų su paslaptimis. Juodraščių `save` gali saugoti jūsų perduotą objektą;
automatinis password/hidden filtravimas taikomas tik `bind`.

## Ribos

Paskyrų API turi registraciją, prisijungimą, keitimą/atkūrimą, profilį, roles ir
blokavimą. El. pašto patvirtinimo, MFA, mokėjimų, pokalbių ir
socialinių prisijungimų ši versija neįgyvendina. SMTP siuntimą reikia sukonfigūruoti
konkrečiam projektui. IndexedDB/localStorage saugojimas gali būti OS išvalytas;
svarbių duomenų pagrindinis šaltinis turi būti jūsų serveris arba atsarginė kopija.

`setupViewport`, `setupGestures`, `setupPwa`, `watchNetwork`, router ir kamerų
objektai pateikia valymo funkcijas; išmontuodami ekranus ar programėlę jas kvieskite.
`auth-screen` UI kalba šiuo metu lietuvių; kitų kalbų žodynus jam reikia pridėti.

Optional AI examples: [photo preparation, encrypted credentials and structured provider requests](docs/AI.md).
