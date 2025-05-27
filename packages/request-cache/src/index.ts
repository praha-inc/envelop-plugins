import { AsyncLocalStorage } from 'node:async_hooks';

import type { Plugin } from '@envelop/core';

export type CreateRequestCachePluginOptions = {
  storage?: AsyncLocalStorage<Record<string, unknown>>;
};

export const createRequestCachePlugin = (options: CreateRequestCachePluginOptions = {}) => {
  const storage = options.storage ?? new AsyncLocalStorage<Record<string, unknown>>();

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cache: <T extends (...args: any[]) => any>(callback: T, keys?: string[]): T => {
      return ((...args) => {
        const store = storage.getStore();
        if (!store) {
          throw new Error('Request cache is not available. Make sure to use the "useRequestCache" plugin during execution.');
        }

        const key = `${callback.toString()}-${JSON.stringify(args)}${keys ? `-[${keys.join(',')}]` : ''}`;
        const cached = store[key];
        if (cached) return cached as T;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-assignment
        const result = callback(...args);
        store[key] = result;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      }) as T;
    },
    evict: (): void => {
      const store = storage.getStore();
      if (!store) {
        throw new Error('Request cache is not available. Make sure to use the "useRequestCache" plugin during execution.');
      }

      Object.keys(store).forEach((key) => {
        delete store[key];
      });
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
  evict,
  useRequestCache,
} = createRequestCachePlugin();
