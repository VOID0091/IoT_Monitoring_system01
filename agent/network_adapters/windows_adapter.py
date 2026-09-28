import subprocess
import json
import psutil
from typing import List, Dict, Any, Optional
from .base import NetworkAdapterBase, NetworkInterface

class WindowsNetworkAdapter(NetworkAdapterBase):
    def get_interfaces(self) -> List[NetworkInterface]:
        interfaces = []
        try:
            # Run PowerShell script to get network interfaces details
            ps_script = (
                "Get-NetIPConfiguration | ForEach-Object { "
                "[PSCustomObject]@{ "
                "Name = $_.InterfaceAlias; "
                "Index = $_.InterfaceIndex; "
                "IP = $_.IPv4Address.IPAddress; "
                "Gateway = $_.IPv4DefaultGateway.NextHop; "
                "DNS = $_.DNSServer.ServerAddresses -join ','; "
                "DHCP = (Get-NetIPInterface -InterfaceIndex $_.InterfaceIndex -AddressFamily IPv4).DHCP "
                "} } | ConvertTo-Json"
            )
            res = subprocess.run(["powershell.exe", "-Command", ps_script], capture_output=True, text=True, check=True)
            if res.stdout.strip():
                data = json.loads(res.stdout)
                # handle if output is a single dict instead of list
                if isinstance(data, dict):
                    data = [data]
                
                # Check status via psutil
                stats = psutil.net_if_stats()
                
                for entry in data:
                    name = entry.get("Name")
                    ip = entry.get("IP")
                    dns_servers = [d.strip() for d in entry.get("DNS", "").split(",") if d.strip()]
                    dhcp_val = entry.get("DHCP") == 1 or entry.get("DHCP") is True
                    
                    status = "down"
                    if name in stats:
                        status = "up" if stats[name].isup else "down"
                        
                    interfaces.append(NetworkInterface(
                        name=name,
                        ip_address=ip,
                        netmask=self._get_netmask(name, ip),
                        gateway=entry.get("Gateway"),
                        dns=dns_servers,
                        dhcp=dhcp_val,
                        status=status
                    ))
        except Exception as e:
            print(f"[WindowsNetworkAdapter] Error getting interfaces: {e}")
            # Fallback using psutil
            for name, addrs in psutil.net_if_addrs().items():
                ip = None
                mask = None
                for addr in addrs:
                    if addr.family == 2: # AF_INET
                        ip = addr.address
                        mask = addr.netmask
                if ip:
                    interfaces.append(NetworkInterface(
                        name=name,
                        ip_address=ip,
                        netmask=mask,
                        dhcp=True,
                        status="up"
                    ))
        return interfaces

    def _get_netmask(self, name: str, ip: str) -> Optional[str]:
        if not ip:
            return None
        for iface, addrs in psutil.net_if_addrs().items():
            if iface == name:
                for addr in addrs:
                    if addr.family == 2 and addr.address == ip:
                        return addr.netmask
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
                print(f"[WindowsNetworkAdapter] Backed up {iface} configuration: {self.backup_config[iface]}")
                return

    def apply_static_ip(self, iface: str, ip: str, netmask: str, gateway: str, dns: Optional[List[str]] = None) -> bool:
        try:
            # Netsh is extremely reliable for interface setting on Windows
            # Set address
            cmd = f'netsh interface ipv4 set address name="{iface}" static {ip} {netmask} {gateway} 1'
            subprocess.run(cmd, shell=True, check=True, capture_output=True)
            
            # Set DNS
            if dns and len(dns) > 0:
                dns_cmd = f'netsh interface ipv4 set dns name="{iface}" static {dns[0]}'
                subprocess.run(dns_cmd, shell=True, check=True, capture_output=True)
                for d in dns[1:]:
                    dns_add = f'netsh interface ipv4 add dns name="{iface}" {d} index=2'
                    subprocess.run(dns_add, shell=True, check=True, capture_output=True)
            return True
        except Exception as e:
            print(f"[WindowsNetworkAdapter] Error setting static IP: {e}")
            return False

    def apply_dhcp(self, iface: str) -> bool:
        try:
            cmd = f'netsh interface ipv4 set address name="{iface}" source=dhcp'
            subprocess.run(cmd, shell=True, check=True, capture_output=True)
            cmd_dns = f'netsh interface ipv4 set dns name="{iface}" source=dhcp'
            subprocess.run(cmd_dns, shell=True, check=True, capture_output=True)
            return True
        except Exception as e:
            print(f"[WindowsNetworkAdapter] Error setting DHCP: {e}")
            return False

    def rollback(self, iface: str) -> bool:
        backup = self.backup_config.get(iface)
        if not backup:
            print(f"[WindowsNetworkAdapter] No backup config found for rollback of {iface}!")
            return False
            
        print(f"[WindowsNetworkAdapter] Rolling back {iface}...")
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
