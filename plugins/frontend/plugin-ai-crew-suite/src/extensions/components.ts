/*
 * Copyright 2026 Webstack Builders, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import React from 'react';
import { PageBlueprint } from '@backstage/frontend-plugin-api';
import { rootRouteRef } from '../routes';

export const ragModalExtension = PageBlueprint.make({
  name: 'rag-modal',
  params: {
    path: '/ai-crew-suite',
    title: 'AI Crew Suite',
    routeRef: rootRouteRef,
    loader: () =>
      // @ts-expect-error - NodeNext requires explicit .js extension, but webpack PnP cannot resolve .js to .ts source
      import('../components/RagModal').then(m =>
        React.createElement(m.UncontrolledRagModal),
      ),
  },
});

export const sidebarRagModalExtension = PageBlueprint.make({
  name: 'sidebar-rag-modal',
  params: {
    path: '/ai-crew-suite/sidebar',
    title: 'AI Crew Suite Sidebar',
    loader: () =>
      // @ts-expect-error - NodeNext requires explicit .js extension, but webpack PnP cannot resolve .js to .ts source
      import('../components/RagModal').then(m =>
        React.createElement(m.SidebarRagModal),
      ),
  },
});
