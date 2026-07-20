import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';

export const pluginAiCoreModuleCompliance = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'compliance',
  register(reg) {
    reg.registerInit({
      deps: { logger: coreServices.logger },
      async init({ logger }) {
        logger.info('Hello World!');
      },
    });
  },
});
