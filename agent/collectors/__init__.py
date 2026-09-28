from typing import Dict, Any
from .cpu import collect_cpu_percent
from .memory import collect_memory_info
from .temperature import collect_temperature
from .disk import collect_disk_info
from .network import collect_network_info

def collect_all_metrics() -> Dict[str, Any]:
    """Collect all system telemetry metrics into a single dictionary."""
    metrics = {}
    
    # CPU
    metrics["cpu_percent"] = collect_cpu_percent()
    
    # RAM
    metrics.update(collect_memory_info())
    
    # Temperature
    temp = collect_temperature()
    if temp is not None:
        metrics["temperature"] = temp
        
    # Disk
    metrics.update(collect_disk_info())
    
    # Network I/O
    metrics.update(collect_network_info())
    
    return metrics
