# LiraPDF Web

Första tekniska versionen av en PDF-ritningseditor med LiraCAD-inspirerad arbetsyta. Lokal bearbetning med PDF.js, egen geometri och pdf-lib för export. Ingen serverdatabas eller uppladdning av ritningar.

## Starta

Dubbelklicka på **Starta LiraPDF.command**. Appen öppnas på http://127.0.0.1:5178. Startfilen använder systemets Node eller den medföljande Codex-runtime som finns på utvecklingsdatorn.

Med Node 22+ och npm: `npm install` och `npm run dev`. Alternativt `pnpm install` och `pnpm dev`. `pnpm-lock.yaml` låser den verifierade installationen.

## Arbetsyta

Ritningen fyller arbetsytan. Verktygsegenskaper visas i raden ovanför ritningen och anpassas efter valt verktyg eller objekt. Markeringslistan är borttagen; välj och redigera objekt direkt i ritningen. Kompakta dokumentflikar ligger ovanför ritningen. Varje flik har ett kryss för att stänga dokumentet. Vid ändringar kan du spara en projektfil, stänga utan att spara eller avbryta. När den aktiva fliken stängs visas närmaste kvarvarande dokument; sista fliken lämnar en tom arbetsyta. Rulla horisontellt med mushjul/styrplatta; håll pekaren över en flik för fullständigt filnamn. Knappen med dokumentantal öppnar en sökbar lista. Sök med flera ord, välj med pil upp/ned och Enter. Flikraden kan navigeras med vänster/höger samt Home/End. Öppna flera PDF:er samtidigt via Arkiv. Varje dokument har egen sidposition, markeringar, skala och ångrahistorik. Sidbyte görs med pilarna eller sidnummerfältet till höger; sidnumret visas även i statusraden. Flikraden kan döljas utan att sidnavigationen försvinner. PDF- och projektöppning finns under **Arkiv**.

## Verktygsflikar

- **Skapa:** linje, cirkel, rektangel, båge, text och leader.
- **Redigera:** verktyg för att flytta, kopiera, trimma och ändra ritade objekt.
- **PDF:** maskning, textersättning och redigering av PDF-underlaget.
- **Mått:** måttsättning och kalibrering.

Markera, ångra/gör om och zoom är alltid tillgängliga. Kommandon öppnar rätt verktygsflik automatiskt. Byte av verktygsflik avbryter pågående verktyg.

**Hämta linje / GETLINE:** peka på en rak vektorlinje i PDF-underlaget för förhandsmarkering, klicka för att skapa en redigerbar linjekopia. Kopian kan flyttas, ändras med grips och ångras. Originalet finns kvar i PDF-underlaget. Kopian använder de valda ritegenskaperna; originalets linjestil hämtas inte. Skannade bilder stöds inte.

## Prova

