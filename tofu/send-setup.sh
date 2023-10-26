#!/usr/bin/env bash


# Create a secure tar file
tar -cf hl-sprocket.tar -C . --exclude modules/digitalocean_vm --exclude send-setup.sh --exclude "*.tfstate.*" --exclude "secret.auto.tfvars" --exclude "modules/services" *
echo "Archive created as hl-sprocket.tar"
wormhole send hl-sprocket.tar
echo "Archive Sent"
rm hl-sprocket.tar
echo "Archive Deleted"