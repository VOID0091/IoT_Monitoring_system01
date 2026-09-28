import sys
import psutil
from typing import Dict, Any

def collect_disk_info() -> Dict[str, Any]:
    """Collect disk usage statistics in GB."""
    try:
        path = "C:\\" if sys.platform == "win32" else "/"
        usage = psutil.disk_usage(path)
        return {
            "disk_percent": usage.percent,
            "disk_used_gb": float(usage.used) / (1024 * 1024 * 1024),
            "disk_total_gb": float(usage.total) / (1024 * 1024 * 1024)
        }
    except Exception as e:
        print(f"[Collector] Disk Collection error: {e}")
        return {
            "disk_percent": 0.0,
            "disk_used_gb": 0.0,
            "disk_total_gb": 0.0
        }
