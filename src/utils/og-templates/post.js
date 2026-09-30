import satori from "satori";
import { SITE } from "@/config";
import loadGoogleFonts from "../loadGoogleFont";
import { INK, frame, mark } from "./brand";

export default async post => {
  return satori(
    frame([
      {
        type: "p",
        props: {
          style: {
            fontSize: 68,
            fontWeight: "bold",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            color: INK.textStrong,
            maxHeight: "84%",
            overflow: "hidden",
            margin: 0,
          },
          children: post.data.title,
        },
      },
      {
        type: "div",
        props: {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            fontSize: 28,
          },
          children: [
            {
              type: "span",
              props: {
                style: { color: INK.textSoft },
                children: [
                  "by ",
                  {
                    type: "span",
                    props: {
                      style: { color: "transparent" },
                      children: '"',
                    },
                  },
                  {
                    type: "span",
                    props: {
                      style: {
                        overflow: "hidden",
                        fontWeight: "bold",
                        color: INK.text,
                      },
                      children: post.data.author,
                    },
                  },
                ],
              },
            },
            {
              type: "div",
              props: {
                style: { display: "flex", alignItems: "center", gap: 16 },
                children: [
                  mark(2),
                  {
                    type: "span",
                    props: {
                      style: { overflow: "hidden", fontWeight: "bold" },
                      children: SITE.title,
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ]),
    {
      width: 1200,
      height: 630,
      embedFont: true,
      fonts: await loadGoogleFonts(
        post.data.title + post.data.author + SITE.title + "by"
      ),
    }
  );
};
