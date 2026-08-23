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
import type { Preview, ReactRenderer } from '@storybook/react-vite';
import type { DecoratorFunction } from 'storybook/internal/types';
import { CssBaseline } from '@material-ui/core';
import { themes, UnifiedThemeProvider } from '@backstage/theme';
import { TestApiProvider, wrapInTestApp } from '@backstage/test-utils';
import { alertApiRef, errorApiRef, ErrorApi } from '@backstage/core-plugin-api';

const mockErrorApi: Partial<ErrorApi> = {
  post: () => {},
  error$: () => ({
    subscribe: () => ({ closed: false, unsubscribe: () => {} }),
    [Symbol.observable]() { return this; },
  }),
};

const backstageDecorator: DecoratorFunction<ReactRenderer> = (Story, context) => {
  const selectedThemeKey = context.globals.theme || 'light';
  // 2. Select the matching Backstage theme wrapper object
  const activeTheme = selectedThemeKey === 'dark' ? themes.dark : themes.light;
  const mockAlertApi = { post: () => {} };

  const storyMockApis = context.loaded?.mockApis || [];

  return (
    <TestApiProvider apis={[
      [alertApiRef, mockAlertApi], 
      [errorApiRef, mockErrorApi],
      ...storyMockApis
    ]}>
      <UnifiedThemeProvider theme={activeTheme}>
        <CssBaseline />
        {wrapInTestApp(<Story />, context.parameters.backstage)}
      </UnifiedThemeProvider>
    </TestApiProvider>
  );
};

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      expanded: true,
      matchers: { color: /(background|color)$/i, date: /Date$/i }
    },
    docs: { source: { type: 'dynamic' } },
    options: { panelPosition: 'bottom' },
  },
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Backstage Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light Mode' },
          { value: 'dark', title: 'Dark Mode' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [backstageDecorator],
};

export default preview;
