import { mmPerPoint } from "../viewports.js";

export function createCommandPrompt({
  current,
  session,
  workspace,
  scaleContext,
  interaction,
  $,
}) {
  function prompt() {
    const steps = {
      freehand: ["Håll ned och dra för att rita · Esc avslutar"],
      highlight: ["Håll ned och dra för att färgmarkera · Esc avslutar"],
      cloud: ["Välj molnets första hörn", "Välj motsatt hörn"],
      stamp: ["Välj stämpelns första hörn", "Välj motsatt hörn"],
      viewport: ["Välj viewportens första hörn", "Välj motsatt hörn"],
      block: ["Klicka för att placera PDF-block · Esc avslutar"],
      line: [
        "Välj startpunkt",
        "Välj nästa punkt · längd · @dx,dy · längd<vinkel · Esc avslutar",
      ],
      circle: ["Välj centrum", "Välj radiepunkt eller skriv radie"],
      ellipse: ["Välj ellipsens första hörn", "Välj motsatt hörn"],
      rect: ["Välj första hörnet", "Välj motsatt hörn"],
      arc: [
        "Välj bågens startpunkt",
        "Välj en punkt på bågen",
        "Välj bågens slutpunkt",
      ],
      text: ["Klicka och skriv · Ctrl+Enter: klar · Esc: avbryt"],
      leader: ["Välj pilspets", "Välj brytpunkt", "Välj textplacering"],
      dim: [
        "Välj första mätpunkten",
        "Välj andra mätpunkten",
        "Placera måttlinjen",
      ],
      calibrate: [
        "Välj första kalibreringspunkten",
        "Välj andra kalibreringspunkten",
      ],
      replace: ["Dra ett område runt texten"],
      coverLine: ["Välj PDF-linje att täcka med vitt · originalet finns kvar"],
      eraseText: [
        "Peka för att markera en PDF-text · klicka för att ta bort · Esc avslutar",
      ],
      eraseLine: ["Klicka på en fristående rak PDF-linje för att ta bort den"],
      extract: ["Välj PDF-linje att kopiera · originalet finns kvar"],
      mask: ["Dra ett område att täcka · originalinnehållet finns kvar"],
      select: [
        "Välj objekt eller dra ruta · vänster→höger: innanför · höger→vänster: korsande",
      ],
    };
    const selectedOwner =
      current()?.type === "viewport"
        ? current()
        : session.state.entities.find(
            (v) => v.type === "viewport" && v.id === current()?.viewportId,
          );
    const context = selectedOwner
      ? { owner: selectedOwner, scale: selectedOwner.denominator * mmPerPoint }
      : current()
        ? { owner: null, scale: session.state.scales[workspace.pageNo] }
        : scaleContext(interaction.points[0] || interaction.hover);
    const scaleText = context.owner
      ? `Viewport 1:${context.owner.denominator}`
      : context.scale
        ? `Papper 1:${Number((context.scale / mmPerPoint).toFixed(2))}`
        : "Papper · ej kalibrerat";
    const editPrompt =
      interaction.editOperation &&
      {
        select: `${["trim", "extend"].includes(interaction.tool) ? "Välj gränser" : "Välj objekt"} (${interaction.editOperation.ids.length}) · Enter fortsätter`,
        base:
          interaction.tool === "mirror"
            ? "Ange spegelaxelns första punkt"
            : "Ange baspunkt",
        target:
          interaction.tool === "rotate"
            ? "Ange riktning/vinkel i grader · R: referens"
            : interaction.tool === "scale"
              ? "Ange skalfaktor, t.ex. 2 · R: referens"
              : interaction.tool === "mirror"
                ? "Ange spegelaxelns andra punkt · originalet behålls"
                : "Ange målpunkt eller skriv avstånd i mm",
        distance:
          interaction.tool === "fillet"
            ? "Ange radie i mm (0 ger skarpt hörn)"
            : interaction.tool === "chamfer"
              ? "Ange fasavstånd i mm"
              : "Ange offsetavstånd i mm",
        cut:
          interaction.tool === "trim"
            ? "Klicka på delen som ska bort · fortsätt klicka · Esc avslutar"
            : "Klicka nära änden som ska förlängas · fortsätt klicka · Esc avslutar",
        corner: interaction.editOperation.first
          ? "Välj andra linjen på sidan som ska behållas"
          : "Välj första linjen på sidan som ska behållas",
        vertex:
          interaction.tool === "pinsert"
            ? "Klicka för att lägga till hörn"
            : "Klicka på hörnet som ska tas bort",
        refOld:
          interaction.tool === "rotate"
            ? "Referens: ange gammal vinkel eller välj första riktpunkten"
            : "Referens: ange gammal längd i mm eller välj första mätpunkten",
        refPick2: "Referens: välj andra mätpunkten",
        refTarget:
          interaction.tool === "rotate"
            ? "Ange ny vinkel eller välj ny riktning från baspunkten"
            : "Ange ny längd i mm eller välj målpunkt från baspunkten",
        side: "Klicka på önskad sida · Esc avslutar",
      }[interaction.editOperation.phase];
    const next = `${(interaction.activeGrip ? "Grepp: välj ny punkt · längd/radie i mm eller @x,y · Esc avbryter" : null) || editPrompt || steps[interaction.tool]?.[interaction.points.length] || "Välj punkt"} · ${scaleText}`;
    if ($("prompt").textContent !== next) {
      $("prompt").textContent = next;
    }
  }

  return { prompt };
}
