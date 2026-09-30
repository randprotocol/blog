// Shared pieces for the generated OG images: randprotocol.org's ink palette and
// the Rand mark (a 4x4 tile with one hot pixel, as in src/components/Brand.astro),
// drawn with plain boxes because satori lays out flex boxes, not page CSS.

export const INK = {
  bg: "#0E1220",
  surface: "#161C2C",
  border: "#2B3350",
  text: "#ECE9E2",
  textSoft: "#ABAFBF",
  textStrong: "#FFFDF8",
  accent: "#5B8DEF",
};

const ON = [0, 2, 5, 7, 8, 10, 13, 15, 1, 11];
const HOT = 11;

/**
 * The mark at `unit` pixels per grid unit (the tile is 23 units square).
 */
export function mark(unit = 2) {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        position: "relative",
        width: 23 * unit,
        height: 23 * unit,
      },
      children: ON.map(i => ({
        type: "div",
        props: {
          style: {
            position: "absolute",
            left: (i % 4) * 6 * unit,
            top: Math.floor(i / 4) * 6 * unit,
            width: 5 * unit,
            height: 5 * unit,
            background: i === HOT ? INK.accent : INK.text,
          },
        },
      })),
    },
  };
}

/**
 * The frame every image shares: ink background, one surface card.
 */
export function frame(children) {
  return {
    type: "div",
    props: {
      style: {
        background: INK.bg,
        color: INK.text,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
      children: {
        type: "div",
        props: {
          style: {
            border: `2px solid ${INK.border}`,
            background: INK.surface,
            borderRadius: "16px",
            display: "flex",
            justifyContent: "center",
            width: "88%",
            height: "80%",
          },
          children: {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                margin: "32px",
                width: "90%",
                height: "86%",
              },
              children,
            },
          },
        },
      },
    },
  };
}