- Öppna en PDF eller använd exempelritningen.
- Verktyg: `L` linje, `C` cirkel, `REC` rektangel, `A` trepunktsbåge, `T` text, `LE` leader. Skriv kommandot följt av Enter eller mellanslag. Båda tangenterna bekräftar också längder i kommandoraden.
- Leader: välj pilspets, brytpunkt och textplacering. Skriv kommentaren i dialogen.
- `CAL`: välj två punkter och ange det verkliga avståndet i mm. Skalan gäller den aktuella sidan.
- `DIM`: välj två mätpunkter, placera måttlinjen med tredje klicket. Måttet räknas om vid ändrade punkter eller kalibrering.
- För linje och cirkel: välj startpunkt/centrum, peka ut riktning och skriv en längd/radie i mm följt av Enter. Kräver kalibrering.
- `F8` växlar ortho. Snappning söker kontrollpunkter på egna objekt samt ändpunkter, mittpunkter och närmaste punkt på PDF:ens raka vektorlinjer. Symboler visar träffen utan text: fyrkant för ändpunkt, triangel för mittpunkt, cirkel för centrum, romb för övriga kontrollpunkter och timglas för närmaste punkt på en linje. Skannade bilder kan inte snappas. Kurvor, klippmasker och dolda lager är ännu inte fullständigt hanterade; kontrollera träffen visuellt.
- `F10` växlar POLAR. Välj 15°, 30°, 45° eller 90° i statusraden. Nära en sådan vinkel följer linjer, mått, hänvisningslinjer och cirkelradier en grön hjälplinje. Inmatade längder följer riktningen och aktuell skala. POLAR och ORTHO ersätter varandra.
- `F11` växlar OTRACK. Stanna cirka en halv sekund över en snappunkt för att spara den som referens. Blå hjälplinjer låter dig rikta in nästa punkt vågrätt eller lodrätt mot de två senaste referenspunkterna, även i deras skärning. Direktsnappning har företräde, därefter ORTHO/POLAR och sedan OTRACK. Referenserna rensas när objektet är klart, verktyget byts eller Escape trycks.
- Escape återgår till markering. Dra ett objekt för att flytta det, eller dra dess grips för att ändra formen. Dubbelklicka på text/leader för att redigera.
- Hjul zoomar kring pekaren. Mellanslag + dra eller mittenknapp panorerar. `Z` + Enter anpassar vyn.
- Delete tar bort valt objekt. Cmd/Ctrl+Z ångrar, Cmd/Ctrl+Shift+Z gör om. `U` + Enter ångrar också.

## Visuell maskning

Välj **Maska** eller skriv `MASK` följt av Enter/mellanslag. Dra en rektangel över området. Masken är vit, går att flytta och ändra med grips samt ångra/göra om. Markera masken för att ändra färg. Den följer med i projektfil och PDF-export. **Originalinnehållet finns kvar under täckningen. Maskning är inte säker borttagning av text eller andra uppgifter.**

## Täck och ersätt PDF-text

`TEXTEDIT` låter dig dra ett område. Appen läser textposter som överlappar området och utökar täckningen till de identifierade posterna. Du kan redigera texten innan den läggs ovanpå en vit täckning. Baslinje och storlek hämtas från första textposten; typsnittet ersätts med Helvetica.

**Originaltexten finns kvar i PDF:en och kan fortfarande sökas/kopieras.** Funktionen tar inte bort känsligt innehåll. Linjer och bilder inom den vita täckningen döljs också. Skannad text kräver manuell inmatning; OCR finns inte. Områdesidentifieringen är en första version för horisontell text. Roterad text och komplexa flerspaltiga textblock behöver fortsatt utveckling.

Verklig redigering av originaltext är ännu inte implementerad. Nästa tekniska utvärdering bör jämföra PDF-motorer på verkliga ritningar, inklusive typsnitt, blandad text/grafik, export och licensvillkor.

## Spara

- **Spara projekt** laddar ned en `.lirapdf`-fil med original-PDF, markeringar och skala per sida.
- **Öppna projekt** återställer dessa objekt för fortsatt redigering.
- **Exportera PDF** bakar in markeringarna som sidinnehåll. Spara också projektfilen om du vill kunna ändra objekten senare.
- IndexedDB autosparar öppna dokument och aktiv flik. Öppning lägger till en flik. Spara projektfiler för separata säkerhetskopior.
- Ångrahistorik gäller aktuell session och innehåller högst 80 ändringar.

## Begränsningar

Desktop med mus/tangentbord är målplattform. Markeringsruta/flerval, polylinje, polar, kopiera/rotera, skalområden, radie-/vinkelmått ingår inte ännu. Sidbyten använder sidnummerfält och föregående/nästa-knappar. Stora produktionsfiler är ännu inte prestandaverifierade. Renderingen begränsas till 16 miljoner pixlar per sida och 8192 pixlar per sidaaxel; hög zoom förstorar den befintliga sidbilden.

