import os
from .linux import LinuxPlatform
from typing import Dict, Any

class RaspberryPiPlatform(LinuxPlatform):
    def get_platform_info(self) -> Dict[str, Any]:
        info = super().get_platform_info()
        info["platform"] = "raspberry_pi"
        
        # Try to find specific Pi model
        model = "Raspberry Pi"
        try:
            if os.path.exists("/proc/device-tree/model"):
                with open("/proc/device-tree/model", "r") as f:
                    model = f.read().strip("\x00")
            elif os.path.exists("/sys/firmware/devicetree/base/model"):
                with open("/sys/firmware/devicetree/base/model", "r") as f:
                    model = f.read().strip("\x00")
        except Exception:
            pass
        
        info["os_name"] = f"{info['os_name']} ({model})"
        return info
