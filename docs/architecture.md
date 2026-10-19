# Arkitektur och modulansvar

LiraPDF skiljer PDF-originalet, redigeringsmodellen, tillfälliga förhandsvisningar
och arbetsytans gränssnitt från varandra. Den ljusa Lira-menyn och inspektorn
ligger kvar i presentationslagret. [Filgenomgången](architecture-review.md)
beskriver varje källmoduls ansvar; [registret](module-responsibilities.json)
används av den automatiska arkitekturkontrollen.

## Lager och beroenden

| Lager          | Ansvar                                                   | Tillåtna interna beroenden |
| -------------- | -------------------------------------------------------- | -------------------------- |
| model          | Geometri, dokumentregler, urval och verktygsdefinitioner | model                      |
| pdf            | PDF-läsning, standardannoteringar, innehåll och export   | model, pdf                 |
| editor         | Redigeringstransaktioner och verktygens arbetsflöden     | model, pdf, editor         |
| input          | Pekare, tangentbord, koordinater och snappning           | model, pdf, editor, input  |
| rendering      | Canvas, SVG-överlägg, kamera och skrollning              | model, pdf, rendering      |
| ui             | Meny, inspektor, dialoger och bindning av kontroller     | model, ui                  |
| infrastructure | Lagring, filhandtag och browseradaptrar                  | infrastructure             |
| application    | Sammansättning, dokumentlivscykel och samordning         | Alla lager                 |

Modell och editor får inte läsa DOM eller browserlagring. UI tar emot callbacks
för dokumentändringar och lagring; det importerar inte editorn eller
lagringsimplementationen. Rendering får inte bekräfta modelländringar.
Beroendegrafen får inte innehålla cykler. Lager anges efter faktiskt ansvar,
inte bara katalog: till exempel är `editor/tool-catalog.js` en modellmodul.

## Sammansättning och tillstånd

`src/app.js` startar appen. `app/pdf-application.js` är sammansättningspunkten
för en appinstans: den skapar tjänster och kopplar uttryckliga beroenden och
callbacks. Beteenden implementeras i respektive ägare. Det finns inget globalt
actionregister eller modulglobalt appdokument.

`app/workspace-state.js` skiljer mellan:

- `session`: bekräftad redigeringsmodell, sidantal och separat ångra-/gör om-historik.
- `workspace`: öppna PDF-resurser, aktiv sida, kamera, siddata och livscykelstatus.
- `interaction`: aktivt verktyg, markering, punktval, dragutkast och snappningshjälp.

Varje öppet dokument behåller sin modell, historik, sida och kamera. Verktygens
utkast är aldrig dokumentets sparade tillstånd.

## Redigering och validering

`editor/document-editor.js` är ingången för bekräftade redigeringar. Den kopierar
utkastet, normaliserar grupper och validerar innan dokumentet och historiken
ändras. Avvisade ändringar är atomiska: varken modell eller historik påverkas.
Historiken begränsas till 80 steg. Import, återställning och dokumentbyte har
uttryckliga livscykler utanför vanliga redigeringskommandon.

`model/document-validation.js` validerar den interna modellen. När PDF:ens
sidantal är känt kontrolleras även sidreferenser i objekt, skalor och rotationer.
`model/project-format.js` validerar projektets format, version och PDF-payload
separat. Interna redigeringar behöver ingen låtsad serialiseringsbehållare.

`editor/property-actions.js` äger egenskapsändringar. `transform-controller.js`
äger transformverktygens steg; geometriberäkningarna ligger i modellmoduler.
`pdf-content-actions.js` äger användaråtgärder som att ta bort PDF-text, hämta
en linje och placera ett block. Dessa regler ligger inte i pekarhanteraren.
`app/edit-controller.js` samordnar rendering, ändringsindikering och autosparande
efter en bekräftad ändring. Borttagning i PDF-underlaget kräver ny rasterbild;
vanliga markeringar ritas som överlägg.

## Inmatning och förhandsvisning

`input/pointer-controller.js` binder pekarhändelser och samordnar drag och
markeringsrutor. `input/keyboard-bindings.js` binder tangentbordet.
`input/snap-controller.js` översätter koordinater och samordnar snappning.
Kommandotolkning, punktföljder, markering och verktygsbyten ligger i DOM-fria
editorcontrollerer. Presentation och fältvärden skickas via callbacks.

`model/drag-geometry.js` beräknar varje dragutkast från en oförändrad startmodell.
Resultatet beror inte på hur många pekarhändelser som hunnit komma.
`editor/document-selectors.js` ger rendering och urval samma visningsmodell.
Släpp bekräftar utkastet i ett ångringssteg; Esc eller förlorad pointer capture
slänger det. Barn i en flyttad viewport förflyttas en gång även om de också är
markerade.

## PDF och rendering

