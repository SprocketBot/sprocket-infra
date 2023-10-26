resource "proxmox_vm_qemu" "sprocket-vm-template" {
    name = "sprocket-template-${var.base_vmid}" # Add vmid to prevent overlap with other things
    # Put the template on the first node in the list
    target_node = var.vm_hosts[0]
    vmid = var.base_vmid
    
    # Never start this
    onboot = false
    oncreate = false
    
    # Tag so this isn't a mystery
    tags = "nomad;sprocket;tofu"

    cpu = "kvm64"
    cores = 1 # Resources will be re-allocated by derived VMs
    memory = 0.5 * 1024
    balloon = 0.5 * 1024
    qemu_os = "other"
    agent = 1
    os_type = "cloud-init"

    # Doing it this way means we don't need to mount an iso
    # The operating system comes from the image installation in the provisioner
    pxe = true
    boot = "order=net0;scsi0"
    network {
        bridge    = "vmbr0"
        firewall  = false
        link_down = false
        model     = "e1000"
    }

    # Define a connection for the remote provisioner
    connection {
        type = "ssh"
        user = "root"
        private_key = file(var.proxmox_private_key_path)
        host = var.proxmox_host
    }

    provisioner "remote-exec" {
        when = create
        # Download and setup the flatcar qemu drive
        inline = [
            # Download and import disk
            "wget -nc https://stable.release.flatcar-linux.net/amd64-usr/current/flatcar_production_qemu_image.img -O /tmp/flatcar_production_sprocket.qcow2",
            "qm importdisk ${self.vmid} /tmp/flatcar_production_sprocket.qcow2 ${var.target_storage}",
            "qm rescan",
            # Mount disk and set it as the boot drive (Note it is created as a 16G disk)
            "qm set ${self.vmid} --scsi0 ${var.target_storage}:${self.vmid}/vm-${self.vmid}-disk-0.raw,size=16G --boot order=scsi0",
            # Convert this into a template
            "qm template ${self.vmid}"
        ]
    }
    
    # These change somewhat frequently, and are manipulated by the provision script ; re-creating the template is a waste of time
    lifecycle {
        ignore_changes = [ disk, network, boot ]
    }
}
