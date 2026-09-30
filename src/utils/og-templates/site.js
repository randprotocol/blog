import satori from "satori";
import { SITE } from "@/config";
import loadGoogleFonts from "../loadGoogleFont";
import { INK, frame, mark } from "./brand";

// "randprotocol.org/blog": where the blog lives, without the scheme.
const location = SITE.website.replace(/^https?:\/\//, "").replace(/\/+$/, "");

export default async () => {
  return satori(
    frame([
      {
        type: "div",
        props: {
          style: {
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "86%",
            maxHeight: "86%",
            overflow: "hidden",
            textAlign: "center",
          },
          children: [
            mark(4),
            {
              type: "p",
              props: {
                style: {
                  fontSize: 72,
                  fontWeight: "bold",
                  letterSpacing: "-0.02em",
                  color: INK.textStrong,
                  margin: "36px 0 0",
                },
                children: SITE.title,
              },
            },
            {
              type: "p",
              props: {
                style: {
                  fontSize: 28,
                  lineHeight: 1.4,
                  color: INK.textSoft,
                  margin: "20px 0 0",
                },
                children: SITE.desc,
              },
            },
          ],
        },
      },
      {
        type: "div",
        props: {
          style: {
            display: "flex",
            justifyContent: "flex-end",
            width: "100%",
            fontSize: 28,
          },
          children: {
            type: "span",
            props: {
              style: { overflow: "hidden", fontWeight: "bold" },
              children: location,
            },
          },
        },
      },
    ]),
    {
      width: 1200,
      height: 630,
      embedFont: true,
      fonts: await loadGoogleFonts(SITE.title + SITE.desc + location),
    }
  );
};
