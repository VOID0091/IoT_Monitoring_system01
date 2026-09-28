import psutil

def collect_cpu_percent() -> float:
    """Collect current system CPU percentage usage."""
    try:
        # Non-blocking CPU check
        return psutil.cpu_percent(interval=None)
    except Exception as e:
        print(f"[Collector] CPU Collection error: {e}")
        return 0.0
