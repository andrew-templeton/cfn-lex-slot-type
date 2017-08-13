
var AWS = require('aws-sdk')
var CfnLambda = require('cfn-lambda')

var LexModelBuildingService = new AWS.LexModelBuildingService({
  apiVersion: '2017-04-19'
})

const Upsert = CfnLambda.SDKAlias({
  api: LexModelBuildingService,
  method: 'putSlotType',
  returnPhysicalId: 'name',
  returnAttrs: [
    'version',
    'checksum'
  ]
})

const Update = function (RequestPhysicalID, CfnRequestParams, OldCfnRequestParams, reply) {
  const sameName = CfnRequestParams.name === OldCfnRequestParams.name
  function go () {
    Upsert(RequestPhysicalID, CfnRequestParams, OldCfnRequestParams, reply)
  }
  if (CfnRequestParams.checksum || !sameName) {
    console.log('Name change or checksum provided, do not need to look up.')
    return go()
  }
  console.log('Name is same and no checksum provided, must acquire to update.')
  getSlotAttrs(OldCfnRequestParams, function (err, attrs) {
    if (err) {
      return reply(err)
    }
    console.log('Checksum value: %s', attrs.checksum)
    CfnRequestParams.checksum = attrs.checksum
    go()
  })
}

const Delete = CfnLambda.SDKAlias({
  api: LexModelBuildingService,
  method: 'deleteSlotType',
  keys: ['name'],
  ignoreErrorCodes: [404]
})

const NoUpdate = function (PhysicalResourceId, CfnResourceProperties, reply) {
  console.log('Noop update must drive "version" and "checksum" attributes.')
  getSlotAttrs(CfnResourceProperties, function (err, attrs) {
    if (err) {
      return next(err)
    }
    console.log('Replying w/ PhysicalResourceId %s and Attributes: %j', attrs)
    reply(null, PhysicalResourceId, attrs)
  })
}

exports.handler = CfnLambda({
  Create: Upsert,
  Update: Update,
  Delete: Delete,
  NoUpdate: NoUpdate
})

function getSlotAttrs (props, next) {
  const latestVersion = '$LATEST'
  const slotTypeParams = {
    name: props.name,
    version: latestVersion
  }
  console.log('Accessing current slot version with getSlotType: %j', slotTypeParams)
  LexModelBuildingService.getSlotType(slotTypeParams, function (err, slotTypeData) {
    if (err) {
      console.error('Problem accessing data during read to SlotType: %j', err)
      return next(err.code + ': ' + err.message)
    }
    console.log('Got SlotType information back: %j', slotTypeData)
    const slotTypeReplyAttrs = {
      checksum: slotTypeData.checksum,
      version: latestVersion
    }
    console.log('SlotType attributes: %j', slotTypeReplyAttrs)
    next(null, slotTypeReplyAttrs)
  })
}
