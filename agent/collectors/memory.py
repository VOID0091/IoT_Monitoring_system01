import psutil
from typing import Dict, Any

def collect_memory_info() -> Dict[str, Any]:
    """Collect memory information in MB."""
    try:
        mem = psutil.virtual_memory()
        return {
            "ram_percent": mem.percent,
            "ram_used_mb": float(mem.used) / (1024 * 1024),
            "ram_total_mb": float(mem.total) / (1024 * 1024)
        }
    except Exception as e:
        print(f"[Collector] RAM Collection error: {e}")
        return {
            "ram_percent": 0.0,
            "ram_used_mb": 0.0,
            "ram_total_mb": 0.0
        }