PDF-export använder Helvetica/WinAnsi och stöder svensk text. Andra skriftsystem och vissa specialtecken kräver inbäddat Unicode-typsnitt; exporten visar fel om ett tecken inte kan kodas. Inga digitala signaturer, krypterade PDF:er eller avancerad formulärkompatibilitet garanteras. Standardannotationer för utbyte av redigerbara objekt med andra program ingår inte.

## Utveckling och kontroll

`npm run check` eller `pnpm check` kör syntaxkontroll, tester och produktionsbygge. `pnpm format` formaterar källkod. Produktion byggs i `dist/`; PDF.js worker, teckentabeller, standardfonter och WASM följer med och behöver ingen extern CDN.

- `src/core.js`: geometri, mått, ritprimitiver och projektvalidering.
- `src/app.js`: verktygssessioner, SVG-överlägg, UI, historik och filflöden.
- `src/pdf.js`: PDF.js-laddning och exempelritning.
- `src/export.js`: PDF-export, avskild från UI och viewer.
- `src/storage.js`: lokal återställningskopia.

Tester täcker bågar, kalibrerade längder, mått, projektvalidering och textplacering vid 0/90/180/270 graders sidrotation. Manuell webbläsarkontroll täcker linje, leader, kalibrering, mått, områdesbaserad textersättning, autosparad återställning och export. Exporten har även lästs med en separat PDF-läsare och renderats för visuell kontroll.

Flikgränssnittets sökning och val har provats med 350 dokumentnamn. Detta är inte ett minnes- eller prestandatest av 350 samtidigt inlästa PDF-filer.

## PDF-block (stämplar)

Välj **Skapa → PDF-block** för att öppna blockbiblioteket. **Importera PDF** sparar vald sida som ett återanvändbart block. Sök bland förhandsvisningarna och välj ett block, klicka sedan i ritningen för att placera det. Kommandot `BLOCK` öppnar biblioteket.

Biblioteket sparas i IndexedDB i den här webbläsaren, separat från öppna dokument, och finns kvar efter omladdning. Det synkas inte mellan datorer och försvinner om webbplatsdata rensas. **Byt namn** ändrar bibliotekets namn. **Spara i bibliotek** lägger till ett markerat block med dess aktuella storlek och rotation, även från ett återöppnat projekt. Befintliga placeringar är fristående kopior.

- Dra blocket för att flytta det. Dra det motsatta hörngreppet för att skala proportionellt.
- Ange storlek i procent (100 % är PDF-sidans storlek) och rotation i grader i egenskapsraden.
- **Kopiera block** låter dig placera en ny kopia. Esc avbryter placeringen.
- Ångra/gör om, sidbyte, autosparande och projektfiler inkluderar blocken.
- Export bäddar in vald sidas PDF-innehåll med bevarade vektorer. En rasterbild används endast för förhandsvisning i arbetsytan.
- Blocket omfattar sidans beskärningsruta. Skapa små PDF-sidor för täta stämplar. Separata PDF-kommentarer och formulärfält behöver vara inbakade i käll-PDF:en först.

Kontroller: sidval, beskärning, fyra sidrotationer, projektvalidering och vektorinbäddning täcks av blocktesterna. Placering, kopiering, flytt, storlek och rotation har också provats i webbläsaren.

## Objekt utanför sidan

Tillagda objekt visas och kan markeras även utanför PDF-sidans kant. Dra dem tillbaka från den grå arbetsytan. **Visa allt** eller `ZE` anpassar vyn till sidan och alla objekt på aktuell sida; **Anpassa** eller `Z` anpassar till själva PDF-sidan. Panorera med mellanslag och dra. PDF-exporten behåller sidformatet och klipper innehåll vid sidkanten.

## Täck eller ta bort PDF-linjer

Under **PDF** finns två separata verktyg:

