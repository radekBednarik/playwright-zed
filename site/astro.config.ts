import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';

const repository = 'https://github.com/radekBednarik/playwright-zed';

// https://astro.build/config
export default defineConfig({
  site: 'https://radekbednarik.github.io',
  base: '/playwright-zed',
  integrations: [
    starlight({
      title: 'Playwright Runner',
      description:
        'Run and manage Playwright end-to-end tests from the Zed editor. Community extension, not affiliated with Microsoft.',
      social: [{ icon: 'github', label: 'GitHub', href: repository }],
      editLink: { baseUrl: `${repository}/edit/main/site/` },
      lastUpdated: true,
      customCss: [
        '@fontsource-variable/jetbrains-mono',
        '@fontsource-variable/inter',
        './src/styles/theme.css',
      ],
      sidebar: [
        {
          label: 'Getting started',
          items: [
            { label: 'Requirements', slug: 'getting-started/requirements' },
            { label: 'Install', slug: 'getting-started/install' },
            { label: 'First run', slug: 'getting-started/first-run' },
          ],
        },
        {
          label: 'Features',
          items: [
            { label: 'Run tests', slug: 'features/run-tests' },
            { label: 'Projects', slug: 'features/projects' },
            { label: 'Step labels and run output', slug: 'features/step-labels-and-output' },
            { label: 'Trace viewer', slug: 'features/trace-viewer' },
            { label: 'Show browser', slug: 'features/show-browser' },
            { label: 'Discovery consent', slug: 'features/discovery-consent' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Settings', slug: 'reference/settings' },
            { label: 'Differences from the VS Code extension', slug: 'reference/differences' },
            { label: 'State files', slug: 'reference/state-files' },
            { label: 'Parity', slug: 'reference/parity' },
          ],
        },
        { label: 'Help', slug: 'help' },
      ],
      plugins: [starlightLinksValidator()],
    }),
  ],
});
