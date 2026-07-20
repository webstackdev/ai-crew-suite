import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';

export const aiCoreModuleVcs = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'vcs',
  register(reg) {
    reg.registerInit({
      deps: { logger: coreServices.logger },
      async init({ logger }) {
        logger.info('Hello World!');
      },
    });
  },
});
