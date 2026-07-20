import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';

export const pluginAiCoreModuleQualityScorecards = createBackendModule({
  pluginId: 'ai-core',
  moduleId: 'quality-scorecards',
  register(reg) {
    reg.registerInit({
      deps: { logger: coreServices.logger },
      async init({ logger }) {
        logger.info('Hello World!');
      },
    });
  },
});
