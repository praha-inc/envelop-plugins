import { AsyncLocalStorage } from 'node:async_hooks';

import { createTestkit } from '@envelop/testing';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { describe, it, expect, vi } from 'vitest';

import { createRequestCachePlugin } from './index';

describe('createRequestCachePlugin', () => {
  describe('cache', () => {
    it('throws error if called outside of request context', () => {
      const plugin = createRequestCachePlugin();
      const cachedFunction = plugin.cache(() => 42);

      expect(() => {
        cachedFunction();
      }).toThrow('Request cache is not available. Make sure to use the "useRequestCache" plugin during execution.');
    });

    it('caches result per request context', async () => {
      const storage = new AsyncLocalStorage<Record<string, unknown>>();
      const plugin = createRequestCachePlugin({ storage });

      const spy = vi.fn(() => Math.random());
      const cachedFunction = plugin.cache(spy);

      // eslint-disable-next-line @typescript-eslint/require-await
      const result = await storage.run({}, async () => {
        const a = cachedFunction();
        const b = cachedFunction();
        return { a, b };
      });

      expect(result.a).toBe(result.b);
      expect(spy).toHaveBeenCalledOnce();
    });

    it('separates caches per request', async () => {
      const storage = new AsyncLocalStorage<Record<string, unknown>>();
      const plugin = createRequestCachePlugin({ storage });

      const spy = vi.fn(() => Math.random());
      const cachedFunction = plugin.cache(spy);

      // eslint-disable-next-line @typescript-eslint/require-await
      const a = await storage.run({}, async () => cachedFunction());
      // eslint-disable-next-line @typescript-eslint/require-await
      const b = await storage.run({}, async () => cachedFunction());

      expect(a).not.toBe(b);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('caches result per function arguments', async () => {
      const storage = new AsyncLocalStorage<Record<string, unknown>>();
      const plugin = createRequestCachePlugin({ storage });

      const spy = vi.fn((a: number, b: number) => a + b);
      const cachedFunction = plugin.cache(spy);

      // eslint-disable-next-line @typescript-eslint/require-await
      const { a, b, c } = await storage.run({}, async () => {
        const a = cachedFunction(1, 2);
        const b = cachedFunction(1, 2);
        const c = cachedFunction(2, 2);
        return { a, b, c };
      });

      expect(a).toBe(3);
      expect(b).toBe(3);
      expect(c).toBe(4);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('caches result per keys', async () => {
      const storage = new AsyncLocalStorage<Record<string, unknown>>();
      const plugin = createRequestCachePlugin({ storage });

      const spy = vi.fn((a: number, b: number) => a + b);
      const cachedFunction1 = plugin.cache(spy, ['a']);
      const cachedFunction2 = plugin.cache(spy, ['b']);

      // eslint-disable-next-line @typescript-eslint/require-await
      const { a, b } = await storage.run({}, async () => {
        const a = cachedFunction1(1, 2);
        const b = cachedFunction2(1, 2);
        return { a, b };
      });

      expect(a).toBe(3);
      expect(b).toBe(3);
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('useRequestCache', () => {
    it('wraps execution in AsyncLocalStorage context', async () => {
      const plugin = createRequestCachePlugin();
      const cachedFunction = plugin.cache(() => 'hello');

      const schema = makeExecutableSchema({
        typeDefs: /* GraphQL */ `
          type Query {
            hello: String
          }
        `,
        resolvers: {
          Query: {
            hello: () => {
              return cachedFunction();
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
