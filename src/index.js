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
  const typeConfig = type._typeConfig
  typeConfig.sqlTable = jmConfig.sqlTable
  typeConfig.uniqueKey = jmConfig.uniqueKey
  if (jmConfig.alwaysFetch) {
    typeConfig.alwaysFetch = jmConfig.alwaysFetch
  }
  // These properties may appear for interface types
  if (jmConfig.typeHint) {
    typeConfig.typeHint = jmConfig.typeHint
  }
  if (jmConfig.resolveType) {
    typeConfig.resolveType = jmConfig.resolveType
  }
  for (let fieldName in jmConfig.fields) {
    const field = type._fields[fieldName]
    assert(field, `Field "${fieldName}" not found in type "${type.name}".`)
    Object.assign(field, jmConfig.fields[fieldName])
  }
}