`pdf/viewer.js` äger PDF.js-inläsning och workerinställning. Demodokument,
redigerbart sparande och visningsexport är separata tjänster.
`pdf/annotation-import.js`, `annotation-parser.js` och `annotation-writer.js`
äger annoteringars import, tolkning respektive skrivning. Koordinatomvandling,
PDF-värden och kopiering av objektgrafen har egna moduler.
`pdf/measurement-format.js` äger standardiserade sid-/områdesskalor och
`pdf/dimension-annotation.js` längdmåttens semantik och utseende.
Måttens egen `measurementScale` skiljer befintliga mått från sidans skala för
nya mätningar. Skalning av ett mätområde justerar båda för att behålla måttvärdet. Gemensam tolkning av
innehållsströmmar ligger i `pdf/content-stream.js`, så linje- och textredigering
inte behöver importera varandra.

`app/page-controller.js` samordnar sidbyte, tillfälligt inmatningstillstånd och
effekter. Ett inaktuellt sidjobb får inte ersätta en nyare sida eller låsa upp
dess pågående jobb. `rendering/page-renderer.js` äger rasterjobb, avbrytning,
PDF-siddata och tillfälliga PDF-resurser. Cachedata lagras utanför PDF.js-objekten.
`rendering/pdf-viewport.js` äger kamera, zoom och anpassning;
`viewport-navigation.js` äger skrollavsikter och sidväxling vid skrollning.

`annotation-renderer.js` ritar objekt och grepp. `overlay-renderer.js` sammansätter
objekt och tillfälliga verktygs-, snap- och urvalsöverlägg. `pdf-detail.js`,
`document-scroll.js` och `scrollbars.js` hanterar rasterförfining, grannsidor och
skrollkontroller. `document-layout.js` innehåller gemensam DOM-fri sidlayout.

Publika ingångar som `core.js`, `pdf.js` och `pdf-annotations.js` behålls som
kompatibilitetsfasader. Intern kod importerar funktioner från deras faktiska
ägare. Befintliga sammanhängande specialistmoduler behåller sina namn och
placeringar; katalogflytt är inte ett mål i sig.

## Dokument, filer och återställning

`app/document-controller.js` äger öppning, aktivering, sparande och stängning.
Den tar emot PDF-/filtjänster samt presentation och rendering som uttryckliga
beroenden. Ett ogiltigt importerat dokument registreras inte i arbetsytan;
PDF-resursen frigörs. Sparstatus ändras först när filskrivningen lyckats.
Rendering avbryts innan den sista PDF-resursen stängs.
`ui/document-presentation.js` äger dokumentflikar, status, tom arbetsyta och
stängningsdialog. `model/document-list.js` äger filtrering och ordning.

`file-controller.js` samordnar filval, projektimport och export.
`launch-controller.js` kopplar start, OS-filöppning och drag/släpp.
`workspace-restoration.js` återställer varje sparat dokument separat. En trasig
post hindrar inte andra dokument och behålls oförändrad vid nästa autosparande.
Om lagringen inte kan läsas eller dess behållarformat inte stöds spärras
överskrivning. Det hindrar att återställningsfel ersätter användarens sparade data.

`persistence-controller.js` äger timer, snapshots och en ordnad skrivkö.
Manuell appuppdatering använder samma flush. `storage.js` anpassar dokument och
blockbibliotek till `infrastructure/indexeddb-repository.js`. Anslutningen öppnas
först vid användning; en skrivning är klar först när transaktionen är klar,
inte när en enskild begäran har lyckats. Snabbverktygens browserinställning
använder `infrastructure/quick-tool-store.js`. UI får lagring via callbacks.

## Ljus meny och inspektor

`lira-shell.js` komponerar ramen. `ui/toolbar.js` äger menygrupper och placering.
Menybyte ändrar inte dokumentet eller aktivt verktyg. Befintliga kontroll-ID:n
och kommandoägare bevaras.

`ui/inspector.js` äger Egenskaper, Sidor och hopfällning. Panelbyte behåller
markeringen. `workspace-presenter.js` visar aktuellt tillstånd;
`property-bindings.js` anropar editorns actions. `style-controls.js` skiljer
ritverktygens förval från markerade objekts egenskaper. `lira-shell.css` och
`ui/*.css` äger den fasta ljusa paletten och skalets layout. `style.css` äger
grundkontroller, dokumentytan och övriga dialoger.

## Kontroller vid ändring

- `pnpm check:architecture`: fullständig JS-/CSS-inventering, AST-baserade importer
  och återexporter, syntax, lagergränser, DOM-/lagringsgränser och beroendecykler.
- `pnpm test`: beteenden för geometri, PDF, redigering, livscykel och lagring.
- `pnpm test:tools`: verkliga verktygsflöden i Chromium mot en startad app,
  med isolerade sessionsdata och kontroll av sparat innehåll.
- `pnpm check`: arkitektur, samtliga tester, PDF-resurser, produktionsbygge och PWA.
- Webbläsarkontroll vid ändrad inmatning, rendering, dokumentflöde eller UI.
  Enbart kontroll av CSS-klasser ersätter inte verkliga arbetsflöden.

Alla JavaScript- och CSS-moduler under `src/` måste registreras med ansvar och
lager i `docs/module-responsibilities.json`. Nya beroenden ska följa grafen ovan.
