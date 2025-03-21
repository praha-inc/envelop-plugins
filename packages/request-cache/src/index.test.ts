import { AsyncLocalStorage } from 'node:async_hooks';

import { createTestkit } from '@envelop/testing';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { describe, it, expect, vi } from 'vitest';

import { createRequestCachePlugin } from './index';

describe('createRequestCachePlugin', () => {
  describe('cache', () => {
    it('throws error if called outside of request context', () => {
      const plugin = createRequestCachePlugin();

      expect(() => {
        plugin.cache(() => 42);
      }).toThrow('Request cache is not available. Make sure to use the "useRequestCache" plugin during execution.');
    });

    it('caches result per request context', async () => {
      const storage = new AsyncLocalStorage<Record<string, unknown>>();
      const plugin = createRequestCachePlugin({ storage });

      const spy = vi.fn(() => Math.random());

      // eslint-disable-next-line @typescript-eslint/require-await
      const result = await storage.run({}, async () => {
        const a = plugin.cache(spy);
        const b = plugin.cache(spy);
        return { a, b };
      });

      expect(result.a).toBe(result.b);
      expect(spy).toHaveBeenCalledOnce();
    });

    it('separates caches per request', async () => {
      const storage = new AsyncLocalStorage<Record<string, unknown>>();
      const pluginWithStorage = createRequestCachePlugin({ storage });

      const spy = vi.fn(() => Math.random());

      // eslint-disable-next-line @typescript-eslint/require-await
      const a = await storage.run({}, async () => pluginWithStorage.cache(spy));
      // eslint-disable-next-line @typescript-eslint/require-await
      const b = await storage.run({}, async () => pluginWithStorage.cache(spy));

      expect(a).not.toBe(b);
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('useRequestCache', () => {
    it('wraps execution in AsyncLocalStorage context', async () => {
      const plugin = createRequestCachePlugin();

      const schema = makeExecutableSchema({
        typeDefs: /* GraphQL */ `
          type Query {
            hello: String
          }
        `,
        resolvers: {
          Query: {
            hello: () => {
              return plugin.cache(() => 'hello');
            },
          },
        },
      });

      const testkit = createTestkit([plugin.useRequestCache()], schema);
      const result = await testkit.execute('{ hello }');

      expect(result).toEqual({
        data: {
          hello: 'hello',
        },
      });
    });
  });
});
