import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { ValidateKebabCaseFieldExtension } from './ValidateKebabCase';

export const scaffolderCustomizations = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [ValidateKebabCaseFieldExtension],
});
