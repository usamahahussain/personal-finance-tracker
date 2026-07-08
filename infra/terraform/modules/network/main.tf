locals {
  admin_allowed_cidrs            = distinct(var.admin_allowed_cidrs)
  additional_admin_allowed_cidrs = slice(local.admin_allowed_cidrs, 1, length(local.admin_allowed_cidrs))
}

resource "oci_core_security_list" "pft" {
  compartment_id = var.compartment_ocid
  vcn_id         = var.existing_vcn_id
  display_name   = "pft-${var.environment}-sl"
}

resource "oci_core_network_security_group" "app" {
  compartment_id = var.compartment_ocid
  vcn_id         = var.existing_vcn_id
  display_name   = "pft-${var.environment}-app-nsg"
}

resource "oci_core_network_security_group_security_rule" "app_ssh_ingress" {
  network_security_group_id = oci_core_network_security_group.app.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = local.admin_allowed_cidrs[0]
  source_type               = "CIDR_BLOCK"

  tcp_options {
    destination_port_range {
      min = 22
      max = 22
    }
  }
}

resource "oci_core_network_security_group_security_rule" "app_ssh_additional_ingress" {
  for_each = toset(local.additional_admin_allowed_cidrs)

  network_security_group_id = oci_core_network_security_group.app.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = each.value
  source_type               = "CIDR_BLOCK"

  tcp_options {
    destination_port_range {
      min = 22
      max = 22
    }
  }
}

resource "oci_core_network_security_group_security_rule" "app_http_ingress" {
  network_security_group_id = oci_core_network_security_group.app.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = local.admin_allowed_cidrs[0]
  source_type               = "CIDR_BLOCK"

  tcp_options {
    destination_port_range {
      min = 80
      max = 80
    }
  }
}

resource "oci_core_network_security_group_security_rule" "app_http_additional_ingress" {
  for_each = toset(local.additional_admin_allowed_cidrs)

  network_security_group_id = oci_core_network_security_group.app.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = each.value
  source_type               = "CIDR_BLOCK"

  tcp_options {
    destination_port_range {
      min = 80
      max = 80
    }
  }
}

resource "oci_core_network_security_group_security_rule" "app_https_ingress" {
  network_security_group_id = oci_core_network_security_group.app.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = local.admin_allowed_cidrs[0]
  source_type               = "CIDR_BLOCK"

  tcp_options {
    destination_port_range {
      min = 443
      max = 443
    }
  }
}

resource "oci_core_network_security_group_security_rule" "app_https_additional_ingress" {
  for_each = toset(local.additional_admin_allowed_cidrs)

  network_security_group_id = oci_core_network_security_group.app.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = each.value
  source_type               = "CIDR_BLOCK"

  tcp_options {
    destination_port_range {
      min = 443
      max = 443
    }
  }
}

resource "oci_core_network_security_group_security_rule" "app_egress" {
  network_security_group_id = oci_core_network_security_group.app.id
  direction                 = "EGRESS"
  protocol                  = "all"
  destination               = "0.0.0.0/0"
  destination_type          = "CIDR_BLOCK"
}

resource "oci_core_network_security_group" "db" {
  compartment_id = var.compartment_ocid
  vcn_id         = var.existing_vcn_id
  display_name   = "pft-${var.environment}-db-nsg"
}

resource "oci_core_network_security_group_security_rule" "db_sqlnet_ingress_from_app" {
  network_security_group_id = oci_core_network_security_group.db.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source                    = oci_core_network_security_group.app.id
  source_type               = "NETWORK_SECURITY_GROUP"

  tcp_options {
    destination_port_range {
      min = 1522
      max = 1522
    }
  }
}

resource "oci_core_subnet" "app" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = var.existing_vcn_id
  cidr_block                 = var.app_subnet_cidr
  display_name               = "pft-${var.environment}-app-subnet"
  dns_label                  = "pftapp"
  route_table_id             = var.existing_public_route_table_id
  prohibit_public_ip_on_vnic = false
  security_list_ids          = [oci_core_security_list.pft.id]
}

resource "oci_core_subnet" "db" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = var.existing_vcn_id
  cidr_block                 = var.db_subnet_cidr
  display_name               = "pft-${var.environment}-db-subnet"
  dns_label                  = "pftdb"
  prohibit_public_ip_on_vnic = true
  security_list_ids          = [oci_core_security_list.pft.id]
}
