import * as fs from "fs";

const WEB_PREFIX = "./dist/web";

export default {
  target: "web",
  mode: "production",
  output: {
    filename: "web/[name]",
    libraryTarget: "module",
  },
  entry: fs
    .readdirSync(WEB_PREFIX, { withFileTypes: true })
    .filter((dir) => dir.isDirectory())
    .map((dir) => `${dir.name}/main.js`)
    .filter((file) => fs.existsSync(`${WEB_PREFIX}/${file}`))
    .concat(["main.js"])
    .reduce((x, f) => Object.assign(x, { [f]: `${WEB_PREFIX}/${f}` }), {}),
  optimization: {
    minimize: true,
  },
  experiments: {
    outputModule: true,
  },
};
