const esbuild = require("esbuild");

module.exports = {
  process(source) {
    const result = esbuild.transformSync(source, { loader: "js", format: "cjs", target: "es2022" });
    return { code: result.code };
  },
};
