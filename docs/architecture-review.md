# Genomgång av ansvar och struktur

Genomgång: 2026-10-15. Omfattning: samtliga egenutvecklade källmoduler,
tester, byggskript, konfiguration och statiska appresurser i arbetsytan.
Målet är tydliga ansvar och säkra dokumentflöden för en PDF-editor med
ritnings- och granskningsverktyg. Bluebeams interna implementation är inte
underlag för denna uppdelning.

## Resultat och genomförda ändringar

- Intern modellvalidering och projektformat har separerats. Sidreferenser
  kontrolleras mot den öppnade PDF:en innan modellen godkänns.
- Grundgeometri, ritprimitiver, blockhörn, textträfftestning, dokumentordning
  och dragutkast har fått DOM-fria ägare.
- PDF-annoteringars import, tolkning, koordinater, skrivning och objektgraf
  har delats upp. Linje- och textparser delar en innehållsströmsmodul utan cykel.
- Pekare och tangentbord ligger i inmatningslagret. Editorn äger verktygens
  regler och bekräftar ändringar; UI presenterar genom callbacks.
- Sidbyte, rasterjobb och kamera har separata ägare. Inaktuella sidjobb
  kan inte ersätta den aktuella sidan. PDF-resurser stängs i rätt ordning.
- Dokumentlivscykeln är frikopplad från DOM. Dokument behåller separat historik,
  sidposition och kamera. Sparstatus ändras först efter lyckad filskrivning.
- Autosparande väntar på slutförd IndexedDB-transaktion. Återställningen
  behåller felande poster och spärrar överskrivning efter oläsbar lagring.
- Alla källmoduler har registrerat lager. Kontrollen följer AST-baserade
  importer, återexporter och dynamiska importer samt avvisar cykler och
  otillåtna DOM-/lagringsberoenden.

Befintlig ljus meny, inspektor och dokumentverktyg har behållits. Sammanhängande
specialistmoduler har behållits där de redan har ett tydligt ansvar.
Kompatibilitetsfasader gör att tidigare publika importer fungerar medan
intern kod använder respektive ägarmodul.

## Filansvar

### model

DOM-fri geometri, dokumentregler, urval och verktygsdefinitioner.

| Fil                                                                 | Ansvar                                                                        |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [advanced-editing.js](../src/advanced-editing.js)                   | Trimning, förlängning, sammanfogning och övrig avancerad geometri.            |
| [cad-geometry.js](../src/cad-geometry.js)                           | Skärningar, projektioner och grundoperationer för CAD-redigering.             |
| [command-input.js](../src/command-input.js)                         | Tolkning av exakta koordinater, vinklar och längder.                          |
| [core.js](../src/core.js)                                           | Kompatibilitetsfasad för uppdelad geometri, primitiver och projektvalidering. |
| [curve-trim.js](../src/curve-trim.js)                               | Trimning och förlängning av bågar och cirklar.                                |
| [document-layout.js](../src/document-layout.js)                     | DOM-fria beräkningar för sidpositioner och skrollgränser.                     |
| [document-state.js](../src/document-state.js)                       | Normalisering och stabila snapshots av dokumentets innehåll.                  |
| [drawing-aids.js](../src/drawing-aids.js)                           | Spårningsankare och ortogonala/polära rithjälpmedel.                          |
| [editing.js](../src/editing.js)                                     | Kopiering, förflyttning och redigering av modellobjekt.                       |
| [editor/tool-catalog.js](../src/editor/tool-catalog.js)             | Verktygens metadata, kommandon, kategorier och punktantal.                    |
| [freehand.js](../src/freehand.js)                                   | Förenkling och bearbetning av frihandsdrag.                                   |
| [grips.js](../src/grips.js)                                         | Modellobjektens grepp och greppändringar.                                     |
| [groups.js](../src/groups.js)                                       | Gruppmedlemskap, normalisering och expansion av urval.                        |
| [markup-tools.js](../src/markup-tools.js)                           | Geometri och metadata för moln, färgmarkering och stämplar.                   |
| [model/block-geometry.js](../src/model/block-geometry.js)           | Roterade PDF-blocks hörn utan PDF-parser eller DOM.                           |
| [model/document-list.js](../src/model/document-list.js)             | Sökning och omordning av öppna dokument.                                      |
| [model/document-validation.js](../src/model/document-validation.js) | Intern modellvalidering, identiteter och sidreferenser.                       |
| [model/drag-geometry.js](../src/model/drag-geometry.js)             | Oförändrande dragförhandsvisning från en startmodell.                         |
| [model/entity-primitives.js](../src/model/entity-primitives.js)     | Omvandling från modellobjekt till geometriska ritprimitiver.                  |
| [model/entity-types.js](../src/model/entity-types.js)               | Tillåtna objekttyper och deras kontrollpunktsantal.                           |
| [model/geometry.js](../src/model/geometry.js)                       | Grundgeometri, bågar, ramar och måttberäkningar.                              |
| [model/project-format.js](../src/model/project-format.js)           | Projektbehållarens version, PDF-data och modellvalidering.                    |
| [model/text-hit-testing.js](../src/model/text-hit-testing.js)       | Punktträff mot PDF-textmål utan PDF-inläsning.                                |
| [page-rotation.js](../src/page-rotation.js)                         | Normaliserade sidrotationer och deras modellomvandlingar.                     |
| [pdf-snapping.js](../src/pdf-snapping.js)                           | Snappningssegment från PDF-operatorer och koordinater.                        |
| [polyline-offset.js](../src/polyline-offset.js)                     | Offset av öppna/slutna polylinjer och avvisning av ogiltiga resultat.         |
| [selection.js](../src/selection.js)                                 | Träfftestning och fönster-/korsningsurval i modellen.                         |
| [viewports.js](../src/viewports.js)                                 | Viewporttillhörighet, skalor, måttenheter och koordinatsamband.               |

