const GLOBAL_NAME = '__@backstage/module_federation_shared_dependencies__';

globalThis[GLOBAL_NAME] = {
  items: [
    {
      name: 'react',
      version: '18.3.1',
      lib: () => import('react'),
      shareConfig: {
        singleton: true,
        requiredVersion: '*',
        eager: true,
      },
    },
    {
      name: 'react-dom',
      version: '18.3.1',
      lib: () => import('react-dom'),
      shareConfig: {
        singleton: true,
        requiredVersion: '*',
        eager: true,
      },
    },
    {
      name: 'react-router',
      version: '6.30.4',
      lib: () => import('react-router'),
      shareConfig: {
        singleton: true,
        requiredVersion: '*',
        eager: true,
      },
    },
    {
      name: 'react-router-dom',
      version: '6.30.4',
      lib: () => import('react-router-dom'),
      shareConfig: {
        singleton: true,
        requiredVersion: '*',
        eager: true,
      },
    },
    {
      name: '@material-ui/core/styles',
      version: '4.12.4',
      lib: () => import('@material-ui/core/styles'),
      shareConfig: {
        singleton: true,
        requiredVersion: '*',
        eager: true,
      },
    },
  ],
  version: 'v1',
};
