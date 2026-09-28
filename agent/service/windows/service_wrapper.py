import os
import sys
import time
import win32serviceutil
import win32service
import win32event
import servicemanager
import socket

# Add parent directory to sys.path so we can import the agent modules
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

from agent import IoTAgent

class IoTAgentWindowsService(win32serviceutil.ServiceFramework):
    _svc_name_ = "IoTAgent"
    _svc_display_name_ = "IoT Monitor Device Agent"
    _svc_description_ = "Monitors system resources (CPU, RAM, temp, disk) and executes remote administrative commands."

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        socket.setdefaulttimeout(60)
        self.agent = IoTAgent()

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.hWaitStop)
        self.agent.stop()

    def SvcDoRun(self):
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, '')
        )
        self.main()

    def main(self):
        # Run the agent in a background thread or call run and poll wait events
        import threading
        agent_thread = threading.Thread(target=self.agent.run)
        agent_thread.daemon = True
        agent_thread.start()
        
        # Wait for the service stop event to trigger
        win32event.WaitForSingleObject(self.hWaitStop, win32event.INFINITE)
        
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STOPPED,
            (self._svc_name_, '')
        )

if __name__ == '__main__':
    if len(sys.argv) == 1:
        # Service is starting, load managers
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(IoTAgentWindowsService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        win32serviceutil.HandleCommandLine(IoTAgentWindowsService)
