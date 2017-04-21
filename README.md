# Join Monster GraphQL Tools Adapter

Use [Join Monster](https://github.com/stems/join-monster)'s SQL generation and query batching powers with the Apollo [graphql-tools](https://github.com/apollographql/graphql-tools) server package.

### What's this package for?

Suppose you have a GraphQL schema for a forum website, defined with the [Schema Language](http://graphql.org/learn/schema/#type-language) like so:

```js
const typeDefs = `
type Comment {
  id: Int!,
  body: String!,
  postId: Int,
  authorId: Int,
  archived: Boolean
}

type Post {
  id: Int!,
  body: String!,
  authorId: Int,
  numComments: Int!,
  comments: [Comment]
}

type User {
  id: Int!,
  email: String!,
  fullName: String!,
  favNums: [Int],
  posts: [Post]
}

type Query {
  user(id: Int!): User
}
`

module.exports = typeDefs
```

When using [graphql-js](https://github.com/graphql/graphql-js), the reference implementation, you tag the Type constructors with extra metadata to configure Join Monster.
The schema language does not allow adding arbitrary properties to the type definitions.

This package let's you add those tags without messing with the internals of the built schema object.
Once you familiarize yourself with [Join Monster's API](http://join-monster.readthedocs.io), you can use all the same properties by passing it to this function.


```js
const joinMonsterAdapt = require('join-monster-graphql-tools-adapter')
const typeDefs = require('../path/to/types')

const joinMonster = require('join-monster').default
// node drivers for talking to SQLite
const db = require('sqlite')
const { makeExecutableSchema } = require('graphql-tools')

const resolvers = {
  Query: {
    // call joinMonster in the "user" resolver, and all child fields that are tagged with "sqlTable" are handled!
    user(parent, args, ctx, resolveInfo) {
      return joinMonster(resolveInfo, ctx, sql => {
        return db.all(sql)
      }, { dialect: 'sqlite3' })
    }
  },
  User: {
    // the only field that needs a resolver, joinMonster hydrates the rest!
    fullName(user) {
      return user.first_name + ' ' + user.last_name
    }
  }
}

const schema = makeExecutableSchema({
  typeDefs,
  resolvers
})

// tag the schema types with the extra join monster metadata
joinMonsterAdapt(schema, {
  Query: {
    fields: {
      // add a function to generate the "where condition"
      user: {
        where: (table, args) => `${table}.id = ${args.id}`
      }
    }
  },
  User: {
    // map the User object type to its SQL table
    sqlTable: 'accounts',
    uniqueKey: 'id',
    // tag the User's fields
    fields: {
      email: {
        sqlColumn: 'email_address'
      },
      fullName: {
        sqlDeps: [ 'first_name', 'last_name' ],
      },
      posts: {
        sqlJoin: (userTable, postTable) => `${userTable}.id = ${postTable}.author_id`,
      }
    }
  },
  Post: {
    sqlTable: 'posts',
    uniqueKey: 'id',
    fields: {
      numComments: {
        // count with a correlated subquery
        sqlExpr: table => `(SELECT count(*) FROM comments where ${table}.id = comments.post_id)`
      },
      comments: {
        // fetch the comments in another batch request instead of joining
        sqlBatch: {
          thisKey: 'post_id',
          parentKey: 'id'
        }
      }
    }
  },
  Comment: {
    sqlTable: 'comments',
    uniqueKey: 'id',
    fields: {
      postId: {
        sqlColumn: 'post_id'
      },
      authorId: {
        sqlColumn: 'author_id'
      }
    }
  }
})
```

Now that our schema is *Join-monsterized*, we are ready to start executing some queries!

```js
const { graphql } = require('graphql')

const query = `{
  user(id: 1) {
    id
    fullName
    email
    posts {
      id
      body
      numComments
      comments {
        id
        body
        authorId
        archived
      }
    }
  }
}`
graphql(schema, query).then(doSomethingCrazy)
```
