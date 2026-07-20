import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';

export const pluginAiCoreModuleObservability = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'observability',
  register(reg) {
    reg.registerInit({
      deps: { logger: coreServices.logger },
      async init({ logger }) {
        logger.info('Hello World!');
      },
    });
  },
});
