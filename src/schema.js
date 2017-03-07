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
    user(parent, args, ctx, resolveInfo) {
      return joinMonster(resolveInfo, ctx, sql => {
        return db.all(sql)
      }, { dialect: 'sqlite3' })
    }
  },
  User: {
    fullName(user) {
      return user.first_name + ' ' + user.last_name
    }
  }
}

const schema = makeExecutableSchema({
  typeDefs,
  resolvers
})

joinMonsterAdapt(schema, {
  Query: {
    fields: {
      user: {
        where: (table, args) => `${table}.id = ${args.id}`
      }
    }
  },
  User: {
    sqlTable: 'accounts',
    uniqueKey: 'id',
    fields: {
      fullName: {
        sqlDeps: [ 'first_name', 'last_name' ],
      },
      email: {
        sqlColumn: 'email_address'
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
        sqlExpr: table => `(SELECT count(*) FROM comments where ${table}.id = comments.post_id)`
      },
      comments: {
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

db.open('../db/test1-data.sl3')
.then(() => graphql(schema, query))
.then(res => {
  console.log(require('util').inspect(res, { depth: 10 })) // eslint-disable-line
})
.catch(console.error) // eslint-disable-line

