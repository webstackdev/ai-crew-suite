import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { scaffolderCustomizations } from './scaffolder/scaffolderModule';
import { navModule } from './modules/nav';

export default createApp({
  features: [
    catalogPlugin,
    navModule,
    scaffolderCustomizations,
  ],
});
