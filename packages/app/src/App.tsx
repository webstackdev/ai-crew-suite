import { createApp } from '@backstage/frontend-defaults';
import type { FrontendFeature } from '@backstage/frontend-plugin-api';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import notificationsPlugin from '@backstage/plugin-notifications/alpha';
import searchPlugin from '@backstage/plugin-search/alpha';
import { navModule } from './modules/nav';

const features: FrontendFeature[] = [
  catalogPlugin as FrontendFeature,
  notificationsPlugin as FrontendFeature,
  searchPlugin as FrontendFeature,
  navModule as FrontendFeature,
];

export default createApp({
  features,
});
