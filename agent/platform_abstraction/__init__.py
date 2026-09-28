import sys
import os
from .base import PlatformBase
from .windows import WindowsPlatform
from .linux import LinuxPlatform
from .raspberry_pi import RaspberryPiPlatform

def get_platform_adapter() -> PlatformBase:
    """Detect platform dynamically and return the correct adapter instance."""
    if sys.platform == "win32":
        return WindowsPlatform()
    
    # Check for Raspberry Pi
    is_rpi = False
    try:
        if os.path.exists("/proc/device-tree/model"):
            with open("/proc/device-tree/model", "r") as f:
                model = f.read().lower()
                if "raspberry pi" in model:
                    is_rpi = True
    except Exception:
        pass
        
    if is_rpi:
        return RaspberryPiPlatform()
    return LinuxPlatform()
