# LiraPDF Web

Första tekniska versionen av en PDF-ritningseditor med LiraCAD-inspirerad arbetsyta. Lokal bearbetning med PDF.js, egen geometri och pdf-lib för export. Ingen serverdatabas eller uppladdning av ritningar.

## Starta

Dubbelklicka på **Starta LiraPDF.command**. Appen öppnas på http://127.0.0.1:5178. Startfilen använder systemets Node eller den medföljande Codex-runtime som finns på utvecklingsdatorn.

Med Node 22+ och npm: `npm install` och `npm run dev`. Alternativt `pnpm install` och `pnpm dev`. `pnpm-lock.yaml` låser den verifierade installationen.

## Genomskinlighet

**Egenskaper → Genomskinlighet** gäller för alla tillagda objekt, inklusive frihand, text, mått, maskningar, viewportetiketter och PDF-block. 0 % är helt täckande och 100 % är helt osynligt. Välj ett eller flera objekt för att ändra deras genomskinlighet, eller ställ in värdet innan du ritar. Värdet kan också sparas i egna snabbverktyg. Äldre projekt och snabbverktyg är helt täckande som tidigare. PDF-exporten applicerar genomskinligheten en gång per objekt så att överlappande delar av samma objekt behåller jämn färg.

## Frihand och egna snabbverktyg

Välj **Rita → Frihand** eller skriv `FH`. Håll ned musknappen eller pennan och dra för att markera granskade delar av PDF:en. Frihand följer pekaren utan snappning, POLAR eller ORTHO. Pennbredden anges i px vid 100 % zoom och följer dokumentet vid zoomning. Varje drag är ett objekt som kan markeras, flyttas, raderas och ångras. Strecken autosparas, ingår i projektfiler och exporteras som vektorer med runda ändar.

**Snabbverktyg** är en egen vertikal sektion under verktygsfältet. Varje knapp visar verktygets ikon i den sparade färgen; namn och bredd visas vid hovring. **Granskat · Frihand · 5 px** är en färdig grön penna. Klicka **+** i snabbsektionen för att spara egna namn, verktyg, färger och bredder. Klicka på ett sparat verktyg i dialogen för att ändra det, eller välj **Nytt** för att skapa fler. Snabbverktygen sparas lokalt i webbläsaren och gäller för alla dokument; de följer inte med projektfilen.

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
- Linje fortsätter från föregående slutpunkt efter varje klick eller inmatad längd/koordinat. Varje segment är en separat linje. Esc eller tomt Enter avslutar utan att ta bort redan ritade linjer.
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
- Offset: välj linjer, cirklar eller rektanglar, skriv avstånd i mm och klicka på önskad sida. Avståndet räknas med respektive objekts viewportskala eller papperskalibrering. För stort avstånd inåt avvisas. Offset stöder även bågar och raka polylinjer.
- Förhandsvisningen visar placeringen före klick. Escape avbryter; Ångra återställer varje genomförd ändring. Flyttade/kopierade objekt behåller sin viewporttillhörighet. Viewportramar redigeras separat med sina grepp.
- PDF-underlagets linjer hämtas först med **Hämta linje**. Det ger en redigerbar kopia; originalet ligger kvar tills du använder Täck linje eller Ta bort PDF-linje.

Viewportens namn och skala visas enbart under rutan, när visningen är aktiverad.

## Ritredigering och PDF-verktyg

**Redigera** innehåller verktygen för ritade objekt. **PDF** samlar Maska, Hämta linje, Täck linje, Ta bort PDF-linje, Ta bort PDF-text och Ersätt text.

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

Trimma/Förläng ändrar linjer, bågar och raka polylinjer mot gränser av linjer, rektanglar, polylinjer, cirklar och bågar. Rektanglar kan trimmas till öppna polylinjer. Slutna konturer kan inte förlängas. Cirklar kan trimmas till bågar mellan två skärningar. Klicka på delen som ska tas bort. Trimma/Förläng fortsätter med samma gränser tills du avslutar med Esc; varje ändring går att ångra separat. Sammanfoga arbetar med raka segment. Rotera, Skala och Spegla stöder linjer, cirklar, rektanglar, bågar och raka polylinjer; roterade/speglade rektanglar blir polylinjer. Text, mått och PDF-block ingår inte i dessa tre verktyg. Linjebredder behåller sin pappersstorlek. Skala ändrar objektens verkliga storlek, medan viewportskala ändrar visningsskalan.

Ändringar sparas i projekt och PDF-export. Escape avbryter pågående val; varje genomförd åtgärd kan ångras.

