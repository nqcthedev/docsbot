// Bundles the embeddable widget into static files served by Next.js from /public:
//   public/widget.js        – loader pasted on customer sites
//   public/widget/chat.js   – chat app inside the iframe
//   public/widget/chat.css
import { build } from "esbuild";

const common = { bundle: true, minify: true, target: ["es2020"], legalComments: "none", logLevel: "warning" };

await Promise.all([
  build({ ...common, entryPoints: ["src/widget/loader.ts"], outfile: "public/widget.js", format: "iife" }),
  build({ ...common, entryPoints: ["src/widget/chat.ts"], outfile: "public/widget/chat.js", format: "iife" }),
  build({ ...common, entryPoints: ["src/widget/chat.css"], outfile: "public/widget/chat.css" }),
]);
console.log("Widget built → public/widget.js, public/widget/chat.{js,css}");
