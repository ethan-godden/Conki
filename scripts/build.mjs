// Assembles dist/, which holds everything that goes into Anki:
//
//   dist/front.html, dist/back.html   note type > Cards > Front / Back Template
//   dist/style.css                    note type > Cards > Styling
//   dist/media/*                      the profile's collection.media folder
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const dist = join(root, "dist");
const require = createRequire(import.meta.url);

// The libraries' own browser builds, copied unchanged out of node_modules.
const libraries = {
  "_markdown-it.min.js": require.resolve("markdown-it/browser"),
  "_diff.min.js": join(dirname(require.resolve("diff/package.json")), "dist/diff.min.js"),
};

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "media"), { recursive: true });

await copyFile(join(src, "templates/front.html"), join(dist, "front.html"));
await copyFile(join(src, "templates/back.html"), join(dist, "back.html"));
await copyFile(join(src, "style.css"), join(dist, "style.css"));
await copyFile(join(src, "_code-card.js"), join(dist, "media/_code-card.js"));
for (const [name, file] of Object.entries(libraries)) {
  await copyFile(file, join(dist, "media", name));
}

for (const entry of await readdir(dist, { recursive: true, withFileTypes: true })) {
  if (entry.isFile()) console.log(relative(root, join(entry.parentPath, entry.name)));
}
