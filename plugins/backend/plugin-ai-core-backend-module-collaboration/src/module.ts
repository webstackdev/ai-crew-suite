import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';

export const pluginAiCoreModuleCollaboration = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'collaboration',
  register(reg) {
    reg.registerInit({
      deps: { logger: coreServices.logger },
      async init({ logger }) {
        logger.info('Hello World!');
      },
    });
  },
});
