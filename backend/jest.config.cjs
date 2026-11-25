/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/src/**/*.spec.ts", "<rootDir>/test/**/*.spec.ts"],
  setupFiles: ["<rootDir>/test/setup-env.ts"],
  globalSetup: "<rootDir>/test/global-setup.cjs",
  testTimeout: 60000,
  clearMocks: true,
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: {
        module: "commonjs",
        target: "ES2022",
        esModuleInterop: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        strict: true,
        skipLibCheck: true,
      },
    }],
    "^.+\\.js$": "<rootDir>/test/esm-to-cjs.cjs",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(@nestjs|file-type|strtok3|token-types|uint8array-extras|@tokenizer|@borewit)/)",
  ],
};
