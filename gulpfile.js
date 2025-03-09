import * as fs from "fs/promises";
import GulpClient from "gulp";
import { exec } from "child_process";
import markdown from "gulp-markdown";

const SRCS = ["srv", "web"];

// Clean tasks.

GulpClient.task("clean", async function (done) {
  return fs.rm("dist", { recursive: true, force: true }).then(done);
});

// Build tasks.

GulpClient.task("build:ts", function (cb) {
  // The gulp-typescript plugin is deprecated.
  exec("npx --package typescript tsc -p .", (error, stdout, stderr) => {
    cb(error ? "\n" + stdout || stderr || error : 0);
  });
});

GulpClient.task("build:md", function () {
  const include = SRCS.map((src) => src + "/**/*.md");
  const pipein = GulpClient.src([...include], { base: "." });
  return pipein.pipe(markdown()).pipe(GulpClient.dest("dist"));
});

GulpClient.task("build:assets", function () {
  const exclude = ["!**/*.{js,ts,md}"];
  const include = SRCS.map((src) => src + "/**/*");
  const pipein = GulpClient.src([...include, ...exclude], {
    base: ".",
    encoding: false,
  });
  return pipein.pipe(GulpClient.dest("dist"));
});

GulpClient.task("build:webpack", function (cb) {
  exec("npx webpack", (error, stdout, stderr) => {
    console.log(stdout);
    cb(error ? "\n" + stdout || stderr || error : 0);
  });
});

// Task groups.

GulpClient.task(
  "build",
  GulpClient.series("build:ts", "build:md", "build:assets", "build:webpack")
);
GulpClient.task("default", GulpClient.series("build"));
