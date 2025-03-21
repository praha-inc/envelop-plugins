import { AsyncLocalStorage } from 'node:async_hooks';

import type { Plugin } from '@envelop/core';

export type CreateRequestCachePluginOptions = {
  storage?: AsyncLocalStorage<Record<string, unknown>>;
};

export const createRequestCachePlugin = (options: CreateRequestCachePluginOptions = {}) => {
  const storage = options.storage ?? new AsyncLocalStorage<Record<string, unknown>>();

  return {
    cache: <T>(callback: () => T): T => {
      const store = storage.getStore();
      if (!store) {
        throw new Error('Request cache is not available. Make sure to use the "useRequestCache" plugin during execution.');
      }

      const key = callback.toString();
      const cached = store[key];
      if (cached) return cached as T;

      const result = callback();
      store[key] = result;
      return result as unknown as T;
    },
    useRequestCache: (): Plugin => ({
      onExecute: ({ executeFn, setExecuteFn }) => {
        setExecuteFn(async (arguments_) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return storage.run({}, async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return await executeFn(arguments_);
          });
        });
      },
    }),
  };
};

export const {
  cache,
  useRequestCache,
} = createRequestCachePlugin();
