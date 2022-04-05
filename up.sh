#!/bin/bash
# Change Directory to the actual location of this script. Makes dealing with mounts, relative directores, etc. nicer
cd $( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
pwd=$(pwd)

# Can be used when setting up vault
gomplate_noauth="docker run \
            --rm -i \
            --mount type=bind,source=$pwd/configs,target=/mnt \
            --network config-net \
            hairyhenderson/gomplate:stable"

# Check state of overlay network
if [ "$(docker network ls | grep config-net -c)" == 0 ]; then
   docker network create -d overlay --attachable config-net;
   echo "Created missing overlay network 'config-net'";
else
  echo "Found overlay network 'config-net'.";
  if [ "$(docker network inspect config-net -f {{.Attachable}})" == false ]; then
    echo "Overlay network 'config-net' is not attachable! Exiting...";
    exit 1;
  fi;
fi;

# Ensure that the traefik-ingress network exists
if [ "$(docker network ls | grep traefik-ingress -c)" == 0 ]; then
  docker network create -d overlay traefik-ingress;
  echo "Created missing overlay network 'traefik-ingress'";
else
  echo "Found overlay network 'traefik-ingress'."
fi;


result=$(cat ./stacks/00-vault.stack.yml | $gomplate_noauth  --config /mnt/gomplate.config.yml -o -)
if [ "$DRY" == "false" ]; then
  echo "$result" | docker stack deploy config -c -;
else
  echo "$result"
fi;

# TODO: Ensure that pki is set up for vault?
# TODO: Figure out how to wire stuff up to vault automatically?
#   -- i.e. postgres, redis, rabbitmq, minio, etc.

# Create an alias so we don't have to repeat ourselves every time we process a configuration file.
gomplate="docker run \
            --rm -i \
            --mount type=bind,source=$pwd/configs,target=/mnt \
            --network config-net \
            -e VAULT_TOKEN=$(cat ~/.vault-token) \
            hairyhenderson/gomplate:stable"

# TODO: Make sure that the vault token exists
# TODO: Convert from vault token to vault tls certificate

# TODO: Use Vault for minio access credentials, instead of docker secrets
if [ "$(docker secret ls | grep Minio.AccessKey -c)" == 0 ]; then
  echo 'Secret "Minio.AccessKey" not found! Please create it and run this again'
  echo  'echo "Your Access Key" | docker secret create Minio.AccessKy -';
  exit 1;
fi;
if [ "$(docker secret ls | grep Minio.SecretKey -c)" == 0 ]; then
  echo 'Secret "Minio.SecretKey" not found! Please create it and run this again'
  echo  'echo "Your Secret Key" | docker secret create Minio.SecretKey -'
  exit 1;
fi;

result=$(cat ./stacks/10-sprocket.stack.yml | $gomplate  --config /mnt/gomplate.config.yml -o -)
if [ "$DRY" == "false" ]; then
  echo "$result" | docker stack deploy sprocket -c -;
else
  echo "$result"
fi;