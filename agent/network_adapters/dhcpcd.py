import os
import shutil
import subprocess
from typing import List, Dict, Any, Optional
from .base import NetworkAdapterBase, NetworkInterface

class DhcpcdNetworkAdapter(NetworkAdapterBase):
    def __init__(self):
        super().__init__()
        self.conf_path = "/etc/dhcpcd.conf"
        self.backup_path = "/tmp/dhcpcd.conf.bak"

    def get_interfaces(self) -> List[NetworkInterface]:
        interfaces = []
        try:
            import psutil
            stats = psutil.net_if_stats()
            addrs = psutil.net_if_addrs()
            
            # Read /etc/dhcpcd.conf to check if static IP is set for eth/wlan
            static_ifaces = set()
            if os.path.exists(self.conf_path):
                with open(self.conf_path, "r") as f:
                    current_iface = None
                    for line in f:
                        line = line.strip()
                        if line.startswith("interface "):
                            current_iface = line.split()[1]
                        elif line.startswith("static ip_address") and current_iface:
                            static_ifaces.add(current_iface)

            for name, ip_list in addrs.items():
                if name == "lo" or name.startswith("docker"):
                    continue
                
                ip = None
                mask = None
                for addr in ip_list:
                    if addr.family == 2: # AF_INET
                        ip = addr.address
                        mask = addr.netmask
                
                status = "down"
                if name in stats:
                    status = "up" if stats[name].isup else "down"

                interfaces.append(NetworkInterface(
                    name=name,
                    ip_address=ip,
                    netmask=mask,
                    dhcp=name not in static_ifaces,
                    status=status
                ))
        except Exception as e:
            print(f"[DhcpcdNetworkAdapter] Error parsing interfaces: {e}")
        return interfaces

    def save_backup(self, iface: str) -> None:
        if os.path.exists(self.conf_path):
            shutil.copy2(self.conf_path, self.backup_path)
            print(f"[DhcpcdNetworkAdapter] Saved backup of dhcpcd.conf to {self.backup_path}")

    def apply_static_ip(self, iface: str, ip: str, netmask: str, gateway: str, dns: Optional[List[str]] = None) -> bool:
        if not os.path.exists(self.conf_path):
            print("[DhcpcdNetworkAdapter] dhcpcd.conf not found!")
            return False
            
        prefix = sum(bin(int(x)).count('1') for x in netmask.split('.'))
        dns_str = " ".join(dns) if dns else "8.8.8.8 8.8.4.4"
        
        try:
            # Read existing config and remove any current config blocks for this interface
            lines = []
            with open(self.conf_path, "r") as f:
                skip = False
                for line in f:
                    if line.strip().startswith(f"interface {iface}"):
                        skip = True
                        continue
                    if skip and line.strip() == "":
                        skip = False
                    if skip and (line.strip().startswith("static ") or line.strip().startswith("interface ")):
                        # If a new interface section starts, stop skipping
                        if line.strip().startswith("interface "):
                            skip = False
                        else:
                            continue
                    if not skip:
                        lines.append(line)

            # Append static IP block at the end
            lines.append("\n")
            lines.append(f"interface {iface}\n")
            lines.append(f"static ip_address={ip}/{prefix}\n")
            lines.append(f"static routers={gateway}\n")
            lines.append(f"static domain_name_servers={dns_str}\n")
            
            with open(self.conf_path, "w") as f:
                f.writelines(lines)
                
            # Restart dhcpcd service
            subprocess.run(["sudo", "systemctl", "restart", "dhcpcd"], check=True, capture_output=True)
            return True
        except Exception as e:
            print(f"[DhcpcdNetworkAdapter] Error setting static IP: {e}")
            return False

    def apply_dhcp(self, iface: str) -> bool:
        if not os.path.exists(self.conf_path):
            return False
        try:
            # Read and remove static configuration blocks for this interface
            lines = []
            with open(self.conf_path, "r") as f:
                skip = False
                for line in f:
                    if line.strip().startswith(f"interface {iface}"):
                        skip = True
                        continue
                    if skip and line.strip() == "":
                        skip = False
                    if skip and (line.strip().startswith("static ") or line.strip().startswith("interface ")):
                        if line.strip().startswith("interface "):
                            skip = False
                        else:
                            continue
                    if not skip:
                        lines.append(line)
                        
            with open(self.conf_path, "w") as f:
                f.writelines(lines)
                
            # Restart service
            subprocess.run(["sudo", "systemctl", "restart", "dhcpcd"], check=True, capture_output=True)
            return True
        except Exception as e:
            print(f"[DhcpcdNetworkAdapter] Error resetting to DHCP: {e}")
            return False

    def rollback(self, iface: str) -> bool:
        if not os.path.exists(self.backup_path):
            return False
        try:
            shutil.copy2(self.backup_path, self.conf_path)
            subprocess.run(["sudo", "systemctl", "restart", "dhcpcd"], check=True)
            return True
        except Exception as e:
            print(f"[DhcpcdNetworkAdapter] Rollback failed: {e}")
            return False
