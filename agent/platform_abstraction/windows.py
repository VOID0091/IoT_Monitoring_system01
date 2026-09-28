import os
import socket
import time
import platform
import subprocess
import psutil
from typing import Dict, Any
from .base import PlatformBase

class WindowsPlatform(PlatformBase):
    def get_hostname(self) -> str:
        return socket.gethostname()

    def set_hostname(self, name: str) -> bool:
        try:
            # Rename computer via PowerShell. Requires admin privileges.
            cmd = ["powershell.exe", "-Command", f"Rename-Computer -NewName '{name}' -Force"]
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return res.returncode == 0
        except Exception as e:
            print(f"[WindowsPlatform] Failed to set hostname: {e}")
            return False

    def reboot(self) -> None:
        # Gracefully command Windows reboot
        os.system("shutdown /r /t 2 /c \"IoT Agent Remote Reboot Requested\"")

    def get_uptime(self) -> float:
        try:
            return time.time() - psutil.boot_time()
        except Exception:
            return 0.0

    def get_platform_info(self) -> Dict[str, Any]:
        return {
            "platform": "windows",
            "os_name": platform.system(),
            "os_version": platform.version(),
            "os_release": platform.release(),
            "architecture": platform.machine(),
            "python_version": platform.python_version()
        }
