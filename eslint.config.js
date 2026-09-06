import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.ts'],
    rules: {
      // `process` does not exist in a browser. Vite substitutes it during a
      // production build but NOT in dev, so a stray `process.env` builds fine
      // and then blanks the page on `npm run dev`. Build-time configuration
      // belongs in scripts/, which runs in Node.
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'src/ runs in the browser. Read build-time config in scripts/ instead.' },
        { name: '__dirname', message: 'src/ runs in the browser.' },
        { name: 'require', message: 'src/ runs in the browser. Use ES imports.' },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      // The domain layer must stay free of framework and browser dependencies.
      // This is the architecture rule from docs/ARCHITECTURE.md, enforced.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react/*'], message: 'The domain layer must not depend on React.' },
            { group: ['@mediapipe/*'], message: 'The domain must depend on its ports, not on MediaPipe. Add an adapter in src/infrastructure.' },
            { group: ['pdf-lib'], message: 'The domain must depend on DocumentWriter, not on pdf-lib.' },
            { group: ['@infrastructure/*', '@ui/*', '@application/*'], message: 'Dependencies point inward: the domain may not import outer layers.' },
          ],
        },
      ],
    },
  },
)
