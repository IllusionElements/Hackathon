/** @format */

class ModelBase {
  names = new Set()

  _modelsCache = new Map()

  _schemasCache = new Map()

  has = (query, type) => {
    switch (type) {
      case 'schema':
      case 'Schema':
        return this._schemasCache.has(query)
      case 'Model':
      case 'model':
        return this._modelsCache.has(query)
      default:
        return this.names.has(query)
    }
  }

  Schema = async (name, schema, override = false) => {
    const SimpleSchema = import('simpl-schema')
    if (this._schemasCache.has(name) && !!override) {
      this._schemasCache.set(name, schema)
    }

    if (schema instanceof SimpleSchema) {
      this._modelsCache.set(name, schema)
    } else {
      const Schema = Array.isArray(schema) ? new SimpleSchema(...schema) : new SimpleSchema(schema)
      this._schemasCache.set(name, Schema)
    }
  }

  Model = async () => ''

  init = ({ name, Schema, Model}) => this
    .Schema(name, Schema)
    .then(() => this.Model(name, Model))
    .then(() => this.names.set(name))
}

export const Nova = new ModelBase()
const addSchema = ({ schema, collection, adder }) => {
  if (typeof schema === 'function' && collection) {
    adder(schema(collection))
  } else {
    adder(collection, schema)
  }
}

export class Model {
  constructor({
    name, collection, Schema, methods, Controller,
  } = {}) {
    const context = {
      name: name || this.name(),
      db: collection || this.collection,
      schema: Schema || this.Schema,
    }
    import('meteor/mongo').then(({ Mongo: { Collection } }) => {
      if (collection instanceof Collection) {
        this.db = collection
      } else {
        this.db = new Collection(collection)
      }
    })
    if (Schema && !this.Schema) {
      addSchema({
        schema: Schema,
        adder: this.addSchema,
        collection,
      })
    } else if (!Schema && this.Schema) {
      addSchema({
        schema: Schema,
        adder: this.addSchema,
        collection,
      })
    }

    if (methods) {
      import('meteor/mdg:validated-method').then(({ ValidatedMethod }) => {
        this.methods = methods.reduce((main, { name: methodName, method, ...rest }) => {
          const run = (...args) => method({ context }, ...args)
          const validatedMethod = new ValidatedMethod({
            run,
            ...rest,
          })

          return {
            ...main,
            [methodName]: validatedMethod,
          }
        }, {})
      })

      if (Controller) {
        this.Controller = new Controller({
          db: collection,
          model: this,
        })
      }

      if (!Nova.has(name)) {
        Nova.init({
          name,
          Schema: Schema || this.Schema,
          Model: Model || this.Model,
        })
      }
    }
  }
}
