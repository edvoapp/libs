# `@edvoapp/util`

Code representing the "util" layer

The types in this package have the following characteristics:

- They represent abstractions above the graph database.
- They do not expose the data store as an API. (Aspirationally.)
- TBD: DO they interact with the data store directly, or through graph abstractions which are satisfied via dependency injection? (That could allow use of these classes without strong coupling to the data store layer.)
- The types in this package do not present an appearance; that is left to a separate "view" layer, probably as a React component wrapping the model type.

## How To Run

See main README. In general:

1. Run `npm ci` in the root directory
2. Run `npm run dev` in this directory to compile the modules.
