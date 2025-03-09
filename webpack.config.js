import * as fs from "fs";

export default {
  target: "web",
  mode: "development",
  output: {
    filename: "web/[name]",
    libraryTarget: "module",
  },
  entry: fs
    .readdirSync("./dist/web", { withFileTypes: true })
    .filter((dir) => dir.isDirectory())
    .map((dir) => `./dist/web/${dir.name}/main.js`)
    .filter((file) => fs.existsSync(file))
    .concat(["./dist/web/main.js"])
    .reduce(
      (e, f) => Object.assign(e, { [f.replace("dist/web/", "")]: f }),
      {}
    ),
  optimization: {
    minimize: true,
  },
  experiments: {
    outputModule: true,
  },
};
