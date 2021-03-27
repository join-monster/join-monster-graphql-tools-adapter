const path = require('path')
const { makeExecutableSchema } = require('graphql-tools')
const { graphql } = require('graphql')
const db = require('sqlite')
const joinMonster = require('join-monster').default
const joinMonsterAdapt = require('./index')

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

const resolvers = {
  Query: {
    // call joinMonster in the "user" resolver, and all child fields that are tagged with "sqlTable" are handled!
    user(parent, args, ctx, resolveInfo) {
      return joinMonster(
        resolveInfo,
        ctx,
        sql => {
          return db.all(sql)
        },
        { dialect: 'sqlite3' }
      )
    }
  },
  User: {
    // the only field that needs a resolvers, joinMonster hydrates the rest!
    fullName(user) {
      return user.first_name + ' ' + user.last_name
    }
  }
}

const schema = makeExecutableSchema({
  typeDefs,
  resolvers
})

// tag the types with the extra join monster metadata
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
        sqlDeps: ['first_name', 'last_name']
      },
      posts: {
        sqlJoin: (userTable, postTable) =>
          `${userTable}.id = ${postTable}.author_id`
      }
    }
  },
  Post: {
    sqlTable: 'posts',
    uniqueKey: 'id',
    fields: {
      numComments: {
        // count with a correlated subquery
        sqlExpr: table =>
          `(SELECT count(*) FROM comments where ${table}.id = comments.post_id)`
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


const schema_v3 = makeExecutableSchema({
  typeDefs,
  resolvers
})

// tag the types with the extra join monster metadata
joinMonsterAdapt(schema_v3, {
  Query: {
    fields: {
      // add a function to generate the "where condition"
      user: {
        extensions: {
          JoinMonster: {
            where: (table, args) => `${table}.id = ${args.id}`
          }
        }
      }
    }
  },
  User: {
    // map the User object type to its SQL table
    extensions: {
      JoinMonster: {
        sqlTable: 'accounts',
        uniqueKey: 'id',
      }
    },
    // tag the User's fields
    fields: {
      email: {
        extensions: {
          JoinMonster: {
            sqlColumn: 'email_address'
          }
        }
      },
      fullName: {
        extensions: {
          JoinMonster: {
            sqlDeps: ['first_name', 'last_name']
          }
        }
      },
      posts: {
        extensions: {
          JoinMonster: {
            sqlJoin: (userTable, postTable) =>
              `${userTable}.id = ${postTable}.author_id`
          }
        }
      }
    }
  },
  Post: {
    sqlTable: 'posts',
    uniqueKey: 'id',
    fields: {
      numComments: {
        // count with a correlated subquery
        extensions: {
          JoinMonster: {
            sqlExpr: table =>
              `(SELECT count(*) FROM comments where ${table}.id = comments.post_id)`
          }
        }
      },
      comments: {
        // fetch the comments in another batch request instead of joining
        extensions: {
          JoinMonster: {
            sqlBatch: {
              thisKey: 'post_id',
              parentKey: 'id'
            }
          }
        }
      }
    }
  },
  Comment: {
    extensions: {
      JoinMonster: {
        sqlTable: 'comments',
        uniqueKey: 'id',
      }
    },
    fields: {
      postId: {
        extensions: {
          JoinMonster: {
            sqlColumn: 'post_id'
          }
        }
      },
      authorId: {
        extensions: {
          JoinMonster: {
            sqlColumn: 'author_id'
          }
        }
      }
    }
  }
})



it('works (deprecated)', async () => {
  await db.open(path.join(__dirname, '..', 'db', 'test1-data.sl3'))
  const res = await graphql(schema, query)
  expect(res).toMatchSnapshot()
})



it('works (v3)', async () => {
  await db.open(path.join(__dirname, '..', 'db', 'test1-data.sl3'))
  const res = await graphql(schema_v3, query)
  expect(res).toMatchSnapshot()
})