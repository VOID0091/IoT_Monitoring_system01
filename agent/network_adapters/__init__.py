import sys
import shutil
import os
import psutil
from typing import List, Optional
from .base import NetworkAdapterBase, NetworkInterface
from .windows_adapter import WindowsNetworkAdapter

class FallbackNetworkAdapter(NetworkAdapterBase):
    def get_interfaces(self) -> List[NetworkInterface]:
        interfaces = []
        try:
            stats = psutil.net_if_stats()
            for name, addrs in psutil.net_if_addrs().items():
                if name == "lo" or name.startswith("docker"):
                    continue
                ip = None
                mask = None
                for addr in addrs:
                    if addr.family == 2:
                        ip = addr.address
                        mask = addr.netmask
                status = "down"
                if name in stats:
                    status = "up" if stats[name].isup else "down"
                    
                interfaces.append(NetworkInterface(
                    name=name,
                    ip_address=ip,
                    netmask=mask,
                    dhcp=True,
                    status=status
                ))
        except Exception as e:
            print(f"[FallbackNetworkAdapter] Error: {e}")
        return interfaces

    def apply_static_ip(self, iface: str, ip: str, netmask: str, gateway: str, dns: Optional[List[str]] = None) -> bool:
        print("[FallbackNetworkAdapter] Static IP configuration not supported on this platform/network configuration manager.")
        return False

    def apply_dhcp(self, iface: str) -> bool:
        print("[FallbackNetworkAdapter] DHCP configuration not supported on this platform/network configuration manager.")
        return False

    def save_backup(self, iface: str) -> None:
        pass

    def rollback(self, iface: str) -> bool:
        return False

def get_network_adapter() -> NetworkAdapterBase:
    """Detect and return the appropriate network configuration adapter."""
    if sys.platform == "win32":
        return WindowsNetworkAdapter()
        
    # Check for NetworkManager
    if shutil.which("nmcli"):
        from .networkmanager import NetworkManagerAdapter
        return NetworkManagerAdapter()
        
    # Check for Netplan
    if os.path.exists("/etc/netplan") and shutil.which("netplan"):
        from .netplan import NetplanNetworkAdapter
        return NetplanNetworkAdapter()
        
    # Check for dhcpcd
    if os.path.exists("/etc/dhcpcd.conf"):
        from .dhcpcd import DhcpcdNetworkAdapter
        return DhcpcdNetworkAdapter()
        
    return FallbackNetworkAdapter()
