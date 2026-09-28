import sys
from abc import ABC, abstractmethod
from typing import Dict, Any

class PlatformBase(ABC):
    @abstractmethod
    def get_hostname(self) -> str:
        """Get the current system hostname."""
        pass

    @abstractmethod
    def set_hostname(self, name: str) -> bool:
        """Set the system hostname. Return True if successful."""
        pass

    @abstractmethod
    def reboot(self) -> None:
        """Reboot the system immediately."""
        pass

    @abstractmethod
    def get_uptime(self) -> float:
        """Get the system uptime in seconds."""
        pass

    @abstractmethod
    def get_platform_info(self) -> Dict[str, Any]:
        """Get general platform info (OS, version, kernel, arch)."""
        pass
