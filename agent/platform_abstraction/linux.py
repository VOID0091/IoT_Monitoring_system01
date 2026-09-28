import os
import socket
import time
import platform
import subprocess
import psutil
from typing import Dict, Any
from .base import PlatformBase

class LinuxPlatform(PlatformBase):
    def get_hostname(self) -> str:
        return socket.gethostname()

    def set_hostname(self, name: str) -> bool:
        try:
            # Requires root/sudo privileges
            res = subprocess.run(["sudo", "hostnamectl", "set-hostname", name], capture_output=True, text=True)
            if res.returncode == 0:
                return True
            # Fallback to writing to /etc/hostname directly
            res2 = subprocess.run(["hostname", name], capture_output=True, text=True)
            return res2.returncode == 0
        except Exception as e:
            print(f"[LinuxPlatform] Failed to set hostname: {e}")
            return False

    def reboot(self) -> None:
        os.system("sudo reboot")

    def get_uptime(self) -> float:
        try:
            with open('/proc/uptime', 'r') as f:
                return float(f.readline().split()[0])
        except Exception:
            try:
                return time.time() - psutil.boot_time()
            except Exception:
                return 0.0

    def get_platform_info(self) -> Dict[str, Any]:
        distro = "Linux"
        try:
            import lsb_release
            distro = lsb_release.get_distributor_id() + " " + lsb_release.get_release_meta()['RELEASE']
        except ImportError:
            try:
                if os.path.exists("/etc/os-release"):
                    with open("/etc/os-release") as f:
                        for line in f:
                            if line.startswith("PRETTY_NAME="):
                                distro = line.split("=")[1].strip().strip('"')
                                break
            except Exception:
                pass
        
        return {
            "platform": "linux",
            "os_name": distro,
            "os_version": platform.release(),
            "os_release": platform.version(),
            "architecture": platform.machine(),
            "python_version": platform.python_version()
        }
