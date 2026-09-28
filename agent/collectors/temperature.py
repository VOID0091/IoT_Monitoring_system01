import sys
import os
import psutil
from typing import Optional

def collect_temperature() -> Optional[float]:
    """Collect CPU temperature in °C."""
    if sys.platform == "win32":
        return _collect_windows_temp()
    else:
        return _collect_linux_temp()

def _collect_linux_temp() -> Optional[float]:
    # Try psutil sensors
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            for name, entries in temps.items():
                for entry in entries:
                    if entry.current > 0:
                        return entry.current
    except Exception:
        pass

    # Try thermal zone file directly (Raspberry Pi/Linux)
    try:
        thermal_path = "/sys/class/thermal/thermal_zone0/temp"
        if os.path.exists(thermal_path):
            with open(thermal_path, "r") as f:
                temp_raw = float(f.read().strip())
                return temp_raw / 1000.0
    except Exception:
        pass
        
    return None

def _collect_windows_temp() -> Optional[float]:
    # Windows temperature collection requires admin and specific drivers.
    # We query WMI MSI temperature or return None.
    try:
        import wmi
        w = wmi.WMI(namespace="root\\wmi")
        # MSAcpi_ThermalZoneTemperature is standard but not always populated
        instances = w.MSAcpi_ThermalZoneTemperature()
        if instances:
            # Convert Tenths of Kelvin to Celsius
            return (instances[0].CurrentTemperature / 10.0) - 273.15
    except Exception:
        pass
    return None
