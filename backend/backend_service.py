import os
import sys
import time
import win32serviceutil
import win32service
import win32event
import servicemanager
import socket
import threading
import uvicorn

# Add current path to python search path for relative imports inside frozen package
app_dir = os.path.dirname(os.path.abspath(__file__))
if app_dir not in sys.path:
    sys.path.append(app_dir)

class IoTMonitorBackendService(win32serviceutil.ServiceFramework):
    _svc_name_ = "IoTMonitorBackend"
    _svc_display_name_ = "IoT Monitor Backend Service"
    _svc_description_ = "FastAPI backend uvicorn service hosting API, WebSocket and React UI endpoints."

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        socket.setdefaulttimeout(60)
        self.server_thread = None

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.hWaitStop)

    def SvcDoRun(self):
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, "")
        )
        self.main()

    def main(self):
        # Force production mode for settings AppData path isolation
        os.environ["IOT_MONITOR_ENV"] = "production"
        
        # Load uvicorn uvicorn
        from app.main import app
        from app.core.config import settings

        config = uvicorn.Config(
            app,
            host=settings.HOST,
            port=settings.PORT,
            log_level="info",
            workers=1,
            loop="asyncio"
        )
        server = uvicorn.Server(config)
        
        # Run server on background thread
        self.server_thread = threading.Thread(target=server.run)
        self.server_thread.daemon = True
        self.server_thread.start()
        
        # Wait for service stop signal
        win32event.WaitForSingleObject(self.hWaitStop, win32event.INFINITE)
        
        # Trigger uvicorn server shutdown
        server.should_exit = True
        self.server_thread.join(timeout=5)
        
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STOPPED,
            (self._svc_name_, "")
        )

if __name__ == "__main__":
    if len(sys.argv) == 1:
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(IoTMonitorBackendService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        win32serviceutil.HandleCommandLine(IoTMonitorBackendService)
