# @praha/envelop-request-cache

[![npm version](https://badge.fury.io/js/@praha%2Fenvelop-request-cache.svg)](https://www.npmjs.com/package/@praha/envelop-request-cache)
[![npm download](https://img.shields.io/npm/dm/@praha/envelop-request-cache.svg)](https://www.npmjs.com/package/@praha/envelop-request-cache)
[![license](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/praha-inc/envelop-request-cache/blob/main/LICENSE)
[![Github](https://img.shields.io/github/followers/praha-inc?label=Follow&logo=github&style=social)](https://github.com/orgs/praha-inc/followers)

This plugin caches arbitrary values within the request scope to optimize execution flow.

## 👏 Getting Started

### Installation

```bash
npm install @praha/envelop-request-cache
```

### Usage

This plugin provides request-scoped caching for any arbitrary values using `AsyncLocalStorage`.
It's useful for caching expensive computations or shared values (like user information or `DataLoader` instances) within a single GraphQL execution.

#### Basic: Caching a resolved user per request

In this example, we cache the result of a `getUserById` function so that it's only called once per request.

```ts
import { createServer } from 'node:http';

import { makeExecutableSchema } from '@graphql-tools/schema';
import { cache, useRequestCache } from '@praha/envelop-request-cache';
import { createYoga } from 'graphql-yoga';

// Wrap your function with `cache`
const getUserById = cache(async (id: string) => {
  console.log('Fetching user...');
  return { id, name: `User: ${id}` };
});

const typeDefs = /* GraphQL */ `
  type User {
    id: ID!
    name: String!
  }

  type Query {
    me: User
  }
`;

const resolvers = {
  Query: {
    me: async () => {
      // This will only call `getUserById` once per request, even if reused
      return getUserById('1');
    },
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

const yoga = createYoga({
  schema,
  plugins: [useRequestCache()],
});

const server = createServer(yoga);

server.listen(4000, () => {
  console.info('Server is running on http://localhost:4000/graphql');
});
```

Even if `getUserById('user-1')` is called multiple times during a request, it will only resolve once and return the cached value.

#### Advanced: Caching a `DataLoader` instance per request

You can use the request cache to instantiate and reuse a `DataLoader` per request, ensuring batch loading works as expected within each request scope.

```ts
import { cache } from '@praha/envelop-request-cache';
import DataLoader from 'dataloader';

// Cache the factory function so that only one instance is created per request
const getUserLoader = cache(() => {
  return new DataLoader(async (ids: readonly string[]) => {
    console.log('Batch loading users...');
    return ids.map((id) => ({ id, name: `User: ${id}` }));
  });
});

const resolvers = {
  Query: {
    me: async () => {
      const loader = getUserLoader();
      return loader.load('1');
    },
    users: async () => {
      const loader = getUserLoader();
      return Promise.all([loader.load('1'), loader.load('2')]);
    },
  },
};
```

With this setup, `getUserLoader` is only called once per request, and all `load()` calls share the same loader instance for batching and caching.

## 🤝 Contributing

Contributions, issues and feature requests are welcome.

Feel free to check [issues page](https://github.com/praha-inc/envelop-plugins/issues) if you want to contribute.

## 📝 License

Copyright © [PrAha, Inc.](https://www.praha-inc.com/)

This project is [```MIT```](https://github.com/praha-inc/envelop-plugins/blob/main/packages/request-cache/LICENSE) licensed.
