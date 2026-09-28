import os
import shutil
import glob
import yaml
import subprocess
from typing import List, Dict, Any, Optional
from .base import NetworkAdapterBase, NetworkInterface

class NetplanNetworkAdapter(NetworkAdapterBase):
    def __init__(self):
        super().__init__()
        self.netplan_dir = "/etc/netplan"
        self.override_file = "/etc/netplan/99-iot-agent.yaml"
        self.backup_dir = "/tmp/netplan_backup"

    def get_interfaces(self) -> List[NetworkInterface]:
        interfaces = []
        try:
            # We can use psutil to query currently active interfaces, then correlate with netplan config
            import psutil
            stats = psutil.net_if_stats()
            addrs = psutil.net_if_addrs()
            
            # Read netplan yaml configuration to check if DHCP is set
            netplan_dhcp = {}
            for path in glob.glob(os.path.join(self.netplan_dir, "*.yaml")):
                try:
                    with open(path, "r") as f:
                        cfg = yaml.safe_load(f) or {}
                        ethernets = cfg.get("network", {}).get("ethernets", {})
                        for iface, data in ethernets.items():
                            netplan_dhcp[iface] = data.get("dhcp4", True)
                except Exception:
                    pass

            for name, ip_list in addrs.items():
                if name == "lo" or name.startswith("docker") or name.startswith("veth"):
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
                
                # Fetch route gateway
                gateway = None
                try:
                    res = subprocess.run(["ip", "route", "show", "dev", name], capture_output=True, text=True)
                    for line in res.stdout.split("\n"):
                        if "default via" in line:
                            gateway = line.split()[2]
                            break
                except Exception:
                    pass

                interfaces.append(NetworkInterface(
                    name=name,
                    ip_address=ip,
                    netmask=mask,
                    gateway=gateway,
                    dhcp=netplan_dhcp.get(name, True),
                    status=status
                ))
        except Exception as e:
            print(f"[NetplanNetworkAdapter] Error parsing interfaces: {e}")
        return interfaces

    def save_backup(self, iface: str) -> None:
        if os.path.exists(self.backup_dir):
            shutil.rmtree(self.backup_dir)
        os.makedirs(self.backup_dir)
        
        # Backup all existing YAMLs
        for path in glob.glob(os.path.join(self.netplan_dir, "*.yaml")):
            shutil.copy2(path, self.backup_dir)
        print(f"[NetplanNetworkAdapter] Backed up Netplan configs to {self.backup_dir}")

    def _write_config(self, iface: str, cfg_data: dict) -> bool:
        try:
            # First, clean existing override to avoid conflict
            if os.path.exists(self.override_file):
                os.remove(self.override_file)
                
            config = {
                "network": {
                    "version": 2,
                    "ethernets": {
                        iface: cfg_data
                    }
                }
            }
            # Ensure folder exists
            os.makedirs(self.netplan_dir, exist_ok=True)
            with open(self.override_file, "w") as f:
                yaml.dump(config, f)
            
            # Apply configuration
            res = subprocess.run(["sudo", "netplan", "apply"], capture_output=True, text=True)
            return res.returncode == 0
        except Exception as e:
            print(f"[NetplanNetworkAdapter] Failed to write/apply netplan config: {e}")
            return False

    def apply_static_ip(self, iface: str, ip: str, netmask: str, gateway: str, dns: Optional[List[str]] = None) -> bool:
        prefix = sum(bin(int(x)).count('1') for x in netmask.split('.'))
        cfg = {
            "dhcp4": False,
            "addresses": [f"{ip}/{prefix}"],
            "routes": [
                {
                    "to": "default",
                    "via": gateway
                }
            ]
        }
        if dns:
            cfg["nameservers"] = {"addresses": dns}
            
        return self._write_config(iface, cfg)

    def apply_dhcp(self, iface: str) -> bool:
        cfg = {
            "dhcp4": True
        }
        return self._write_config(iface, cfg)

    def rollback(self, iface: str) -> bool:
        if not os.path.exists(self.backup_dir):
            print("[NetplanNetworkAdapter] No backup available for rollback!")
            return False
            
        print("[NetplanNetworkAdapter] Reverting netplan config from backup...")
        try:
            # Clean current netplan directory YAMLs
            for path in glob.glob(os.path.join(self.netplan_dir, "*.yaml")):
                os.remove(path)
            # Restore backups
            for path in glob.glob(os.path.join(self.backup_dir, "*.yaml")):
                shutil.copy2(path, self.netplan_dir)
                
            # Apply restored config
            subprocess.run(["sudo", "netplan", "apply"], check=True)
            return True
        except Exception as e:
            print(f"[NetplanNetworkAdapter] Rollback apply failed: {e}")
            return False