### pdf

Läsning, konvertering och export av PDF-innehåll; inga UI-controllerer.

| Fil                                                                   | Ansvar                                                                                                   |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [blank-pdf.js](../src/blank-pdf.js)                                   | Skapande av tomma PDF-sidor och fördefinierade pappersformat.                                            |
| [editable-pdf.js](../src/editable-pdf.js)                             | Redigerbar PDF-inläsning och sparning med Lira-metadata.                                                 |
| [export.js](../src/export.js)                                         | Visningsexport och ritning av modellobjekt till PDF.                                                     |
| [pdf/annotation-coordinates.js](../src/pdf/annotation-coordinates.js) | Koordinater mellan PDF och arbetsyta inklusive beskärning och rotation.                                  |
| [pdf/annotation-import.js](../src/pdf/annotation-import.js)           | Importflöde och bevarande av standardannoteringar.                                                       |
| [pdf/annotation-parser.js](../src/pdf/annotation-parser.js)           | Tolkning av annoteringstyper till interna objekt.                                                        |
| [pdf/annotation-values.js](../src/pdf/annotation-values.js)           | Läsning av typade PDF-värden och privata annoteringsnycklar.                                             |
| [pdf/annotation-writer.js](../src/pdf/annotation-writer.js)           | Skrivning av standardannoteringar och deras metadata.                                                    |
| [pdf/content-stream.js](../src/pdf/content-stream.js)                 | Gemensam tokenisering och läsning av innehållsströmmar.                                                  |
| [pdf/demo-document.js](../src/pdf/demo-document.js)                   | Generering av appens exempelritning.                                                                     |
| [pdf/object-graph.js](../src/pdf/object-graph.js)                     | Kopiering av PDF-objektgraf och borttagning av oanvända objekt.                                          |
| [pdf/measurement-format.js](../src/pdf/measurement-format.js)         | Standardiserade sid-/områdesskalor, enheter och förlustfri hantering av skalor som modellen inte stöder. |
| [pdf/dimension-annotation.js](../src/pdf/dimension-annotation.js)     | Native längdmått, mätdata, synliga utseenden och import av stödda måttannoteringar.                      |
| [pdf/viewer.js](../src/pdf/viewer.js)                                 | PDF.js-inläsning och workerinställning.                                                                  |
| [pdf-annotations.js](../src/pdf-annotations.js)                       | Kompatibilitetsfasad för annoteringsimport och skrivning.                                                |
| [pdf-block.js](../src/pdf-block.js)                                   | Extraktion och inbäddning av PDF-block samt deras export.                                                |
| [pdf-created-markups.js](../src/pdf-created-markups.js)               | Lira-markeringars PDF-utseendeströmmar och identifiering.                                                |
| [pdf-line-edit.js](../src/pdf-line-edit.js)                           | Identifiering och borttagning av stödda linjer i PDF-underlaget.                                         |
| [pdf-markup.js](../src/pdf-markup.js)                                 | Bevarande, geometri och utseende för importerade markeringar.                                            |
| [pdf-stamp.js](../src/pdf-stamp.js)                                   | PDF-stämpelmallar, fält och förberedelse av statiskt utseende.                                           |
| [pdf-text-edit.js](../src/pdf-text-edit.js)                           | Identifiering och borttagning av entydigt stödda PDF-textoperationer.                                    |
| [pdf.js](../src/pdf.js)                                               | Kompatibilitetsfasad för visning, demo och export.                                                       |

