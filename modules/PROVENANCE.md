# Kilmė

Šio paketo iPhone ekrano aukščio, klaviatūros, gestų, safe-area ir blur sprendimai
perimti iš `europolas/iphoneTest`, Git žymos `example-v1`, commit
`ea7eaf93cce1fcba8f96a4d2873f393fef2175ba` (veikianti 8-oji demo versija).

`viewport.js` išlaiko išbandytą aukščio skaičiavimą ir prideda valymo funkciją.
`styles/base.css` išlaiko pilną ekraną, vidinį slinkimą, paslėptą slinkties juostą,
viršutinį blur ir 8-osios versijos minkštą apatinį blur. Pridėti bendri komponentai
ir šviesi tema. Teksto žymėjimo ir gestų ribojimus galima konfigūruoti.

`server/AuthApi.mjs` ir `server/security.mjs` perimti iš to paties pavyzdžio.
AuthApi papildytas DELETE /me: ištrynimas reikalauja slaptažodžio ir patvirtinimo.
Node HTTP runtime ir diegimo failai yra `starter/server` ir pritaikyti naujų
projektų konfigūracijai. `server/migrations.mjs` yra naujas migracijų modulis.

PWA atnaujinimai perkurti į pasirenkamą aktyvavimą, kad saugotų pildomas formas.
ntfy funkcijos atskirtos į konfigūruojamą adapterį, pranešimų leidimas lieka
prašomas tik po vartotojo paspaudimo.

Kitų projektų tikriems įrenginiams reikia regresinių patikrinimų; darbalaukio
naršyklės testai nepakeičia iPhone leidimų ir klaviatūros patikrinimo.

Canonical development repository: `europolas/pwa-toolkit`. Original provenance and
example-v1 history remain in `europolas/iphoneTest`; this import includes its
toolkit-v1.1.2 source plus isolated demo/preview namespaces and repository guides.

2026-10-18: extracted generic mobile workflows from Supplement Tracker 0.27.8.
Includes UI layout conventions, wizard/choices, durable progress and decisions,
read-only historical categories, pauses, report state and resilient localization.
Domain supplement/medical rules, private records and deployment secrets excluded.