## CAD-markering

Med **Markera** drar du från en tom yta:

- **Vänster → höger:** blå ruta, väljer endast objekt helt innanför.
- **Höger → vänster:** grön streckad ruta, väljer också objekt som korsar rutan.
- **Shift:** lägg till i urvalet. **Alt:** välj bort. Shift-klick växlar enskilda objekt.
- Flera markerade objekt kan dras tillsammans, raderas eller skickas till redigeringsverktyg som Flytta och Kopiera. Byte av menyflik behåller urvalet. Escape avmarkerar.

Markeringsrutan fungerar även när ett redigeringskommando väntar på objekt. Markeringen gäller ritade objekt och importerade block; PDF-underlagets linjer hämtas först med Hämta linje.

## Kommandoflöde och exakt inmatning

Tomt **Enter/mellanslag** avslutar ett aktivt ritkommando. I markeringsläget upprepas det senaste rit- eller redigeringsverktyget. Under objektval fortsätter Enter till nästa steg. Escape avbryter verktyget och rensar urvalet. **Mellanslag + dra** panorerar utan att upprepa ett kommando när tangenten släpps.

Med ett ritverktyg aktivt kan punkter anges i kommandoraden:

| Inmatning    | Betydelse                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------- |
| `5000`       | Längd/radie i mm längs pekarens riktning (linje/cirkel).                                      |
| `@5000,2000` | Relativ punkt: 5000 mm åt höger och 2000 mm upp från föregående punkt.                        |
| `5000<45`    | Punkt 5000 mm från föregående punkt med 45° vinkel.                                           |
| `#1000;2000` | Absolut punkt: x=1000, y=2000 mm från nedre vänstra hörnet av aktuellt papper eller viewport. |
| `@12,5;25,5` | Relativ punkt med svenska decimaler. Använd semikolon mellan koordinaterna.                   |

Positiva vinklar går moturs från höger. Skalningen följer den aktuella viewporten eller papprets kalibrering. Använd `#` för absoluta koordinater så att decimaler med komma inte blandas ihop med koordinatpar. Exakta koordinater påverkas inte av snappning.

### Referens för rotation och skalning

Välj objekt, starta **RO** eller **SC**, välj baspunkt och skriv **R**. Ange det gamla referensmåttet, eller välj två punkter som mäter det. Ange sedan det nya måttet eller klicka en målpunkt från baspunkten.

- **SC → R → 100 → 200** fördubblar objektets längder. Längderna anges i mm.
- **RO → R → 45 → 90** vrider objektet ytterligare 45° moturs.
- Referensskalning med numeriska längder kräver samma kalibrerade skala för hela urvalet. Rotation i grader kräver ingen längdkalibrering.

### Offset av kurvor och konturer

Offset bevarar bågars centrum och vinkelomfång och ändrar radien. Polylinjer får parallella segment med beräknade hörn. Kollapsade, vända eller självskärande resultat avvisas. Slutna polylinjer använder klick innanför/utanför för att bestämma sida. Polylinjerna består av raka segment; bågar är separata objekt.

### Greppredigering

Markera en linje, cirkel eller båge och dra i ett grepp. Cirkelns centrumgrepp flyttar hela cirkeln med bibehållen radie. Bågens tre grepp ändrar dess ändpunkter och mellanpunkt.

Klicka på ett grepp utan att dra för att aktivera det. Välj sedan ny punkt eller skriv `@x,y` (förflyttning från greppet) eller `#x;y` (absolut koordinat) i kommandoraden. För en linje kan du ange dess nya längd, för cirkelns radiegrepp en ny radie. Måtten anges i mm och följer objektets viewport eller papperskalibrering. Pekaren anger riktningen; utan pekarförflyttning behålls den gamla riktningen. Esc avbryter utan att ändra objektet.

### Ta bort PDF-text

Välj **PDF → Ta bort PDF-text** eller skriv `ERASETEXT`. Peka på en text: den borttagbara texten markeras rött. Klicka för att ta bort den och fortsätt med nästa text. Esc avslutar. Borttagningen går att ångra/göra om, sparas i projektet och tillämpas vid PDF-export.

Första versionen stöder fristående textsträngar med standardkodning (WinAnsi, eller ASCII i Helvetica/Times/Courier). Sammansatta textoperationer, specialkodade typsnitt, markerat PDF-innehåll, text i PDF-block och skannade bilder stöds ännu inte. Endast text som kan kopplas entydigt till en textoperation markeras. För andra fall finns Maska.
