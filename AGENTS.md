# LiraPDF Web

Läs `docs/architecture.md` innan ändringar i arbetsytan, editorn eller dokumentflödet.

- `src/app.js` startar appen. `src/app/pdf-application.js` kopplar uttryckliga beroenden för en appinstans. Nya beteenden hör till ansvarig controller.
- Bekräftade dokumentändringar går genom `editor/document-editor.js`. Validering ska lyckas innan dokument och historik ändras. Import och byte av aktiv session behåller uttryckliga livscykler.
- Förhandsvisningar är separata utkast. Flytta inte dragförhandsvisningar till den godkända modellen, lagringen eller historiken.
- UI visar tillstånd och anropar redigeringsfunktioner. Meny- eller panelbyte ändrar inte dokumentet eller markeringsmängden. Behåll befintliga kontroll-ID:n och kommandoägare.
- Modell, geometri och PDF-regler ska fungera utan DOM, UI-controllerer eller browserlagring. Rendering får inte bekräfta modelländringar.
- Meny och inspektor använder den fasta ljusa Lira-paletten i `lira-shell.css` och `src/ui/`. Skapa inte parallella UI-fabriker eller dubbla kontroller.
- Alla källmoduler registreras i `docs/module-responsibilities.json`. Kör `pnpm check` vid refaktorering och kontrollera berörda arbetsflöden i webbläsaren. Lägg till beteendetester för faktiska felrisker, inte tester som kopierar implementationen eller enbart verifierar CSS-klasser.
- Pekar-/tangentbordsadaptrar hör till `src/input/`; editorcontrollerer är DOM-fria. UI och lagring kopplas via uttryckliga callbacks.
- PDF-rasterjobb ägs av `rendering/page-renderer.js`; sidlivscykel av `app/page-controller.js`. Avbryt jobb och frigör resurser vid dokumentbyte/stängning.
- Intern dokumentvalidering är separat från projektformat. Validera sidreferenser mot PDF:ens sidantal när det är känt.
- Återställningsfel får inte skriva över olästa data eller kasta bort felande dokumentposter. Lagring rapporterar framgång först efter slutförd transaktion.
- Arkitekturkontrollen omfattar även återexporter, DOM-/lagringsgränser och beroendecykler. Intern kod importerar ägarmoduler framför kompatibilitetsfasader.
- Vid ändringar i verktyg, inmatning eller deras bindningar: kör relevanta scenarier med `pnpm test:tools` mot en startad app. `TOOL_FILTER` väljer delmängd. Kontrollera resultat och ångra/gör om; enbart knappaktivering räcker inte.
- Mått och kalibrering ska skrivas/läsas som standardiserade PDF-annoteringar och VP/Measure-data. Privata metadata får inte återinföra externt borttagna objekt/skalor. Bevara PDF-ordning för importerade överlappande mätområden och lämna skalor/utseenden som modellen inte stöder intakta.
