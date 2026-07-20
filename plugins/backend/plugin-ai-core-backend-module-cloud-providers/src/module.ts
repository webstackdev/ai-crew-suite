import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';

export const pluginAiCoreModuleCloudProviders = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'cloud-providers',
  register(reg) {
    reg.registerInit({
      deps: { logger: coreServices.logger },
      async init({ logger }) {
        logger.info('Hello World!');
      },
    });
  },
});
