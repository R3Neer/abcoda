import tseslint from "typescript-eslint";

const v2Files = [
  "packages/**/*.ts",
  "apps/**/*.ts",
  "tests/v2/**/*.ts",
  "tests/worker/**/*.ts",
  "tests/browser/**/*.ts",
  "playwright.config.ts",
];

export default tseslint.config(
  {
    ignores: ["**/dist/**", "node_modules/**", "**/*.d.ts"],
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: v2Files,
  })),
  {
    files: v2Files,
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.v2.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
  {
    files: ["packages/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "node:*",
                "abcjs",
                "@modelcontextprotocol/*",
                "cloudflare:*",
                "../../application/**",
                "../../abc-codec/**",
                "../../contracts/**",
                "../../../apps/**"
              ],
              message: "The domain must not depend on infrastructure, adapters, or external contracts."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["packages/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "node:*",
                "abcjs",
                "@modelcontextprotocol/*",
                "cloudflare:*",
                "../../abc-codec/**",
                "../../contracts/**",
                "../../../apps/**"
              ],
              message: "Application use cases may depend on the domain and their own ports, never adapters or hosts."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["apps/widget/src/**/*.ts"],
    ignores: ["apps/widget/src/adapters/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "abcjs",
              message: "abcjs belongs behind an adapter."
            },
            {
              name: "@modelcontextprotocol/ext-apps",
              message: "MCP Apps belongs behind HostBridge."
            }
          ],
          patterns: [
            {
              group: ["cloudflare:*"],
              message: "The browser app must not depend on the Cloudflare runtime."
            }
          ]
        }
      ]
    }
  }
);
