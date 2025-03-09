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
    .map((dir) => `${dir.name}/main.js`)
    .filter((file) => fs.existsSync(file))
    .concat(["/main.js"])
    .reduce((x, f) => Object.assign(x, { [f]: `./dist/web/${f}` }), {}),
  optimization: {
    minimize: true,
  },
  experiments: {
    outputModule: true,
  },
};
