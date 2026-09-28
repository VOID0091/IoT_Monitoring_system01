import time
import socket
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class NetworkInterface:
    name: str
    ip_address: Optional[str] = None
    netmask: Optional[str] = None
    gateway: Optional[str] = None
    dns: Optional[List[str]] = None
    dhcp: bool = True
    status: str = "down" # "up", "down"

class NetworkAdapterBase(ABC):
    def __init__(self):
        self.backup_config: Dict[str, Any] = {}

    @abstractmethod
    def get_interfaces(self) -> List[NetworkInterface]:
        """List all network interfaces and their configuration."""
        pass

    @abstractmethod
    def apply_static_ip(self, iface: str, ip: str, netmask: str, gateway: str, dns: Optional[List[str]] = None) -> bool:
        """Apply static IP configuration directly to system."""
        pass

    @abstractmethod
    def apply_dhcp(self, iface: str) -> bool:
        """Apply DHCP configuration directly to system."""
        pass

    @abstractmethod
    def save_backup(self, iface: str) -> None:
        """Save the current configuration of the interface as a backup."""
        pass

    @abstractmethod
    def rollback(self, iface: str) -> bool:
        """Restore the backup network configuration for the interface."""
        pass

    def test_connectivity(self, host: str = "8.8.8.8", port: int = 53, timeout: int = 5) -> bool:
        """Test if the network connection is active by opening a socket to a remote host."""
        try:
            socket.setdefaulttimeout(timeout)
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.connect((host, port))
            return True
        except Exception:
            return False

    def set_static_ip_safe(self, iface: str, ip: str, netmask: str, gateway: str, dns: Optional[List[str]] = None, check_host: str = "8.8.8.8") -> bool:
        """
        Safely configure static IP.
        Saves backup, applies changes, tests connection, and rolls back on failure.
        """
        print(f"[NetworkAdapter] Safely setting static IP {ip} on {iface}...")
        self.save_backup(iface)
        
        success = self.apply_static_ip(iface, ip, netmask, gateway, dns)
        if not success:
            print(f"[NetworkAdapter] Failed to apply static configuration on {iface}. Reverting.")
            self.rollback(iface)
            return False

        # Wait a few seconds for network interface to bring link up and get routes
        time.sleep(5)
        
        if self.test_connectivity(host=check_host):
            print("[NetworkAdapter] Connectivity test succeeded. Settings persisted.")
            return True
        else:
            print("[NetworkAdapter] Connectivity test failed! Initiating rollback...")
            self.rollback(iface)
            return False

    def set_dhcp_safe(self, iface: str, check_host: str = "8.8.8.8") -> bool:
        """
        Safely configure DHCP.
        Saves backup, applies changes, tests connection, and rolls back on failure.
        """
        print(f"[NetworkAdapter] Safely setting DHCP on {iface}...")
        self.save_backup(iface)
        
        success = self.apply_dhcp(iface)
        if not success:
            print(f"[NetworkAdapter] Failed to apply DHCP on {iface}. Reverting.")
            self.rollback(iface)
            return False

        # Wait for DHCP lease
        time.sleep(10)
        
        if self.test_connectivity(host=check_host):
            print("[NetworkAdapter] Connectivity test succeeded with DHCP.")
            return True
        else:
            print("[NetworkAdapter] Connectivity test failed with DHCP! Initiating rollback...")
            self.rollback(iface)
            return False
