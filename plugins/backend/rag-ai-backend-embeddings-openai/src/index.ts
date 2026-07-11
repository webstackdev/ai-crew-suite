/*
 * Copyright 2024 Larder Software Limited
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
import { AuthService, LoggerService } from '@backstage/backend-plugin-api';
import { CatalogApi } from '@backstage/catalog-client';
import {
  PluginEndpointDiscovery,
  TokenManager,
} from '@backstage/backend-common';
import { Config } from '@backstage/config';
import { AugmentationOptions } from '@webstackbuilders/plugin-ai-retrieval-node';
import { AugmentationIndexer, VectorStore } from '@webstackbuilders/plugin-ai-core-node';
import { OpenAiConfig, OpenAiAugmenter } from './OpenAiAugmenter';

export interface BedrockEmbeddingsConfig {
  logger: LoggerService;
  tokenManager?: TokenManager;
  auth?: AuthService;
  vectorStore: VectorStore;
  catalogApi: CatalogApi;
  discovery: PluginEndpointDiscovery;
  config: Config;
}

export async function initializeOpenAiEmbeddings({
  logger,
  tokenManager,
  auth,
  vectorStore,
  catalogApi,
  discovery,
  config,
}: BedrockEmbeddingsConfig): Promise<AugmentationIndexer> {
  logger.info('Initializing  OpenAI Embeddings');
  const openAiConfig = config.get<OpenAiConfig>('ai.embeddings.openai');

  const embeddingsOptions = config.getOptionalConfig('ai.embeddings');
  const augmentationOptions: AugmentationOptions = {};
  if (embeddingsOptions) {
    augmentationOptions.chunkSize =
      embeddingsOptions.getOptionalNumber('chunkSize');
    augmentationOptions.chunkOverlap =
      embeddingsOptions.getOptionalNumber('chunkOverlap');
    augmentationOptions.concurrencyLimit =
      embeddingsOptions.getOptionalNumber('concurrencyLimit');
  }
  return new OpenAiAugmenter({
    vectorStore,
    catalogApi,
    discovery,
    augmentationOptions,
    logger: logger.child({ label: 'roadie-openai-embeddings' }),
    tokenManager,
    auth,
    config: openAiConfig,
  });
}