- **Täck linje** (`COVERLINE`) lägger en vit linje över vald PDF-linje. Justera bredden efteråt. Den kan täcka annat innehåll vid korsningar; originalinnehållet finns kvar.
- **Ta bort PDF-linje** (`ERASELINE`) tar bort ritoperationen för ett fristående rakt streck. Ändringen visas i arbetsytan, sparas i projektet och tillämpas vid PDF-export. Ångra/gör om återställer eller tillämpar borttagningen.

Faktisk borttagning är begränsad till fristående raka streck i sidans innehållsströmmar. Sammansatta banor, fyllda figurer, klippbanor, linjer inne i Form XObjects/PDF-block och skannade bilder stöds inte. Verktyget ger besked i stället för att ändra dessa. Detta är ritningsredigering, inte säker maskering av känsliga uppgifter; projektet behåller original-PDF:en för fortsatt redigering.

## Hjälp och meddelanden

Verktygens steg visas i kommandoraden och korta verktygsförklaringar i egenskapsraden. Meddelanden visas tillfälligt i en liten, diskret ruta ovanför kommandoraden. Skriv `HJÄLP`, `HELP` eller `?` för kommandolistan. Sparstatus finns i statusraden.

## GitHub Pages

GitHub Actions installerar låsta beroenden, kör tester och bygger appen vid push till `main`. Ett godkänt bygge publiceras via GitHub Pages. Ritningar och blockbibliotek lagras i besökarens webbläsare, inte i GitHub-projektet. Bibliotek och autosparade dokument från localhost flyttas inte automatiskt till den publicerade adressen; använd projektfiler för att överföra dokument.

## Viewporter med egen skala

Under **Mått → Viewport** (`VP`) väljer du två hörn och en skala. Ange exempelvis `100` för 1:100. Rita sedan med vanliga verktyg. Startpunkten avgör tillhörigheten: innanför en viewport används dess skala, utanför används sidans kalibrering. Överlappande rutor använder den minsta rutan. Befintliga objekt kopplas inte automatiskt till en ny viewport.

En linje på `5000` mm blir 50 mm på pappret vid 1:100. Markera ramens kant och ändra **Viewport 1:** till `50`: linjen blir 100 mm på pappret, medan måttsättningen fortfarande visar 5000 mm. Samma princip gäller cirklar, bågar och övrig tillhörande geometri. Tillhörigheten behålls om objekt flyttas utanför ramen. Kommandoraden visar aktuell skala.

Skalbyte sker kring ramens övre vänstra hörn; både ramen och dess objekt ändrar storlek. Flytt av hela ramen flyttar även dess objekt; hörngreppen ändrar själva rutans utsträckning. Linjebredder och textstorlekar behåller sin pappersstorlek. Ramens streckade kant är arbetsstöd och skrivs inte ut. Markera ramen för att ange namn och välja **Visa namn och skala på PDF**. Texten placeras under ramen och följer med i exporten. Nya viewports visar texten som standard; befintliga kan aktiveras med kryssrutan. PDF-underlag, maskningar och direktredigering av PDF-innehållet följer pappret. Ta bort en viewport tar även bort dess objekt; Ångra återställer allt.

Viewportskala, objekt och tillhörighet sparas i projektfilen och i autosparandet. Exporterade mått använder samma skala som visningen.

## Ny PDF

**Arkiv → Ny PDF** skapar ett tomt dokument i en ny flik. Välj namn, A0–A4 och liggande eller stående orientering. Pappret börjar i skala 1:1. Du kan rita direkt, kalibrera pappret eller lägga in viewports med egna skalor. Mallar med ramar och rithuvuden är ännu inte implementerade.

## Redigera ritade objekt

Under **Redigera** finns **Flytta (M/MOVE)**, **Kopiera (CO/COPY)** och **Offset (O/OFFSET)** med arbetsgång från LiraCADWeb. Välj ett objekt före kommandot, eller klicka på ett eller flera objekt efter att kommandot startats och tryck Enter/mellanslag. Klicka igen på ett valt objekt för att välja bort det.