### infrastructure

Browserlagring, filåtkomst, filöppning och installerad apps livscykel.

| Fil                                                                                     | Ansvar                                                             |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [file-data.js](../src/file-data.js)                                                     | Binär kodning och browserhämtningar.                               |
| [file-handling.js](../src/file-handling.js)                                             | Kö för OS-filöppning via browserns File Handling API.              |
| [infrastructure/indexeddb-repository.js](../src/infrastructure/indexeddb-repository.js) | Lazy IndexedDB-anslutning och transaktionssäker läsning/skrivning. |
| [infrastructure/quick-tool-store.js](../src/infrastructure/quick-tool-store.js)         | Browserlagring av egna snabbverktygsinställningar.                 |
| [pdf-drop.js](../src/pdf-drop.js)                                                       | Identifiering och köhantering av släppta PDF-filer.                |
| [pdf-file-save.js](../src/pdf-file-save.js)                                             | Val av PDF-mål, filhandtag och filskrivning.                       |
| [storage.js](../src/storage.js)                                                         | Repositoryadapter för arbetsyta och blockbibliotek.                |

### editor

Redigeringstransaktioner, egenskapsregler och interaktionsflöden. Får inte importera app eller UI.

| Fil                                                                         | Ansvar                                                                     |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [editor/command-controller.js](../src/editor/command-controller.js)         | Kommandotolkning och exakta redigeringsavsikter utan tangentbordsbindning. |
| [editor/create-tool-controller.js](../src/editor/create-tool-controller.js) | Punktföljder och bekräftelse för nya objekt och kalibrering.               |
| [editor/document-editor.js](../src/editor/document-editor.js)               | Atomisk modellvalidering, bekräftelse och ångra-/gör om-historik.          |
| [editor/document-selectors.js](../src/editor/document-selectors.js)         | Gemensam visningsmodell, aktuell sida, urval och skalkontext.              |
| [editor/edit-tool-definitions.js](../src/editor/edit-tool-definitions.js)   | Redigeringsverktygens stödda objekttyper och faser.                        |
| [editor/page-actions.js](../src/editor/page-actions.js)                     | Sidrotation som bekräftad redigeringsåtgärd.                               |
| [editor/pdf-content-actions.js](../src/editor/pdf-content-actions.js)       | Blockplacering, hämtning och borttagning av PDF-innehåll via editorn.      |
| [editor/property-actions.js](../src/editor/property-actions.js)             | Regler för markerade objekts egenskaper och ändringsutkast.                |
| [editor/selection-actions.js](../src/editor/selection-actions.js)           | Textändring, radering, gruppering och kopiering av markerade objekt.       |
| [editor/selection-controller.js](../src/editor/selection-controller.js)     | Markeringstillstånd och avsikt att presentera objektsegenskaper.           |
| [editor/tool-controller.js](../src/editor/tool-controller.js)               | Verktygsbyte och avbrytning av tillfälliga redigeringsflöden.              |
| [editor/transform-controller.js](../src/editor/transform-controller.js)     | Steg och bekräftelse för flytt, kopia och övriga transformverktyg.         |

