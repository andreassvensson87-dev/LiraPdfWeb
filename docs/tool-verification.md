# Verktygsgenomgång efter omstruktureringen

Verifierad 2026-10-15 med Chromium. **66 av 66 webbläsarscenarier godkända**,
utan JavaScript-/konsolfel i de testade flödena. **190 beteendetester**,
arkitekturkontroll, produktionsbygge och PWA-generering godkända via `pnpm check`.

## Rättat fel

**Radera** filtrerade bort mätområden, maskningar och ersättningstexter från
verktygets möjliga urval. Ett markerat objekt av dessa typer kunde tas bort
med knappen Ta bort men avvisades av Radera. Verktyget accepterar nu dessa
objekttyper. När ett mätområde raderas tas också dess tillhörande objekt bort,
så modellen inte får kvarvarande referenser till ett saknat mätområde.
Åtgärden ger ett ångringssteg; ångra/gör om återställer hela innehållet.

Rättningen ligger i `src/editor/edit-tool-definitions.js` och
`src/editor/transform-controller.js`. Tre nya regressionstester samt
webbläsarfallen för mätområde, maskning och ersättningstext verifierar beteendet.
Ingen CSS, färgpalett eller meny-/inspektorlayout har ändrats.

## Omfattning

| Grupp              | Kontrollerade funktioner                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rita               | Linje, rektangel, cirkel, ellips, båge, text, leader, frihand, färgmarkering, moln och vanlig/egen textstämpel.                                                                      |
| Ändra              | Flytta, kopiera, offset, rotera, skala, spegla, trimma, förläng, radera, sammanfoga, dela upp, avrunda, fasa och lägg till/ta bort hörn. Även referensrotation och referensskalning. |
| Mäta               | Kalibrering, måttsättning, mätområden, namn, skalbyte och medföljande objekt vid skaländring/flytt.                                                                                  |
| PDF                | Maska, täck och ersätt text, hämta/täck/ta bort linje, ta bort text samt sidrotation i båda riktningarna.                                                                            |
| Block och stämplar | PDF-blockimport, bibliotek, placering, storlek, rotation, kopiering, namnbyte, sökning och lagring; PDF-stämpelmall med textfält och placering.                                      |
| Markering          | Objektval, fönster-/korsningsurval, flera objekt, gruppera/lös upp, grepp med exakt koordinat, dragförhandsvisning och avbrott.                                                      |
| Egenskaper         | Färg, linjebredd, genomskinlighet, textredigering, block- och mätområdesegenskaper.                                                                                                  |
| Inmatning          | Exakta koordinater, numerisk längd, ORTHO, POLAR, PDF-snappning, objektspårning och Esc under pågående verktyg.                                                                      |
| Visa               | Zoomknappar, hjulzoom, panorering, anpassa/visa allt, dokumentrad, sidpanel, flera sidor och skrollning mellan sidor.                                                                |
| Filer              | Ny PDF, projekt-/PDF-inläsning, redigerbart sparande, spara som, återöppning, visningsexport, dokumentbyte/stängning och återställning efter omladdning.                             |
| Lira-gränssnitt    | Menyflikar, inspektorbyte/hopfällning, bibehållet urval, tangentbordsnavigation, 1280/1024 px fönster och ljus palett även med mörkt systemtema.                                     |

Testerna använder kontrollerade PDF-filer med text och vektorlinjer, sparade
objekt samt en stämpelmall med formulärfält. De utför riktiga UI-åtgärder och
läser arbetsytans sparade dokumentmodell. Flertalet redigeringar verifieras
också med ångra/gör om. För borttagning av PDF-text/-linje kontrolleras både
ändrad rasterbild och innehållet i den exporterade PDF:en. Maska och Täck linje
verifieras som visuella täckningar enligt verktygens befintliga beteende.

Varje scenario använder en isolerad browsersession. Dokument i användarens
vanliga browser berörs inte. Kompletterande kontroller har verifierat den ljusa
menyn/inspektorn, smalare fönster, dokumentbyte och återställning.

## Köra om

1. Installera beroenden med `pnpm install --frozen-lockfile`.
2. Installera testwebbläsaren en gång: `pnpm exec playwright install chromium`.
3. Starta appen med `pnpm dev`.
4. Kör `pnpm test:tools` i en annan terminal.
5. Kör `pnpm check` för arkitektur, modell-/PDF-/controllertester och bygge.

