#!/bin/bash

cd $( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
pwd=$(pwd)

# http because we are inside the docker overlay network, traefik may not be listening yet.
VAULT_ADDR=http://vault:8200
vault="docker run \
              --rm -i \
              --network config-net \
              -e VAULT_ADDR=$VAULT_ADDR \
              vault:1.9.3"

# Check if the vault has already been stood up
vault_configured=$($vault status | grep Initialized | sed 's/^Initialized[ ]*//')
if [ "$vault_configured" == "false" ]; then
  # If the vault has not been stood up, initialize it
  $vault operator init > top_sneaky
  # Parse the output into the root token and the unseal tokens
  grep 'Initial Root Token: ' top_sneaky | sed 's/^.*: //' > root_token.txt
  grep 'Unseal Key ' top_sneaky | sed 's/^.*: //' > unseal_tokens.txt
  # Remove the temp file
  rm top_sneaky
  # Provide a warning
  echo "Vault has been initialized."
  echo "Your unseal keys are stored at $pwd/unseal_tokens.txt"
  echo "Your root token is stored at $pwd/root_token.txt"
  echo "It is highly recommended that you move those somewhere else."
  echo "If you lose the unseal tokens, you will be unable to access the vault!"
  # Unseal the vault
  head -3 vault_output.txt | \
  while read -r a; do
    $vault operator unseal "$a";
  done;
fi;

vault_sealed=$($vault status | grep Sealed | sed 's/^Sealed[ ]*//')
if [ "$vault_sealed" == "true" ]; then
  echo "Please unseal the vault and try again!"
fi;

vault="docker run \
              --rm -i \
              --network config-net \
              -e VAULT_ADDR=$VAULT_ADDR \
              -e VAULT_TOKEN=$(cat root_token.txt) \
              vault:1.9.3"

pki_enabled=$($vault secrets list | grep pki | wc -l)
echo $pki_enabled