### rendering

PDF-canvas, ritöverlägg, sidlayout och visuell navigering.

| Fil                                                                         | Ansvar                                                                   |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [document-scroll.js](../src/document-scroll.js)                             | Förhandsvisning och layout av angränsande sidor.                         |
| [pdf-detail.js](../src/pdf-detail.js)                                       | Förfinad rasterrendering vid zoom och ägarskap av tillfälliga sidkällor. |
| [rendering/annotation-renderer.js](../src/rendering/annotation-renderer.js) | SVG-presentation av objekt, grepp och importerade PDF-utseenden.         |
| [rendering/overlay-renderer.js](../src/rendering/overlay-renderer.js)       | Sammansättning av objekt, dragutkast, snap och verktygsöverlägg.         |
| [rendering/page-renderer.js](../src/rendering/page-renderer.js)             | PDF-rasterjobb, avbrytning, siddata och tillfälliga PDF-resurser.        |
| [rendering/pdf-viewport.js](../src/rendering/pdf-viewport.js)               | Kamera, zoom, anpassning och koordinering av sidvisningen.               |
| [rendering/viewport-navigation.js](../src/rendering/viewport-navigation.js) | Skrollavsikter, mushjul och samordnad sidväxling.                        |
| [scrollbars.js](../src/scrollbars.js)                                       | Visuella skrollreglage och deras pointerhändelser.                       |

### ui

Menyer, inspektor, dialoger, egenskapsbindningar och visuellt tillstånd. Ändringar går via callbacks till editorn.

| Fil                                                               | Ansvar                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [block-library.js](../src/block-library.js)                       | Blockbibliotekets dialog och presentation med injicerad lagring.            |
| [canvas-text-editor.js](../src/canvas-text-editor.js)             | Textinmatning på arbetsytan och dess avslut/avbrytning.                     |
| [document-tabs.js](../src/document-tabs.js)                       | Dokumentflikar, sökning, stängknappar och dragordning.                      |
| [lira-shell.css](../src/lira-shell.css)                           | Ljusa Lira-skalets palett, grundlayout och CSS-sammansättning.              |
| [lira-shell.js](../src/lira-shell.js)                             | Komposition av skal, menybehållare och inspektor.                           |
| [object-menu.js](../src/object-menu.js)                           | Positionering och stängning av objektens snabbmeny.                         |
| [quick-tools.js](../src/quick-tools.js)                           | Snabbverktygens lista, redigeringsdialog och presentation via lagringsport. |
| [style.css](../src/style.css)                                     | Grundkontroller, dokumentyta och fristående dialogers stilar.               |
| [ui/command-log.js](../src/ui/command-log.js)                     | Visning och begränsning av kommandologgens rader.                           |
| [ui/command-prompt.js](../src/ui/command-prompt.js)               | Presentation av aktuell kommandofas och efterfrågad inmatning.              |
| [ui/dialogs.js](../src/ui/dialogs.js)                             | Dialog- och canvastextadaptrar för redigeringsflöden.                       |
| [ui/document-presentation.js](../src/ui/document-presentation.js) | Dokumentflikar, status, tom arbetsyta och stängningsdialog.                 |
| [ui/feedback.js](../src/ui/feedback.js)                           | Felmeddelanden och tillfälliga notiser.                                     |
| [ui/header.css](../src/ui/header.css)                             | Topprad, filkontroller och dokumentflikarnas stilar.                        |
| [ui/icons.js](../src/ui/icons.js)                                 | Gemensamma SVG-ikoner för Lira-gränssnittet.                                |
| [ui/inspector.css](../src/ui/inspector.css)                       | Inspektorns ljusa paneler, ikonlist och hopfällning.                        |
| [ui/inspector.js](../src/ui/inspector.js)                         | Egenskaps-/sidpaneler och deras presentationslivscykel.                     |
| [ui/overlays.css](../src/ui/overlays.css)                         | Kommandorad, notiser och presentationsöverlägg.                             |
| [ui/page-navigation.js](../src/ui/page-navigation.js)             | Sidkontroller och presentation av sidnummer/sidantal.                       |
| [ui/property-bindings.js](../src/ui/property-bindings.js)         | Bindning från egenskapsfält till editorns actions.                          |
| [ui/quick-tool-controller.js](../src/ui/quick-tool-controller.js) | Bindning mellan snabbverktyg, förval och verktygsaktivering.                |
| [ui/selection-menu.js](../src/ui/selection-menu.js)               | Objektmenyns alternativ och koppling till urvalsåtgärder.                   |
| [ui/style-controls.js](../src/ui/style-controls.js)               | Ritförval, objektsegenskaper och deras separata fältpresentation.           |
| [ui/toolbar.css](../src/ui/toolbar.css)                           | Menyflikar, verktygsgrupper och verktygsknappar.                            |
| [ui/toolbar.js](../src/ui/toolbar.js)                             | Menygrupper, verktygsplacering och tangentbordsnavigation mellan flikar.    |
| [ui/workspace-bindings.js](../src/ui/workspace-bindings.js)       | Bindning av arbetsytans knappar, dubbelklick och storleksändring.           |
| [ui/workspace-presenter.js](../src/ui/workspace-presenter.js)     | Synkronisering av arbetsytans synlighet, status och verktygsfält.           |
| [update-ui.js](../src/update-ui.js)                               | Presentation av tillgänglig appuppdatering och uppdateringsavsikt.          |