`TOOL_FILTER='pdf/' pnpm test:tools` kör en delmängd. `LIRAPDF_URL` väljer
serveradress och `TOOL_ARTIFACTS` katalog för resultat. Normalt ligger
`results.json` och eventuella felbilder i systemets temporära katalog
`lirapdf-tools`. Verktygssviten körs separat från `pnpm check` eftersom den
behöver en startad app och installerad Chromium.

## Utförda webbläsarscenarier

| Scenario                                          | Resultat |
| ------------------------------------------------- | -------- |
| `create/line`                                     | Godkänt  |
| `create/rect`                                     | Godkänt  |
| `create/circle`                                   | Godkänt  |
| `create/ellipse`                                  | Godkänt  |
| `create/arc`                                      | Godkänt  |
| `create/cloud`                                    | Godkänt  |
| `create/stamp`                                    | Godkänt  |
| `create/text`                                     | Godkänt  |
| `create/leader`                                   | Godkänt  |
| `create/dim`                                      | Godkänt  |
| `create/freehand`                                 | Godkänt  |
| `create/highlight`                                | Godkänt  |
| `create/custom-stamp`                             | Godkänt  |
| `measure/calibrate`                               | Godkänt  |
| `measure/viewport`                                | Godkänt  |
| `measure/viewport-properties-and-children`        | Godkänt  |
| `edit/move`                                       | Godkänt  |
| `edit/copy`                                       | Godkänt  |
| `edit/rotate`                                     | Godkänt  |
| `edit/scale`                                      | Godkänt  |
| `edit/mirror`                                     | Godkänt  |
| `edit/offset`                                     | Godkänt  |
| `edit/erase`                                      | Godkänt  |
| `edit/erase-viewport-with-children`               | Godkänt  |
| `edit/join`                                       | Godkänt  |
| `edit/explode`                                    | Godkänt  |
| `edit/pinsert`                                    | Godkänt  |
| `edit/pdelete`                                    | Godkänt  |
| `edit/trim`                                       | Godkänt  |
| `edit/extend`                                     | Godkänt  |
| `edit/fillet`                                     | Godkänt  |
| `edit/chamfer`                                    | Godkänt  |
| `pdf/mask`                                        | Godkänt  |
| `pdf/replace`                                     | Godkänt  |
| `pdf/extract`                                     | Godkänt  |
| `pdf/coverLine`                                   | Godkänt  |
| `pdf/eraseLine`                                   | Godkänt  |
| `pdf/eraseText`                                   | Godkänt  |
| `selection/appearance-and-opacity`                | Godkänt  |
| `selection/delete-button`                         | Godkänt  |
| `selection/text-edit`                             | Godkänt  |
| `selection/grip-exact-coordinate`                 | Godkänt  |
| `selection/drag-cancel-and-commit`                | Godkänt  |
| `selection/group-ungroup`                         | Godkänt  |
| `input/exact-line-and-length`                     | Godkänt  |
| `view/rotation-navigation-and-light-ui`           | Godkänt  |
| `pdf/block-import-library-place-copy`             | Godkänt  |
| `pdf/stamp-template-place`                        | Godkänt  |
| `file/editable-save-reopen-and-export`            | Godkänt  |
| `edit/rotate-reference`                           | Godkänt  |
| `edit/scale-reference`                            | Godkänt  |
| `input/numeric-line-length`                       | Godkänt  |
| `input/ortho`                                     | Godkänt  |
| `input/polar`                                     | Godkänt  |
| `input/pdf-endpoint-snap`                         | Godkänt  |
| `input/object-tracking`                           | Godkänt  |
| `input/escape-cancels-unfinished-tools`           | Godkänt  |
| `selection/window-and-crossing`                   | Godkänt  |
| `selection/viewport-drag-children`                | Godkänt  |
| `view/pan-and-wheel-zoom`                         | Godkänt  |
| `view/multipage-navigation`                       | Godkänt  |
| `file/new-pdf-and-save-as`                        | Godkänt  |
| `preferences/quick-tools-save-restore`            | Godkänt  |
| `pdf/block-library-rename-search-and-persistence` | Godkänt  |
| `edit/erase-mask`                                 | Godkänt  |
| `edit/erase-replace`                              | Godkänt  |

Efterföljande kontroll av mått, skalor och PDF-rundresor finns i
[PDF-utbyteskontrollen](pdf-interoperability.md), inklusive aktuell teststatus
för de nya interoperabilitetsfallen.
