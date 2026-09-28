import subprocess
from typing import List, Dict, Any, Optional
from .base import NetworkAdapterBase, NetworkInterface

class NetworkManagerAdapter(NetworkAdapterBase):
    def get_interfaces(self) -> List[NetworkInterface]:
        interfaces = []
        try:
            # Get interfaces via nmcli device status
            res = subprocess.run(["nmcli", "-t", "device", "status"], capture_output=True, text=True, check=True)
            for line in res.stdout.strip().split("\n"):
                if not line:
                    continue
                parts = line.split(":")
                if len(parts) >= 3:
                    iface = parts[0]
                    itype = parts[1]
                    state = parts[2]
                    
                    if itype in ["ethernet", "wifi"]:
                        # Get details for this interface
                        show_res = subprocess.run(["nmcli", "-t", "device", "show", iface], capture_output=True, text=True)
                        ip_addr = None
                        gateway = None
                        dns_list = []
                        dhcp_enabled = True
                        
                        for show_line in show_res.stdout.strip().split("\n"):
                            if "IP4.ADDRESS" in show_line:
                                ip_addr = show_line.split(":")[1].split("/")[0]
                            elif "IP4.GATEWAY" in show_line:
                                gateway = show_line.split(":")[1]
                            elif "IP4.DNS" in show_line:
                                dns_list.append(show_line.split(":")[1])
                                
                        # Check method by querying active connection profile if any
                        conn_res = subprocess.run(["nmcli", "-t", "-f", "connection.id,ipv4.method", "connection", "show", "--active"], capture_output=True, text=True)
                        for conn_line in conn_res.stdout.strip().split("\n"):
                            if not conn_line:
                                continue
                            c_parts = conn_line.split(":")
                            if len(c_parts) >= 2:
                                if c_parts[1] == "manual":
                                    dhcp_enabled = False
                                    
                        interfaces.append(NetworkInterface(
                            name=iface,
                            ip_address=ip_addr,
                            netmask=self._get_netmask_from_nm_show(show_res.stdout),
                            gateway=gateway,
                            dns=dns_list,
                            dhcp=dhcp_enabled,
                            status="up" if state == "connected" else "down"
                        ))
        except Exception as e:
            print(f"[NetworkManagerAdapter] Error querying nmcli: {e}")
        return interfaces

    def _get_netmask_from_nm_show(self, output: str) -> Optional[str]:
        # Helper to convert CIDR prefix to netmask
        for line in output.split("\n"):
            if "IP4.ADDRESS" in line:
                addr_cidr = line.split(":")[1]
                if "/" in addr_cidr:
                    prefix = int(addr_cidr.split("/")[1])
                    return self._prefix_to_netmask(prefix)
        return None

    def _prefix_to_netmask(self, prefix: int) -> str:
        mask = (0xffffffff >> (32 - prefix)) << (32 - prefix)
        return f"{(mask >> 24) & 0xff}.{(mask >> 16) & 0xff}.{(mask >> 8) & 0xff}.{mask & 0xff}"

    def _netmask_to_prefix(self, netmask: str) -> int:
        return sum(bin(int(x)).count('1') for x in netmask.split('.'))

    def _get_connection_id(self, iface: str) -> Optional[str]:
        try:
            res = subprocess.run(["nmcli", "-t", "-f", "NAME,DEVICE", "connection", "show", "--active"], capture_output=True, text=True, check=True)
            for line in res.stdout.strip().split("\n"):
                if not line:
                    continue
                parts = line.split(":")
                if len(parts) == 2 and parts[1] == iface:
                    return parts[0]
            # Try showing all connections
            res = subprocess.run(["nmcli", "-t", "-f", "NAME,DEVICE", "connection", "show"], capture_output=True, text=True, check=True)
            for line in res.stdout.strip().split("\n"):
                if not line:
                    continue
                parts = line.split(":")
                if len(parts) == 2 and parts[1] == iface:
                    return parts[0]
        except Exception:
            pass
        return None

    def save_backup(self, iface: str) -> None:
        ifaces = self.get_interfaces()
        for i in ifaces:
            if i.name == iface:
                self.backup_config[iface] = {
                    "dhcp": i.dhcp,
                    "ip_address": i.ip_address,
                    "netmask": i.netmask,
                    "gateway": i.gateway,
                    "dns": i.dns
                }
                print(f"[NetworkManagerAdapter] Backed up {iface} configuration: {self.backup_config[iface]}")
                return

    def apply_static_ip(self, iface: str, ip: str, netmask: str, gateway: str, dns: Optional[List[str]] = None) -> bool:
        conn_id = self._get_connection_id(iface)
        if not conn_id:
            print(f"[NetworkManagerAdapter] Active connection not found for {iface}, creating one...")
            conn_id = f"iot-{iface}"
            subprocess.run(["sudo", "nmcli", "connection", "add", "type", "ethernet", "ifname", iface, "con-name", conn_id], capture_output=True)
            
        prefix = self._netmask_to_prefix(netmask)
        dns_str = " ".join(dns) if dns else "8.8.8.8 8.8.4.4"
        try:
            subprocess.run(["sudo", "nmcli", "connection", "modify", conn_id, 
                            "ipv4.method", "manual",
                            "ipv4.addresses", f"{ip}/{prefix}",
                            "ipv4.gateway", gateway,
                            "ipv4.dns", dns_str], check=True, capture_output=True)
            # Reapply connection
            subprocess.run(["sudo", "nmcli", "connection", "up", conn_id], check=True, capture_output=True)
            return True
        except Exception as e:
            print(f"[NetworkManagerAdapter] Error applying static configuration: {e}")
            return False

    def apply_dhcp(self, iface: str) -> bool:
        conn_id = self._get_connection_id(iface)
        if not conn_id:
            return False
        try:
            subprocess.run(["sudo", "nmcli", "connection", "modify", conn_id,
                            "ipv4.method", "auto",
                            "ipv4.addresses", "",
                            "ipv4.gateway", "",
                            "ipv4.dns", ""], check=True, capture_output=True)
            subprocess.run(["sudo", "nmcli", "connection", "up", conn_id], check=True, capture_output=True)
            return True
        except Exception as e:
            print(f"[NetworkManagerAdapter] Error applying DHCP configuration: {e}")
            return False

    def rollback(self, iface: str) -> bool:
        backup = self.backup_config.get(iface)
        if not backup:
            return False
        if backup["dhcp"]:
            return self.apply_dhcp(iface)
        else:
            return self.apply_static_ip(
                iface=iface,
                ip=backup["ip_address"],
                netmask=backup["netmask"],
                gateway=backup["gateway"],
                dns=backup["dns"]
            )
