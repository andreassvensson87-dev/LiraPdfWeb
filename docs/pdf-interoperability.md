# PDF-utbyte: markeringar, mått och skalor

Kontroll utförd 2026-10-15. PDF-formatet, sparande och återöppning är verifierade
automatiskt och genom separat PDF-rendering. **Bluebeam Revu är inte installerat
på utvecklingsdatorn; faktisk öppning, redigering och omsparning i Revu är därför
inte verifierad.** En standardkontroll ersätter inte detta programtest.

## Problem som har rättats

Liras längdmått skrevs tidigare som sidgrafik medan kalibrering och mätområden
låg i den privata Lira-katalogen. Informationen räckte för Liras egen
återställning men gav inte andra program en måttannotering eller användbar
standardiserad kalibrering.

Vid Spara PDF skrivs nu:

- Längdmått som `/Subtype /Line`, `/IT /LineDimension`, med mätpunkter `/L`,
  förlängningslinjer `/LL`, måtttext och ett synligt `/AP`-utseende.
- Skala och enhet per mått i `/Measure`. `/X` konverterar PDF-koordinater till
  verkliga millimeter; `/D` konverterar därefter dessa enheter, utan att skalan
  multipliceras en gång till. `/A` finns för areakonvertering.
- Sidkalibrering och områdesskalor i sidans `/VP`-array med `/BBox`, namn och
  `/Measure`. Nya områden läggs efter sidans grundskala; mindre lokala områden har
  företräde. Importerade områdens befintliga PDF-ordning bevaras, även när
  överlappande områden har olika skalor.

Visningskopian har fortsatt inbakade objekt men behåller standardiserade skalor.
Det är Spara PDF som ska användas för redigerbara annoteringar.

Återöppningen läser aktuella standardannoteringar och skalor. Externt borttagna
mått eller skalområden kommer inte tillbaka från gamla privata data. Befintliga
mått har en egen kalibrering. Äldre v7-mått migreras vid nästa sparande.

Författare, ämne och popupreferenser bevaras för stödda mått. Ändrade
specialutseenden, egna bildtexter och typer som modellen inte kan representera
behålls som ursprungliga PDF-markeringar. Anisotropa och geospatiala viewports
bevaras som PDF-data i stället för att skrivas om till en felaktig likformig skala.

## Verifiering

- **207 godkända beteendetester**, arkitekturkontroll av **123 källmoduler**,
  produktionsbygge och PWA-generering via `pnpm check`.
- **17 nya PDF-tester**: vanliga annoteringar, native längdmått, skilda sidskalor,
  områdesskala, upprepade rundresor, extern ändring/radering, borttagen privat
  katalog, äldre format, beskärning, rotation, UserUnit, imperiala enheter,
  specialutseenden, författare, popupar, överlappande områden och skalområden som modellen inte stöder.
- **17 berörda webbläsarscenarier godkända**: mätning, PDF-verktyg, bibliotek,
  filer och navigering. Det nya fallet `file/measurement-scale-public-roundtrip`
  sparar och återöppnar mått/skalor, tar bort Liras privata katalog, ändrar den
  offentliga måttskalan och verifierar visat värde samt nästa sparade PDF.
- Kontrollfilen har lästs med separat pypdf och renderats med Poppler. De två
  längdmåtten visar 10 000 respektive 5 000 mm. Filen innehåller sju separata
  annoteringar och två kalibrerade viewports.

Den generella verktygssviten innehåller nu 67 scenarier. Den föregående fulla
körningen omfattade 66; denna ändring har verifierats med den relevanta
17-scenariodelmängden och samtliga beteendetester.

## Kontroll som återstår i Bluebeam Revu

Öppna [kontrollfilen](../output/pdf/lirapdf-bluebeam-kontroll.pdf) med Revu.

1. Kontrollera att markeringarna kan väljas separat och att inget saknas eller
   visas dubbelt. De två måtten ska vara LineDimension-annoteringar.
2. Mät vänster referens: **10 000 mm**, med sidans **1:100**-skala. Mät höger
   referens från en startpunkt inom Detalj A: **5 000 mm**, områdesskala **1:50**.
   Båda referenslinjerna motsvarar 100 mm på pappret.
3. Flytta ett mått och ändra en markerings färg i Revu. Spara under nytt namn.
   Öppna resultatet i Lira och kontrollera läge, värde och utseende.
4. Radera ett mått i Revu, spara igen och kontrollera att det inte återkommer
   i Lira. Kontrollera separat förändrad sid-/områdesskala och nya mätningar.

Detta är en testinstruktion, inte ett intyg om redan utförd Revu-verifiering.
Kontrollfilen kan återskapas med `node scripts/create-interop-check.mjs`.

## Tekniska underlag

Implementationen följer [ISO 32000-1, tabell 175 och 260-263](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf)
för längdmått, viewports och mätdictionaries. Bluebeams dokumentation beskriver
[separata sid- och områdesskalor](https://support.bluebeam.com/online-help/revu20/Content/RevuHelp/Menus/Tools/Measure/Calibrate--MV.htm)
och att [kalibrering behöver sparas i sidan för att följa med filen](https://support.bluebeam.com/online-help/revu-mac-2/Content/RevuHelp/Menus/Window/Panels/Measurements/Measure-Tab--MV.htm).
Bluebeams egna utökningar och dess faktiska tolkning av filen måste fortfarande
kontrolleras i Revu enligt stegen ovan.
