targetScope = 'subscription'

param groups array

module resourceGroups 'br/public:avm/res/resources/resource-group:0.4.1' = [for group in groups: {
  name: 'rg-${uniqueString(group.name, group.location)}'
  params: {
    name: group.name
    location: group.location
    tags: group.tags
  }
}]

output resourceGroupNames array = [for group in groups: group.name]