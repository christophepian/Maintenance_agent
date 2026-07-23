import { mergeConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import remarkGfm from "remark-gfm";

/** @type {import('@storybook/react-vite').StorybookConfig} */
const config = {
  stories: [
    "../components/**/*.mdx",
    "../components/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    {
      // remark-gfm enables GitHub-flavored markdown (tables, strikethrough,
      // task lists) inside the MDX docs pages.
      name: "@storybook/addon-docs",
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: { remarkPlugins: [remarkGfm] },
        },
      },
    },
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // Vite-based Storybook: sidesteps Next 16 × Storybook-framework compat.
  // These UI primitives are pure React + Tailwind (no next/* imports), so
  // @tailwindcss/vite is all we need to generate the token-driven classes.
  async viteFinal(cfg) {
    return mergeConfig(cfg, {
      plugins: [tailwindcss()],
      // App components use JSX without `import React` (Next.js supplies the
      // automatic runtime). Force the same automatic runtime here so JSX
      // doesn't compile to classic `React.createElement` → "React is not defined".
      esbuild: { jsx: "automatic" },
      optimizeDeps: { esbuildOptions: { jsx: "automatic" } },
    });
  },
};

export default config;