### application

Beroendekopplingar, dokumentlivscykel, filer, återställning, ordnat sparande och effekter efter redigering.

| Fil                                                                     | Ansvar                                                                  |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [app/block-import-controller.js](../src/app/block-import-controller.js) | Inläsning av PDF-block och samordning av placering.                     |
| [app/document-controller.js](../src/app/document-controller.js)         | Dokumentöppning, aktivering, sparning, stängning och resurslivscykel.   |
| [app/edit-controller.js](../src/app/edit-controller.js)                 | Effekter efter redigering, historik, rendering och autosparande.        |
| [app/file-controller.js](../src/app/file-controller.js)                 | Filval, projektimport och val av export-/sparflöde.                     |
| [app/launch-controller.js](../src/app/launch-controller.js)             | Appstart, OS-filöppning och drag/släpp-bindning.                        |
| [app/library-controller.js](../src/app/library-controller.js)           | Sammansättning av blockbibliotekets PDF-tjänster, UI och lagring.       |
| [app/new-document-controller.js](../src/app/new-document-controller.js) | Samordning av nytt PDF-dokument och sidförinställningar.                |
| [app/page-controller.js](../src/app/page-controller.js)                 | Sidlivscykel och skydd mot resultat från inaktuella renderingsjobb.     |
| [app/pdf-application.js](../src/app/pdf-application.js)                 | En appinstans sammansättning och uttryckliga beroendekopplingar.        |
| [app/persistence-controller.js](../src/app/persistence-controller.js)   | Autosparandets timer, snapshots, skrivkö och flush före uppdatering.    |
| [app/stamp-controller.js](../src/app/stamp-controller.js)               | Inläsning, formulärvärden och aktivering av PDF-stämpelmallar.          |
| [app/workspace-restoration.js](../src/app/workspace-restoration.js)     | Isolerad återställning per dokument och skydd av olästa/felande data.   |
| [app/workspace-state.js](../src/app/workspace-state.js)                 | Initiering av session, arbetsyta och tillfälligt interaktionstillstånd. |
| [app.js](../src/app.js)                                                 | Startpunkt för stilar och applikationsinstans.                          |
| [pwa.js](../src/pwa.js)                                                 | Samordning av service worker, installation och appuppdatering.          |

### input

Pekare, tangentbord och koordinat-/snapadaptrar. Modelländringar går genom editorns actions.

| Fil                                                               | Ansvar                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| [input/keyboard-bindings.js](../src/input/keyboard-bindings.js)   | DOM-tangentbordshändelser till editoravsikter.               |
| [input/pointer-controller.js](../src/input/pointer-controller.js) | DOM-pekarhändelser, draglivscykel och markeringsrutor.       |
| [input/snap-controller.js](../src/input/snap-controller.js)       | Koordinatadapter och koppling till snappning/spårningshjälp. |

