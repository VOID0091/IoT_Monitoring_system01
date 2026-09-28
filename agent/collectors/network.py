import psutil
from typing import Dict, Any

def collect_network_info() -> Dict[str, Any]:
    """Collect aggregate network bytes sent and received."""
    try:
        counters = psutil.net_io_counters()
        return {
            "net_bytes_sent": float(counters.bytes_sent),
            "net_bytes_recv": float(counters.bytes_recv)
        }
    except Exception as e:
        print(f"[Collector] Network Collection error: {e}")
        return {
            "net_bytes_sent": 0.0,
            "net_bytes_recv": 0.0
        }
