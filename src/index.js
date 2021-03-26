const assert = require('assert')

module.exports = function joinMonsterAdapt(schema, jmConfigs) {
  for (let typeName in jmConfigs) {
    // get the type definition from the schema
    const type = schema._typeMap[typeName]
    assert(type, `Type with name ${typeName} not found in schema.`)
    // and transfer some properties over from the passed join monster config
    decorateType(type, jmConfigs[typeName])
  }
}

function decorateType(type, jmConfig) {
  // first get the properties that should be on the type directly
  type._typeConfig = {}
  type._typeConfig.sqlTable = jmConfig.sqlTable
  type._typeConfig.uniqueKey = jmConfig.uniqueKey
  if (jmConfig.alwaysFetch) {
    type._typeConfig.alwaysFetch = jmConfig.alwaysFetch
  }
  // These properties may appear for interface types
  if (jmConfig.typeHint) {
    type._typeConfig.typeHint = jmConfig.typeHint
  }
  if (jmConfig.resolveType) {
    type._typeConfig.resolveType = jmConfig.resolveType
  }

  if (jmConfig.extensions) { // version 3 of Join-Monster 
    Object.assign(type.extensions = {}, jmConfig.extensions)
  }

  for (let fieldName in jmConfig.fields) {
    const field = type._fields[fieldName]
    assert(field, `Field "${fieldName}" not found in type "${type.name}".`)
    Object.assign(field, jmConfig.fields[fieldName])
  }
}
