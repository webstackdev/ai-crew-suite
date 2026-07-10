/*
 * Hi!
 *
 * Note that this is an EXAMPLE Backstage backend. Please check the README.
 *
 * Happy hacking!
 */

import { createBackend } from '@backstage/backend-defaults';
import type { BackendFeature } from '@backstage/backend-plugin-api';

type BackendFeatureModule = { default: BackendFeature };

const loadBackendFeature = (loader: Promise<unknown>) =>
  loader as Promise<BackendFeatureModule>;

const backend = createBackend();

backend.add(
  loadBackendFeature(
    import('@backstage/plugin-app-backend'),
  ),
);
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-proxy-backend'),
  ),
);

// scaffolder plugin
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-scaffolder-backend'),
  ),
);
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-scaffolder-backend-module-github'),
  ),
);
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-scaffolder-backend-module-notifications'),
  ),
);

// techdocs plugin
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-techdocs-backend'),
  ),
);

// auth plugin
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-auth-backend'),
  ),
);
// See https://backstage.io/docs/backend-system/building-backends/migrating#the-auth-plugin
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-auth-backend-module-guest-provider'),
  ),
);
// See https://backstage.io/docs/auth/guest/provider

// catalog plugin
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-catalog-backend'),
  ),
);
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
  ),
);

// See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-catalog-backend-module-logs'),
  ),
);

// Installing the permission plugin
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-permission-backend'),
  ),
);
backend.add(
  loadBackendFeature(
    import('./plugins/permission.js'),
  ),
);

// search plugin
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-search-backend'),
  ),
);

// search engine
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-search-backend-module-pg'),
  ),
);

// search collators
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-search-backend-module-catalog'),
  ),
);
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-search-backend-module-techdocs'),
  ),
);

// kubernetes plugin
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-kubernetes-backend'),
  ),
);

// notifications and signals plugins
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-notifications-backend'),
  ),
);
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-signals-backend'),
  ),
);

// mcp actions plugin
backend.add(
  loadBackendFeature(
    import('@backstage/plugin-mcp-actions-backend'),
  ),
);

backend.start();
