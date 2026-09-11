import { defineConfig } from 'astro/config';
import yaml from '@rollup/plugin-yaml';

export default defineConfig({
  site: 'https://shub.ca',
  output: 'static',
  build: { inlineStylesheets: 'always' },
  vite: { plugins: [yaml()] },
});
