import angularConfig from '@kovalenko/eslint/nestjs';

export default [
  ...angularConfig.filter((config) => {
    if ('ignores' in config) {
      return !config.ignores.includes('projects/**/*');
    }
    return true;
  }),
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly',
      },
    },
  },
];