## Tester, skript och övriga filer

| Filer                                                   | Genomgång och ägare                                                                                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/*.test.js`                                       | Beteendetester för modell, PDF, editor och browseradaptrar. Nya tester täcker atomisk validering, dragutkast, dokumentlivscykel, sidkapplöpningar, skadad återställning, transaktionsavbrott och arkitekturregler. |
| `scripts/test-tools-browser.mjs`                        | Isolerade verktygsflöden i Chromium, UI-åtgärder, sparat innehåll och PDF-export; körs med `pnpm test:tools`.                                                                                                      |
| `scripts/check-source.mjs`                              | Läser hela källträdet och registret; kör arkitekturkontrollen.                                                                                                                                                     |
| `scripts/source-architecture.mjs`                       | AST-tolkning, beroendegraf och lager-/browsergränser, med egna beteendetester.                                                                                                                                     |
| `scripts/prepare-pdf-assets.mjs`                        | Kopierar rätt PDF.js-resurser från låst installation.                                                                                                                                                              |
| `scripts/build-pwa.js`                                  | Genererar installerbar release och versionssatta cacheresurser.                                                                                                                                                    |
| `scripts/service-worker.js`                             | Offlinecache och uppdateringslivscykel; ingen dokumentmodell.                                                                                                                                                      |
| `index.html`                                            | Appens ingång, statiska kontroller och tillgängliga grundelement.                                                                                                                                                  |
| `vite.config.js`                                        | Utvecklings- och produktionsbyggets konfiguration.                                                                                                                                                                 |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | Skript, deklarerade beroenden och reproducerbar installation. Rollup är direkt utvecklingsberoende för AST-kontrollen.                                                                                             |
| `.github/workflows/deploy.yml`                          | CI och publicering av den byggda statiska appen.                                                                                                                                                                   |
| `.gitignore`                                            | Genererade resurser och lokala beroenden hålls utanför versionshanteringen.                                                                                                                                        |
| `Starta LiraPDF.command`                                | Lokal utvecklingsstart; ingen app-/dokumentlogik.                                                                                                                                                                  |
| `public/manifest.webmanifest`                           | Installation, ikoner och OS-filöppning.                                                                                                                                                                            |
| `public/*.png`, `public/lira-icon.svg`                  | Statiska appikoner; ingen programlogik.                                                                                                                                                                            |
| `docs/*.png`                                            | Befintliga referensbilder för funktioner och layout.                                                                                                                                                               |
| `README.md`                                             | Användning, funktioner och länkar till utvecklardokumentation.                                                                                                                                                     |
| `AGENTS.md`, `docs/architecture.md`                     | Arbetsregler och avsedd ansvarsfördelning.                                                                                                                                                                         |
| `docs/module-responsibilities.json`                     | Maskinläsbart register över samtliga källmoduler och tillåtna lagerberoenden.                                                                                                                                      |

`node_modules/`, kopierade PDF.js-resurser under `public/pdfjs/` och `dist/` är
beroenden eller byggresultat. De granskas genom beroendekonfiguration,
resursgeneratorer, tester och byggkontroll; genererad leverantörskod refaktoreras
inte. Bilder är resurser, inte egna arkitekturlager.

## Verifiering

- 207 beteendetester: modell, PDF-format, redigering, dokumentlivscykel,
  lagring, återställning och arkitektur.
- Arkitekturkontroll av 123 JavaScript-/CSS-moduler i åtta lager.
- Produktionsbygge, PDF-resurser och PWA-generering via `pnpm check`.
- Webbläsarflöden: ljus meny/inspektor, verktyg, ritning, egenskaper,
  dragavbrott, ångra/gör om, PDF-export, redigerbart sparande, flera dokument,
  sidrotation, återställning, bibliotek, tangentbord och mindre skärmbredder.

Regler och vidare arbetsgång finns i [arkitekturen](architecture.md).

Efterföljande verktygskontroll och rättningar finns i [verktygsgenomgången](tool-verification.md).

Mått- och skalutbyte med andra PDF-program beskrivs i [PDF-utbyteskontrollen](pdf-interoperability.md).
