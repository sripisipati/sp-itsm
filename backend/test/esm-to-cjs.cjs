const ts = require("typescript");

module.exports = {
  process(source, filename) {
    let rewritten = source.replace(
      /import \{ createRequire \} from ['"]node:module['"];\s*const require = createRequire\(import\.meta\.url\);/,
      "const localRequire = require('module').createRequire(__filename);",
    );
    if (rewritten.includes("const localRequire")) {
      rewritten = rewritten
        .split("\n")
        .map((line) => (line.includes("const localRequire") ? line : line.replace(/\brequire\(/g, "localRequire(")))
        .join("\n");
    }
    rewritten = rewritten.replace(/import\.meta\.url/g, "require('url').pathToFileURL(__filename).href");
    const result = ts.transpileModule(rewritten, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        strict: false,
      },
      fileName: filename,
    });
    return { code: result.outputText };
  },
};