- Flytta/Kopiera: välj baspunkt och målpunkt. Du kan peka ut riktningen och skriva ett avstånd i mm om de valda objekten har samma kalibrerade skala. Snappning, ORTHO, POLAR och OTRACK hjälper till vid placeringen. Kopiera låter dig placera flera kopior från samma baspunkt.
- Offset: välj linjer, cirklar eller rektanglar, skriv avstånd i mm och klicka på önskad sida. Avståndet räknas med respektive objekts viewportskala eller papperskalibrering. För stort avstånd inåt avvisas. Bågar stöds ännu inte av Offset.
- Förhandsvisningen visar placeringen före klick. Escape avbryter; Ångra återställer varje genomförd ändring. Flyttade/kopierade objekt behåller sin viewporttillhörighet. Viewportramar redigeras separat med sina grepp.
- PDF-underlagets linjer hämtas först med **Hämta linje**. Det ger en redigerbar kopia; originalet ligger kvar tills du använder Täck linje eller Ta bort PDF-linje.

Viewportens namn och skala visas enbart under rutan, när visningen är aktiverad.

## Ritredigering och PDF-verktyg

**Redigera** innehåller verktygen för ritade objekt. **PDF** samlar Maska, Hämta linje, Täck linje, Ta bort PDF-linje och Ersätt text.

| Verktyg                | Kommando      | Arbetsgång                                                                                                       |
| ---------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------- |
| Trimma                 | TR / TRIM     | Välj gränser, Enter, klicka delen som ska bort. Enter utan val använder alla raka konturer på sidan som gränser. |
| Förläng                | EX / EXTEND   | Välj gränser, Enter, klicka nära linjeänden. Förlänger till närmaste gräns i den riktningen.                     |
| Rotera                 | RO / ROTATE   | Välj objekt, Enter, välj baspunkt och riktning eller ange grader. Positiva grader är moturs.                     |
| Skala                  | SC / SCALE    | Välj objekt, Enter, välj baspunkt och skriv skalfaktor. Faktor 2 fördubblar geometrin.                           |
| Spegla                 | MI / MIRROR   | Välj objekt, Enter och välj två punkter på spegelaxeln. Skapar speglade kopior och behåller originalen.          |
| Radera                 | E / ERASE     | Välj objekt och tryck Enter. Kan ångras.                                                                         |
| Sammanfoga             | J / JOIN      | Välj sammanhängande linjer eller öppna polylinjer, Enter. Objekten måste tillhöra samma viewport/papper.         |
| Dela upp               | X / EXPLODE   | Välj rektanglar eller polylinjer, Enter. Skapar separata linjer.                                                 |
| Avrunda                | F / FILLET    | Ange radie i mm, klicka två linjer på sidorna som ska behållas. Radie 0 ger skarpt hörn.                         |
| Fasa                   | CHA / CHAMFER | Ange lika fasavstånd i mm längs båda linjerna och klicka sidorna som ska behållas.                               |
| Lägg till/ta bort hörn | PI / PD       | Välj en rektangel eller polylinje, Enter, klicka vid önskat segment/hörn.                                        |

Trimma/Förläng ändrar raka linjer mot gränser av linjer, rektanglar eller raka polylinjer. Dela upp en kontur med X före trimning. Kurvor är ännu inte gränser i dessa två verktyg. Sammanfoga arbetar med raka segment. Rotera, Skala och Spegla stöder linjer, cirklar, rektanglar, bågar och raka polylinjer; roterade/speglade rektanglar blir polylinjer. Text, mått och PDF-block ingår inte i dessa tre verktyg. Linjebredder behåller sin pappersstorlek. Skala ändrar objektens verkliga storlek, medan viewportskala ändrar visningsskalan.

Ändringar sparas i projekt och PDF-export. Escape avbryter pågående val; varje genomförd åtgärd kan ångras.
