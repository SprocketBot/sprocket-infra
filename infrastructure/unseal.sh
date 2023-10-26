#!/usr/bin/env fish

# set target_str (pulumi stack --show-urns | grep unseal | grep -v ::unseal| string split "URN: " | grep urn:pulumi | awk '{print "--target \'" $1 "\'"}')

pulumi up --target 'urn:pulumi:infra::SprocketInfrastructure::SprocketBot:LogicalGroup:deployed-vault$SprocketBot:Service:Vault$SprocketBot:OneOff:VaultAutoInitializer$command:remote:Command::*-unseal' --skip-preview -y